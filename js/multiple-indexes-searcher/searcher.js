import init, { Searcher as FstSearcher } from "https://solirom.gitlab.io/search-engines/search-engine/search_engine.js";
import k_combinations from "../ngram-index-searcher/combinations.js";
// https://solirom.gitlab.io/web-components/fst-index-search/search_engine.mjs
await init();

/**
 * @typedef {Object} Searcher
 * @property {Array.<string>} terms  
 * @property {Array.<Term>} termAndOperatorsStructures
 * @property {boolean} allExactMatches
 * @property {boolean} isFuzzySearch
 * @property {URL} exactIndexBaseURL
 * @property {URL} termsFSTmapURL
 * @property {URl} ngramIndexBaseURL
 * @property {Number} ngramSimilarityThreshold
 * @property {Array.<string>} _words
 */
export default class Searcher {
    constructor(exactIndexBaseURL, termsFSTmapURL, ngramIndexBaseURL, ngramSimilarityThreshold, _words) {
        this._terms = [];
        this._searchStringAST = [];
        this._markTerms = null;
        this.termAndOperatorsStructures = [];
        this.allExactMatches = true;
        this.isFuzzySearch = false;
        this.exactIndexBaseURL = exactIndexBaseURL;
        this.termsFSTmapURL = termsFSTmapURL;
        this.ngramIndexBaseURL = ngramIndexBaseURL;
        this.ngramSimilarityThreshold = ngramSimilarityThreshold;
        this._words = _words;
    }

    set terms(value) {
        this._terms = value;
        this.markTerms = this.terms.join(" ");
    }

    get terms() {
        return this._terms;
    }

    set searchStringAST(value) {
        this._searchStringAST = value;
        let terms = [...value]
            .filter(item => item.hasOwnProperty("term"))
            .map(item => item.term);
        this._terms = terms;
        this.markTerms = this.terms.join(" ");
    }

    get searchStringAST() {
        return this._searchStringAST;
    }

    set markTerms(value) {
        this._markTerms = value;
    }

    get markTerms() {
        return this._markTerms;
    }

    init = async () => {
        // get the FST file
        await fetch(new URL("index.fst", this.termsFSTmapURL))
            .then(response => response.arrayBuffer())
            .then(async data => {
                this._fstSearcher = new FstSearcher(new Uint8Array(data));
            });
    }

    reset() {
        this.terms = [];
        this.termAndOperatorsStructures = [];
        this.allExactMatches = true;
    }

    executeSearch = async (searchTypes) => {
        const promises = this.searchStringAST.map(async item => {
            switch (true) {
                case item.hasOwnProperty("term"):
                    // initialisations
                    let prefix_search_results = [];
                    let levenstein_1_search_results = [];
                    let levenstein_2_search_results = [];
                    let ngramSearchResults = [];

                    let term = item.term;
                    term = term.toLowerCase();
                    let termStructure = new Term(term);

                    // execute the prefix search, if selected
                    if (searchTypes.prefix) {
                        prefix_search_results = this._fstSearcher.prefix_search(term).map(item => parseInt(item));
                        this.isFuzzySearch = true;
                    }

                    // execute the levenstein_1 search, if selected
                    if (searchTypes.levenstein_1) {
                        levenstein_1_search_results = this._fstSearcher.levenstein_1_search(term).map(item => parseInt(item));
                        this.isFuzzySearch = true;
                    }

                    // execute the levenstein_2 search, if selected
                    if (searchTypes.levenstein_2) {
                        levenstein_2_search_results = this._fstSearcher.levenstein_2_search(term).map(item => parseInt(item));
                        this.isFuzzySearch = true;
                    }

                    // execute the ngram search, if selected
                    if (searchTypes.ngram) {
                        ngramSearchResults = await this._ngramSearch(term);

                        this.isFuzzySearch = true;
                    }

                    // aggregate the suggestions id-s
                    let suggestionIDs = new Set(Array.from([prefix_search_results, levenstein_1_search_results, levenstein_2_search_results, ngramSearchResults]).flat());
                    // aggregate the suggestions
                    let suggestions = Array.from(suggestionIDs).map(item => this._words[item]).sort();
                    for (let suggestion of suggestions) {
                        termStructure.suggestions.set(suggestion, []);
                    }

                    // finally, execute the exact search
                    let termIndex = this._words.indexOf(term);
                    if (termIndex !== -1) {
                        await fetch(new URL(`${this._calculateRelativeURL(this._words.indexOf(term))}.json`, this.exactIndexBaseURL), { mode: "cors" })
                            .then(async response => {
                                if (response.status === 200) {
                                    let data = await response.json();
                                    termStructure.suggestions.set(term, new Map(Object.entries(data)));
                                } else {
                                    alert("An error occured during search. Please, retry.");
                                }
                            });
                    } else {
                        this.allExactMatches = false;
                        termStructure.isExactMatch = false;
                    }

                    return termStructure;
                case item.hasOwnProperty("w-proximity-operator"):
                    return item;
                    break;
            }
        });

        // aggregate the search results, for all terms
        let aggregatedMatches = await Promise.all(promises);
        aggregatedMatches.forEach(item => this.termAndOperatorsStructures.push(item));
    }

    intersectSearchResult = () => {
        let positionalIntersectionResult = new Map();
        let w_distance = 0;
        
        this.termAndOperatorsStructures.forEach(item => {
            switch (true) {
                case item.hasOwnProperty("term"):
                    let term = item.term.toLowerCase();
                    let positionalIndexRecords = item.suggestions.get(term);
                    console.log(positionalIntersectionResult);
                    console.log(positionalIndexRecords);

                    positionalIntersectionResult = this._positionalIndexRecordsIntersection(positionalIntersectionResult, positionalIndexRecords, w_distance, "exact", true);
                    break;
                case item.hasOwnProperty("w-proximity-operator"):
                    w_distance = item["w-proximity-operator"];
                    break;
            }
        });

        return positionalIntersectionResult;
    }

    _ngramSearch = async (term) => {
        // calculate the ngrams
        let ngrams = this._getNGrams(term, 2, "_");

        // get the word IDs for the calculated ngrams
        let ngramWordIDs = new Map();
        for (let ngram of ngrams) {
            let wordIDs = await fetch(new URL(`${ngram}.json`, this.ngramIndexBaseURL), {
                mode: "cors",
            })
                .then(async response => {
                    if (response.status === 200) {
                        return response.json();
                    } else {
                        return [];
                    }
                });

            if (wordIDs.length !== 0) {
                ngramWordIDs.set(ngram, wordIDs);
            }
        }

        // generate the combinations of ngrams, based on the ngram similarity threshold
        let commonNGramsNumber = this.ngramSimilarityThreshold * ngrams.length;
        if (commonNGramsNumber - Math.trunc(commonNGramsNumber) < 0.5) {
            commonNGramsNumber = Math.trunc(commonNGramsNumber);
        } else {
            commonNGramsNumber = Math.round(commonNGramsNumber);
        }

        let ngramsCombinations = k_combinations(Array.from(ngramWordIDs.keys()), commonNGramsNumber);

        // get the words having combinations of ngrams that were found
        let resultWords = [];
        console.time("words");
        for (let ngramsCombination of ngramsCombinations) {
            let resultWordIDs = ngramsCombination.map(item => Array.from(ngramWordIDs.get(item)));

            let processedResultWordIDs = this._intersectIDs(resultWordIDs);
            if (processedResultWordIDs.length > 0) {
            }

            resultWords = resultWords.concat(processedResultWordIDs);
        }
        console.timeEnd("words");

        //resultWords = resultWords.map(item => this._words[item]);
        resultWords = Array.from(new Set(resultWords));
        resultWords.sort();

        return resultWords;
    }

    _calculateRelativeURL = (value) => {
        let firstTreeeLetters = value.toString().split("").splice(0, 3).join("/");

        return firstTreeeLetters + "/" + value;
    }

    _intersectIDs = (sets) => {
        // check if any of the sets in empty
        for (let set of sets) {
            if (set.length === 0) {
                return [];
            }
        }
        let setsNumber = sets.length;
        let commonIDs = [];
        let firstSet = [];
        let secondSet = [];

        // successive lookup
        switch (setsNumber) {
            // case with one selected sets
            case 1:
                commonIDs = sets[0];
                break;
            // case with two selected sets
            case 2:
                firstSet = sets[0];
                secondSet = sets[1];
                commonIDs = this._intersectTwoArrays([
                    firstSet,
                    secondSet,
                    0
                ]);
                break;
            // case with at least three selected sets
            default:
                firstSet = sets[0];
                secondSet = sets[1];
                commonIDs = this._intersectTwoArrays([
                    firstSet,
                    secondSet,
                    0
                ]);

                for (let i = 2; i < setsNumber; i++) {
                    let ithSelectedSuggestion = sets[i];
                    commonIDs = this._intersectTwoArrays([
                        commonIDs,
                        ithSelectedSuggestion,
                        0
                    ]);
                }
        }

        return commonIDs;
    }

    _intersectTwoArrays = (arrays) => {
        let result = [];
        let a = [...arrays[0]];
        let b = [...arrays[1]];

        while (a.length > 0 && b.length > 0) {
            let left = +a[0];
            let right = +b[0];

            if (left < right) {
                a.shift();
            }
            else if (left > right) {
                b.shift();
            }
            else /* they're equal */ {
                result.push(a.shift());
                b.shift();
            }
        }

        return result;
    }

    _intersectTwoArraysWithDistance = (arrays, distance) => {
        let result = [];
        let a = [...arrays[0]];
        let b = [...arrays[1]];

        while (a.length > 0 && b.length > 0) {
            let left = +a[0];
            let right = +b[0] - distance - 1;

            if (left < right) {
                a.shift();
            }
            else if (left > right) {
                b.shift();
            }
            else /* they're equal */ {
                result.push(a.shift());
                b.shift();
            }
        }

        if (result.length > 0) {
            result = result.map(item => [item, item + distance + 1])
        }

        return result;
    }

    _getNGrams = (s, len, paddingToken) => {
        s = paddingToken.repeat(len - 1) + s.toLowerCase() + paddingToken.repeat(len - 1);
        let v = new Array(s.length - len + 1);
        for (let i = 0; i < v.length; i++) {
            v[i] = s.slice(i, i + len);
        }

        return v;
    }

    _positionalIndexRecordsIntersection = (positionalIndexRecord_1, positionalIndexRecord_2, distance, search_type, ordered) => {
        let result = new Map();
        let docIDs_1 = Array.from(positionalIndexRecord_1.keys());
        let docIDs_2 = Array.from(positionalIndexRecord_2.keys());
        
        if (docIDs_1.length === 0) {
            return positionalIndexRecord_2;
        }
        if (docIDs_2.length === 0) {
            return positionalIndexRecord_1;
        }

        let commonDocIDs = this._intersectTwoArrays([docIDs_1, docIDs_2]);

        for (let common_doc_ID of commonDocIDs) {
            let positions_1 = positionalIndexRecord_1.get(common_doc_ID);
            let positions_2 = positionalIndexRecord_2.get(common_doc_ID);
            let proximity_positions = [];

            if (distance === -1) {
                proximity_positions = positions_1.concat(positions_2);
            } else {
                switch (search_type) {
                    case "exact":
                        proximity_positions = this._intersectionWithExactDistance(positions_1, positions_2, distance, ordered);
                        break;
                    case "maximum":
                        proximity_positions = this._intersectionWithMaximumDistance(positions_1, positions_2, distance, ordered);
                        break;
                }
            }

            if (proximity_positions.length > 0) {
                proximity_positions = new Uint32Array(proximity_positions);
                proximity_positions.sort();
                proximity_positions = Array.from(new Set(proximity_positions));

                result.set(common_doc_ID, proximity_positions);
            }
        }

        return result;
    }

    _intersectionWithExactDistance = (positions_1, positions_2, distance, ordered) => {
        let proximity_positions = this._intersectTwoArraysWithDistance([positions_1, positions_2], distance);

        if (!ordered) {
            let reverse_proximity_positions = this._intersectTwoArraysWithDistance([positions_2, positions_1], distance);
            proximity_positions = proximity_positions.concat(reverse_proximity_positions);
        }

        //proximity_positions = proximity_positions.flatMap(item => [item, item + distance + 1]);
        proximity_positions = proximity_positions.flat();

        return proximity_positions;
    }

    _intersectionWithMaximumDistance = (positions_1, positions_2, distance, ordered) => {
        let proximity_positions = [];

        for (let step = 0; step <= distance; step++) {
            proximity_positions = proximity_positions.concat(this._intersectionWithExactDistance(positions_1, positions_2, step, ordered));
        }

        return proximity_positions;
    }
};

/**
 * @typedef {Object} Term
 * @property {string} term
 * @property {boolean} isExactMatch
 * @property {Map.<string, Array.<number>>} suggestions
 */
export class Term {
    constructor(term) {
        this.term = term;
        this.isExactMatch = true;
        this.suggestions = new Map();
    }
};

// https://highlyscalable.wordpress.com/2012/06/05/fast-intersection-sorted-lists-sse/
// https://arxiv.org/pdf/1401.6399.pdf
// https://arxiv.org/pdf/1402.4466.pdf
