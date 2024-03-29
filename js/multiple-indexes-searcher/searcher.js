import init, { Searcher as FstSearcher } from "https://solirom.gitlab.io/search-engines/search-engine/search_engine.js";
import k_combinations from "../ngram-index-searcher/combinations.js";
import PositionalIntersector from "./positional-intersector.js";
// https://solirom.gitlab.io/web-components/fst-index-search/search_engine.mjs
await init();

/**
 * @typedef {Object} Searcher
 * @property {Array.<string>} terms  
 * @property {Array} searchStringAST
 * @property {string}_terms_to_highlight
 * @property {Array.<Term>} termAndOperatorsStructures
 * @property {boolean} allExactMatches
 * @property {boolean} isFuzzySearch
 * @property {URL} exactIndexBaseURL
 * @property {URL} termsFSTmapURL
 * @property {URl} ngramIndexBaseURL
 * @property {Number} ngramSimilarityThreshold
 * @property {Array.<string>} _words
 * @method
 */
export default class Searcher {
    constructor(exactIndexBaseURL, termsFSTmapURL, ngramIndexBaseURL, ngramSimilarityThreshold, _words) {
        this._terms = [];
        this._searchStringAST = [];
        this._terms_to_highlight = null;
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
        this.termsToHighlight = this.terms.join(" ");
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

        console.log(value);
        this.termsToHighlight = this.terms.join(" ");
    }

    get searchStringAST() {
        return this._searchStringAST;
    }

    set termsToHighlight(value) {
        this._terms_to_highlight = value;
    }

    get termsToHighlight() {
        return this._serializeAST();
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
                        let positional_index_record = await this._fetchPositionalIndexRecord(termIndex);
                        termStructure.suggestions.set(term, positional_index_record);
                    } else {
                        this.allExactMatches = false;
                        termStructure.isExactMatch = false;
                    }

                    return termStructure;
                default:
                    return item;
                    break;
            }
        });

        // aggregate the search results, for all terms
        let aggregatedMatches = await Promise.all(promises);
        aggregatedMatches.forEach(item => this.termAndOperatorsStructures.push(item));
    }

    intersect = () => {
        return PositionalIntersector.intersectPositionalIndexRecords(this.termAndOperatorsStructures);
    }

    _fetchPositionalIndexRecord = async (termIndex) => {
        let response = await fetch(new URL(`${this._calculateRelativeURL(termIndex)}.json`, this.exactIndexBaseURL), { mode: "cors" });
        let positional_index_record = await response.json();

        return new Map(Object.entries(positional_index_record));
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
                commonIDs = PositionalIntersector.intersectTwoArrays([
                    firstSet,
                    secondSet,
                    0
                ]);
                break;
            // case with at least three selected sets
            default:
                firstSet = sets[0];
                secondSet = sets[1];
                commonIDs = PositionalIntersector.intersectTwoArrays([
                    firstSet,
                    secondSet,
                    0
                ]);

                for (let i = 2; i < setsNumber; i++) {
                    let ithSelectedSuggestion = sets[i];
                    commonIDs = PositionalIntersector.intersectTwoArrays([
                        commonIDs,
                        ithSelectedSuggestion,
                        0
                    ]);
                }
        }

        return commonIDs;
    }

    _getNGrams = (s, len, paddingToken) => {
        s = paddingToken.repeat(len - 1) + s.toLowerCase() + paddingToken.repeat(len - 1);
        let v = new Array(s.length - len + 1);
        for (let i = 0; i < v.length; i++) {
            v[i] = s.slice(i, i + len);
        }

        return v;
    }

    _serializeAST = () => {
        let result = [];

        this.termAndOperatorsStructures.map(item => {
            switch (true) {
                case item.hasOwnProperty("term"):
                    result.push(item.selected_suggestion);
                    break;
                default:
                    result.push(Object.entries(item)[0].join("/"));
                    break;
            }
        });

        result = result
            .join(" ")
            .replaceAll("and/-1", "and");

        return result;
    }
};

/**
 * @typedef {Object} Term
 * @property {string} term
 * @property {string} selected_suggestion
 * @property {boolean} isExactMatch
 * @property {Map.<string, Array.<number>>} suggestions
 */
export class Term {
    constructor(term) {
        this.term = term;
        this.selected_suggestion = term;
        this.isExactMatch = true;
        this.suggestions = new Map();
    }
};

// https://highlyscalable.wordpress.com/2012/06/05/fast-intersection-sorted-lists-sse/
// https://arxiv.org/pdf/1401.6399.pdf
// https://arxiv.org/pdf/1402.4466.pdf
