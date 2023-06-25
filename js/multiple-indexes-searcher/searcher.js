import init, { Searcher as FstSearcher } from "https://solirom.gitlab.io/search-engines/search-engine/search_engine.js";
// https://solirom.gitlab.io/web-components/fst-index-search/search_engine.mjs
await init();

/**
 * @typedef {Object} Searcher
 * @property {Array.<string>} terms  
 * @property {Array.<Term>} termStructures
 * @property {boolean} allExactMatches
 * @property {URL} exactIndexBaseURL
 * @property {Array.<string>} words
 */
export default class Searcher {
    constructor(exactIndexBaseURL, fstIndexBaseURL, fstWords) {
        this.terms = [];
        this.termStructures = [];
        this.allExactMatches = true;
        this.exactIndexBaseURL = exactIndexBaseURL;
        this.fstIndexBaseURL = fstIndexBaseURL;
        this.fstWords  = fstWords;
    }

    init = async () => {
        // get the FST file
        await fetch(new URL("index.fst", this.fstIndexBaseURL))
            .then(response => response.arrayBuffer())
            .then(async data => {
                this._fstSearcher = new FstSearcher(new Uint8Array(data));
            });

        // get the FST inverted index and initialize the FST searcher
        await fetch(new URL("index.json", this.fstIndexBaseURL))
            .then(response => response.json())
            .then(async data => {
                this._fstInvertedIndex = data;
            });
    }

    reset() {
        this.terms = [];
        this.termStructures = [];
        this.allExactMatches = true;
    }

    setTerms(terms) {
        this.terms = terms;
    }

    executeSimpleFuzzySearch = async () => {
        // get matching document IDs
        const promises = this.terms.map(async term => {
            term = term.toLowerCase();
            let termStructure = new Term(term);

            // execute the prefix and levenstein searches
            let prefix_search_results = this._fstSearcher.prefix_search(term).map(item => parseInt(item));
            let levenstein_1_search_results = this._fstSearcher.levenstein_1_search(term).map(item => parseInt(item));
            let levenstein_2_search_results = this._fstSearcher.levenstein_2_search(term).map(item => parseInt(item));

            // aggregate the suggestion id-s
            let suggestionIDs = new Set(Array.from([prefix_search_results, levenstein_1_search_results, levenstein_2_search_results]).flat());

            // aggregate the suggestions
            let suggestions = Array.from(suggestionIDs).map(item => this.fstWords[item]);
            suggestions.sort();
            for (let suggestion of suggestions) {
                termStructure.simple_fuzzy_suggestions.set(suggestion, []);
            }

            // execute the exact search
            let documentIDs = await fetch(new URL(this.calculateRelativeURL(term), this.exactIndexBaseURL), { mode: "cors" })
                .then(async response => {
                    if (response.status === 200) {
                        return response.json();
                    } else {
                        this.allExactMatches = false;
                        termStructure.isExactMatch = false;
                    }
                });
            if (termStructure.isExactMatch) {
                termStructure.simple_fuzzy_suggestions.set(term, documentIDs);
            }

            return termStructure;
        });

        // aggregate the search results
        let aggregatedMatches = await Promise.all(promises);
        aggregatedMatches.forEach(item => this.termStructures.push(item));
    }

    calculateRelativeURL = (token) => {
        let firstCharacter = token.slice(0, 1);
        let suggestionRelativeURL = firstCharacter + "/";

        let secondCharacter = token.slice(1, 2);
        if (secondCharacter !== "") {
            suggestionRelativeURL = suggestionRelativeURL + secondCharacter;
        }

        return `${suggestionRelativeURL}/${token}.json`;
    }

    intersectIDs = (idSets) => {
        // check if any of the sets in empty
        for (let idSet of idSets) {
            if (idSet.length === 0) {
                return [];
            }
        }
        let setsNumber = idSets.length;
        let commonIDs = [];
        let firstSet = null;
        let secondSet = null;

        // successive lookup for inverted indexes
        switch (setsNumber) {
            // case with one selected suggestions
            case 1:
                commonIDs = idSets[0];
                break;
            // case with two selected suggestions
            case 2:
                firstSet = idSets[0];
                secondSet = idSets[1];
                commonIDs = this.intersectTwoArrays([
                    firstSet,
                    secondSet
                ]);
                break;
            // case with at least three selected suggestions
            default:
                firstSet = idSets[0];
                secondSet = idSets[1];
                commonIDs = this.intersectTwoArrays([
                    firstSet,
                    secondSet
                ]);

                for (let i = 2; i < setsNumber; i++) {
                    let ithSelectedSuggestion = idSets[i];
                    commonIDs = this.intersectTwoArrays([
                        commonIDs,
                        ithSelectedSuggestion
                    ]);
                }
        }

        return commonIDs;
    }

    intersectTwoArrays = (arrays) => {
        let result = [];
        let a = arrays[0];
        let b = arrays[1];

        while (a.length > 0 && b.length > 0) {
            if (a[0] < b[0]) { a.shift(); }
            else if (a[0] > b[0]) { b.shift(); }
            else /* they're equal */ {
                result.push(a.shift());
                b.shift();
            }
        }

        return result;
    }
};

/**
 * @typedef {Object} Term
 * @property {string} term
 * @property {boolean} isExactMatch
 * @property {Map.<string, Array.<number>>} simple_fuzzy_suggestions
 * @property {Map.<string, Array.<number>>} advanced_fuzzy_suggestions
 */
export class Term {
    constructor(term) {
        this.term = term;
        this.isExactMatch = true;
        this.simple_fuzzy_suggestions = new Map();
        this.advanced_fuzzy_suggestions = new Map();
    }
};