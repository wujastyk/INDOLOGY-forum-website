import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";
import { LitElement, css, html } from "https://cdn.jsdelivr.net/npm/lit/+esm";
import "https://solirom.gitlab.io/web-components/pagination-toolbar/index.js";
import k_combinations from "../ngram-index-searcher/combinations.js";
import Searcher from "./searcher.js";

export default class MultipleIndexesSearcher extends LitElement {
    static properties = {
        /** Base URL for the exact index for words. */
        fulltextIndexBaseURL: {
            attribute: "fulltext-index-base-url"
        },
        /** Base URL for the FST index for words. */
        fstIndexBaseURL: {
            attribute: "fst-index-base-url"
        },
        /** Base URL for the ngram index for words. */
        ngramIndexBaseURL: {
            attribute: "ngram-index-base-url"
        },
        /** Base IRI for documents. */
        documentsBaseIRI: {
            attribute: "documents-base-iri"
        },
        /** URL for file with relative IRIs for documents. */
        documentRelativeIRIsURL: {
            attribute: "document-relative-iris-url"
        },
        /** Per-page limit of the elements. */
        paginationLimit: {
            type: Number,
            reflect: true,
            attribute: "pagination-limit"
        },
        /** The list with document relative IRIs */
        _documentRelativeIRIs: {
            type: Array,
        },
        /** The list of IDs of the matching documents, resulted after intersections of ID lists for words. */
        _matchingDocumentIDs: {
            type: Array,
        },
        _matchingDocumentNumber: {
            state: true
        },
        /** Variables for the global searcher */
        _searcher: {
            type: Object,
        },
        /** Variables for the NGram index */
        /** The list of words, for lookup by word's index in list. */
        _words: {
            type: Array,
        },
        /** The threshold for the ngrams similarity. */
        _ngram_similarity_threshold: {
            type: Number,
            attribute: "ngram-similarity-threshold"
        },
        /** Variables for the NGram index */
        /** The FST index. */
        _fstIndex: {
            type: Array,
        },
        /** The FST inverted index. */
        _fstInvertedIndex: {
            type: Array,
        },
        /** The FST searcher */
        _fstSearcher: {
            type: Object,
        },
    };

    static styles = css`
        :host(*) > div {
            display: flex;
            flex-direction: column; 
            gap: 5px; 
        }            
        div#search-input-container {
            width: var(--sc-width, 500px);
            display: flex;
            gap: 10px;
            justify-content: center;
        }            
        sl-input { 
            width: 400px;              
        } 
        div#suggestion-lists-container {
            width: var(--sc-width, 500px);
            display: none;
            height: 220px;
        }
        div#suggestion-lists-toolbar {
            background-color: #e9e9ed;
            display: flex;
            justify-content: space-around;
            align-items: center;
            padding: 5px;
        }
        div#suggestion-lists-toolbar > header {
            font-size: 14px;
        }        
        div#suggestion-lists-contents {
            height: 170px;
            display: flex;
            justify-content: center;
            gap: 2px;
            overflow: scroll; 
        } 
        div.suggestion-list {
            min-width: 100px;
        }
        div.suggestion {
            margin: 3px 0;
            padding: 2px;
        }
        div.suggestion:hover {
            background-color: #edebeb;
        }
        div.suggestion-selected {
            background-color: #edebeb;
        }
        div#search-result-container {
            width: var(--sc-width, 500px);
        }
        div#search-result-toolbar {
            background-color: #e9e9ed;
            margin: 3px 0;
            padding: 5px 0;
            border-radius: 5px;
        }
        sl-progress-bar {
            display: none;
        }
        div.result-item:nth-child(odd) {
            background-color: #edebeb;
        }
        div.result-item-content {
            overflow: scroll;
            height: 200px;
            padding: 5px;
            margin-bottom: 10px;
            border: 1px dashed black;
            text-overflow: ellipsis;
            text-align: justify;
        }
    `;

    constructor() {
        super();

        this._matchingDocumentNumber = null;
        this._matchingDocumentIDs = [];

        // Variables for the NGram index
        this._words = [];
        this._ngram_similarity_threshold = 0.4;

        // Variables for the FST index
        this._fstIndex = [];
        this.__fstInvertedIndex = [];

        // Variables for the global searcher
        this._searcher = {};
    }

    async firstUpdated() {
        // get the documents' relative IRIs
        await fetch(new URL(this.documentRelativeIRIsURL), {
            mode: "cors",
        })
            .then(response => response.json())
            .then(async data => {
                this._documentRelativeIRIs = data;
            });

        // get the words
        await fetch(new URL("words.json", this.fstIndexBaseURL), {
            mode: "cors",
        })
            .then(response => response.json())
            .then(async data => {
                this._words = data;
            });

        // create and initialize the searcher
        this._searcher = new Searcher(this.fulltextIndexBaseURL, this.fstIndexBaseURL, this._words)
        this._searcher.init();
    }

    get _searchStringInput() {
        return this.renderRoot?.querySelector("sl-input");
    }

    get _searchResultContainer() {
        return this.renderRoot?.querySelector("div#search-result-items");
    }

    get _suggestionListsContainer() {
        return this.renderRoot?.querySelector("div#suggestion-lists-container");
    }

    get _suggestionListContent() {
        return this.renderRoot?.querySelector("div#suggestion-lists-contents");
    }

    get _paginationToolbar() {
        return this.renderRoot?.querySelector("sc-pagination-toolbar");
    }

    get _progressBar() {
        return this.renderRoot?.querySelector("sl-progress-bar");
    }

    createRenderRoot() {
        const root = super.createRenderRoot();

        root.addEventListener("click", (event) => {
            const target = event.target;

            if (target.matches("div.suggestion")) {
                target
                    .parentNode
                    .querySelectorAll("div.suggestion")
                    .forEach((suggestionElement) => suggestionElement.classList.remove("suggestion-selected")
                    );
                target.classList.add("suggestion-selected");
            }
        });

        root.addEventListener("sc-pagination-toolbar:page-changed", async (event) => {
            let newPage = event.detail.newPage;

            await this._displaySearchResultsPage(newPage);

            this._progressBar.style.display = "none";
        });

        root.addEventListener("sc-pagination-toolbar:page-to-be-changed", (event) => {
            this._progressBar.style.display = "inline";
        });

        return root;
    }

    render() {
        return html`
            <div>
                <div id="search-input-container">
                    <sl-input placeholder="Enter search string..." clearable value=""></sl-input>
                    <sl-button id="exact-search" @click="${this._simpleFuzzySearch}" variant="default" outline>Search</sl-button>
                </div>
                <div id="suggestion-lists-container">
                    <div id="suggestion-lists-toolbar">
                        <header>Suggestion lists (one list for each search term; select suggestions in desired combinations, and press the <i>Search by suggestions</i> button)</header>
                        <sl-button id="search" @click="${this._searchBySuggestions}" variant="default" outline>Search by suggestions</sl-button>
                    </div>
                    <div id="suggestion-lists-contents"></div>
                </div>
                <div id="search-result-container">
                    <div id="search-result-toolbar">
                        <output .value=${this._matchingDocumentNumber !== null ? this._matchingDocumentNumber + ' results' : "0 results"}></header>
                    </div>
                    <sc-pagination-toolbar page="1" total="${this._matchingDocumentNumber !== null ? this._matchingDocumentNumber : 1}" limit="${this.paginationLimit}"></sc-pagination-toolbar>
                    <sl-progress-bar style="--height: 6px;" indeterminate></sl-progress-bar>
                    <div id="search-result-items"></div>                
                </div>
            </div>        
        `;
    }
    _simpleFuzzySearch = async () => {
        // reset the searcher
        this._searcher.reset();

        // reset form controls
        this._progressBar.style.display = "inline";
        this._paginationToolbar.page = 1;
        this._searchResultContainer.innerHTML = "";
        this._suggestionListContent.innerHTML = "";

        // process the search string (currently, only by tokenisation)
        let searchStringTokens = this._searchStringInput.value.trim().split(" ");

        // execute the exact search and get the matching IDs
        this._searcher.setTerms(searchStringTokens);
        await this._searcher.executeSimpleFuzzySearch();

        // case when all the search strings exist
        if (this._searcher.allExactMatches) {
            let exactMatchingDocumentIDs = [];
            let suggestionStructures = new Map();
            this._searcher.termStructures.forEach((termStructure) => {
                if (termStructure.isExactMatch) {
                    exactMatchingDocumentIDs.push(termStructure.simple_fuzzy_suggestions.get(termStructure.term));
                    suggestionStructures.set(termStructure.term, termStructure.simple_fuzzy_suggestions);
                }
            });
            this._matchingDocumentIDs = this._intersectIDs(exactMatchingDocumentIDs);
            this._matchingDocumentNumber = this._matchingDocumentIDs.length;

            // display the paginated search results
            await this._displaySearchResultsPage(1);

            // display the suggestions
            this._displaySuggestions(suggestionStructures);
        } else {
            for (let token of Array.from(this._searcher.fuzzyMatches.keys())) {
                // calculate the ngrams
                let ngrams = this._getNGrams(token, 2, "_");

                // get the word IDs for the calculated ngrams
                let resultWordIDs = new Map();
                for (let ngram of ngrams) {
                    let wordIDs = await fetch(new URL(`${this.ngramIndexBaseURL}/${ngram}.json`), {
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
                        resultWordIDs.set(ngram, wordIDs);
                    }
                }

                // generate the combinations of ngrams, based on the ngram similarity threshold
                let commonNGramsNumber = this._ngram_similarity_threshold * ngrams.length;
                if (commonNGramsNumber - Math.trunc(commonNGramsNumber) < 0.5) {
                    commonNGramsNumber = Math.trunc(commonNGramsNumber);
                } else {
                    commonNGramsNumber = Math.round(commonNGramsNumber);
                }

                let resultWordIDsCombinations = k_combinations(Array.from(resultWordIDs.keys()), commonNGramsNumber);

                // get the words having combinations of ngrams that were found
                let resultWords = [];
                console.time("words");
                for (let resultWordIDsCombination of resultWordIDsCombinations) {
                    resultWordIDsCombination = resultWordIDsCombination.map(item => resultWordIDs.get(item));

                    let processedResultWordIDs = this._intersectIDs(resultWordIDsCombination);
                    if (processedResultWordIDs.length > 0) {
                    }

                    resultWords = resultWords.concat(processedResultWordIDs);
                    //console.debug(resultWords);
                }
                resultWords = resultWords.map(item => this._words[item]);
                resultWords = Array.from(new Set(resultWords));
                console.timeEnd("words");
                console.log(resultWords);
            }
            // case when not all the search strings exist

        }
    }

    _searchBySuggestions = async () => {
        let selectedSuggestions = [...this._suggestionListContent
            .querySelectorAll("div.suggestion-selected")]
            .map((selectedSuggestion) => selectedSuggestion.textContent.toLowerCase())
            .filter(Boolean);
        let selectedSuggestionsNumber = selectedSuggestions.length;

        let commonInvertedIndexes = [];
        let firstSelectedSuggestion = null;
        let secondSelectedSuggestion = null;

        // successive lookup for inverted indexes
        switch (selectedSuggestionsNumber) {
            // case with one selected suggestions
            case 1:
                let selectedSuggestion = selectedSuggestions[0];
                commonInvertedIndexes = await fetch(new URL(`${this.fulltextIndexBaseURL}/${this._calculateRelativeURL(selectedSuggestion)}`), {
                    mode: "cors",
                })
                    .then(response => response.json());
                break;
            // case with two selected suggestions
            case 2:
                firstSelectedSuggestion = selectedSuggestions[0];
                secondSelectedSuggestion = selectedSuggestions[1];
                commonInvertedIndexes = await this._intersectTwoArraysPromises([
                    fetch(new URL(`${this.fulltextIndexBaseURL}/${this._calculateRelativeURL(firstSelectedSuggestion)}`), {
                        mode: "cors",
                    })
                        .then(response => response.json()),
                    fetch(new URL(`${this.fulltextIndexBaseURL}/${this._calculateRelativeURL(secondSelectedSuggestion)}`), {
                        mode: "cors",
                    })
                        .then(response => response.json())
                ]);
                break;
            // case with at least three selected suggestions
            default:
                firstSelectedSuggestion = selectedSuggestions[0];
                secondSelectedSuggestion = selectedSuggestions[1];
                commonInvertedIndexes = await this._intersectTwoArraysPromises([
                    fetch(new URL(`${this.fulltextIndexBaseURL}/${this._calculateRelativeURL(firstSelectedSuggestion)}`), {
                        mode: "cors",
                    })
                        .then(response => response.json()),
                    fetch(new URL(`${this.fulltextIndexBaseURL}/${this._calculateRelativeURL(secondSelectedSuggestion)}`), {
                        mode: "cors",
                    })
                        .then(response => response.json())
                ]);

                for (let i = 2; i < selectedSuggestionsNumber; i++) {
                    let ithSelectedSuggestion = selectedSuggestions[i];
                    commonInvertedIndexes = await this._intersectTwoArraysPromises([
                        commonInvertedIndexes,
                        fetch(new URL(`${this.fulltextIndexBaseURL}/${this._calculateRelativeURL(ithSelectedSuggestion)}`), {
                            mode: "cors",
                        })
                            .then(response => response.json())
                    ]);
                }
        }

        this._matchingDocumentIDs = commonInvertedIndexes;
        this._matchingDocumentNumber = this._matchingDocumentIDs.length;

        // display the paginated search results
        this._paginationToolbar.page = 1;
        this._paginationToolbar.total = 0;
        await this._displaySearchResultsPage(1);      
    }

    async _displaySearchResultsPage(newPageNumber) {
        let startIndex = (newPageNumber - 1) * this.paginationLimit;
        let endIndex = newPageNumber * this.paginationLimit;
        let currentPageDocumentIDs = this._matchingDocumentIDs.slice(startIndex, endIndex);

        // generate the HTML string with the results on the current page
        let searchResultHTMLString = "";
        let currentPageDocumentIDsIndex = 0;
        for (let currentPageDocumentID of currentPageDocumentIDs) {
            let documentRelativeIRI = this._documentRelativeIRIs[currentPageDocumentID];
            let textURL = new URL(documentRelativeIRI, this.documentsBaseIRI);
            let text = await fetch(textURL).then((response) => response.text(), {
                mode: "cors",
            });

            let resultHTMLString = this._resultItemTemplate({
                currentPageDocumentID,
                "index": startIndex + 1 + currentPageDocumentIDsIndex,
                documentRelativeIRI,
                text
            });
            searchResultHTMLString += resultHTMLString;

            currentPageDocumentIDsIndex++;
        }

        this._searchResultContainer.innerHTML = searchResultHTMLString;
    }

    /**
     * @param {Array.<Map>} suggestionStructures
     */
    _displaySuggestions(suggestionStructures) {
        // initialize the DOMString for suggestions
        let suggestionsDOMString = "";

        // generate the form controls for suggestions
        for (let suggestionStructure of suggestionStructures) {
            let term = suggestionStructure[0];
            let suggestions = Array.from(suggestionStructure[1].keys());

            suggestionsDOMString += this._suggestionListTemplate(suggestions.map(suggestion => this._suggestionTemplate({term, suggestion})).join(""));
        }

        this._suggestionListContent.insertAdjacentHTML("beforeend", suggestionsDOMString);

        this._suggestionListsContainer.style.display = "inline";
    }

    _suggestionTemplate = (data) => {
        let classValue = "suggestion";
        if (data.term === data.suggestion) {
            classValue += " suggestion-selected";
        }
        return `<div class="${classValue}">${data.suggestion}</div>`;
    }

    _suggestionListTemplate = (data) => `<div class="suggestion-list">${data}</div>`

    _resultItemTemplate = (data) =>
        `<div class="result-item">
            <div class="result-item-toolbar">${data.index}. ${data.documentRelativeIRI.split("-")[0]}</div>
            <div class="result-item-content">${data.text}</div>
        </div>
        `

    _intersectTwoArraysPromises = async (promises) => {
        const [aPromise, bPromise] = await Promise.allSettled(promises);

        let result = [];
        let a = aPromise.value;
        let b = bPromise.value;

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

    _intersectTwoArrays = (arrays) => {
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

    _intersectIDs = (idSets) => {
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
                commonIDs = this._intersectTwoArrays([
                    firstSet,
                    secondSet
                ]);
                break;
            // case with at least three selected suggestions
            default:
                firstSet = idSets[0];
                secondSet = idSets[1];
                commonIDs = this._intersectTwoArrays([
                    firstSet,
                    secondSet
                ]);

                for (let i = 2; i < setsNumber; i++) {
                    let ithSelectedSuggestion = idSets[i];
                    commonIDs = this._intersectTwoArrays([
                        commonIDs,
                        ithSelectedSuggestion
                    ]);
                }
        }

        return commonIDs;
    }

    _calculateRelativeURL = (token) => {
        let firstCharacter = token.slice(0, 1);
        let suggestionRelativeURL = firstCharacter + "/";

        let secondCharacter = token.slice(1, 2);
        if (secondCharacter !== "") {
            suggestionRelativeURL = suggestionRelativeURL + secondCharacter;
        }

        return `${suggestionRelativeURL}/${token}.json`;
    }

    _getNGrams = (s, len, paddingToken) => {
        s = paddingToken.repeat(len - 1) + s.toLowerCase() + paddingToken.repeat(len - 1);
        let v = new Array(s.length - len + 1);
        for (let i = 0; i < v.length; i++) {
            v[i] = s.slice(i, i + len);
        }

        return v;
    }
}

window.customElements.define("multiple-indexes-searcher", MultipleIndexesSearcher);

// tattvacintam