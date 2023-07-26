import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";
import { LitElement, css, html } from "https://cdn.jsdelivr.net/npm/lit/+esm";
import "https://solirom.gitlab.io/web-components/pagination-toolbar/index.js";
import Searcher from "./searcher.js";

export default class MultipleIndexesSearcher extends LitElement {
    static properties = {
        /** Base URL for the exact index for words. */
        fulltextIndexBaseURL: {
            attribute: "fulltext-index-base-url"
        },
        /** URL for the FST index for terms. */
        termsFSTmapURL: {
            attribute: "terms-fst-map-url"
        },
        /** URL for the JSON static index for terms. */
        termsJSONstaticURL: {
            attribute: "terms-json-static-url"
        },        
        /** Base URL for the ngram index for words. */
        ngramIndexBaseURL: {
            attribute: "ngram-index-base-url"
        },
        /** The threshold for the ngrams similarity. */
        _ngram_similarity_threshold: {
            type: Number,
            attribute: "ngram-similarity-threshold"
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
        /** The list of words, for lookup by word's index in list. */
        _words: {
            type: Array,
        },
        /** The FST index. */
        _fstIndex: {
            type: Array,
        },
        /** The FST searcher */
        _fstSearcher: {
            type: Object,
        },
        /** The flags for search types */
        _searchTypes: {
            state: true,
            type: Object,
        },
        /** The flag for proximity search */
        _isProximitySearch: {
            type: Boolean,
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
        div#search-types-container {
            display: flex;
            gap: 20px;
            justify-content: space-evenly;
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
            padding: 5px;
            font-size: 14px;
        }
        div#suggestion-lists-toolbar > header {
            display: flex;            
            justify-content: space-around;
            align-items: center;            
        }        
        div#suggestion-lists-contents {
            height: 170px;
            display: flex;
            justify-content: center;
            gap: 7px;
            overflow: scroll; 
        } 
        div.suggestion-list {
            width: 120px;
        }
        div.suggestion {
            margin: 3px 0;
            padding: 2px;
            overflow-wrap: break-word;
            border-bottom: solid 1px black;
        }
        div.suggestion:hover {
            background-color: #0284c7;
            color: #ffffff;
        }
        div.suggestion-selected {
            background-color: #0284c7;
            color: #ffffff;
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
        this._ngram_similarity_threshold = 0.4;
        this._words = [];

        // Variables for the FST index
        this._fstIndex = [];

        // Variables for the global searcher
        this._searcher = {};

        // flags
        this._isProximitySearch = false;
        this._searchTypes = {
            "prefix": false,
            "levenstein_1": false,
            "levenstein_2": false,
            "ngram": false,
        };

        // add event listeners
        this.addEventListener("sl-change", (event) => this._toggleSearchTypes(event));
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
        await fetch(new URL("index.json", this.termsJSONstaticURL), {
            mode: "cors",
        })
            .then(response => response.json())
            .then(async data => {
                this._words = data;
            });

        // create and initialize the searcher
        this._searcher = new Searcher(this.fulltextIndexBaseURL, this.termsFSTmapURL, this.ngramIndexBaseURL, this._ngram_similarity_threshold, this._words)
        this._searcher.init();

        // initialize the mark resolver
        this._markInstance = new Mark(this.renderRoot?.querySelector("div#search-result-items"));
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

            await this._displaySearchResultsPage(newPage, this._searcher.markTerms);

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
                    <sl-button id="exact-search" @click="${this._search}" variant="default" outline>Search</sl-button>
                </div>
                <div id="search-types-container">
                    <label>Search types:</label>
                    <sl-checkbox value="exact" disabled checked>exact</sl-checkbox>
                    <sl-checkbox value="prefix">prefix</sl-checkbox>
                    <sl-checkbox value="levenstein_1">Levenstein, 1 letter</sl-checkbox>
                    <sl-checkbox value="levenstein_2">Levenstein, 2 letters</sl-checkbox>
                    <sl-checkbox value="ngram">ngram</sl-checkbox>
                </div>
                <sl-progress-bar style="--height: 6px;" indeterminate></sl-progress-bar>
                <div id="suggestion-lists-container">
                    <div id="suggestion-lists-toolbar">
                        <header>
                            <span>Suggestion lists (one list for each search term; select suggestions in desired combinations, and press the <i>Search by suggestions</i> button)</span>
                            <sl-button id="search" @click="${this._searchBySuggestions}" variant="default" outline>Search by suggestions</sl-button>
                        </header>
                    </div>
                    <div id="suggestion-lists-contents"></div>
                </div>
                <div id="search-result-container">
                    <div id="search-result-toolbar">
                        <output .value=${this._matchingDocumentNumber !== null ? this._matchingDocumentNumber + " results" : "0 results"}></header>
                    </div>
                    <sc-pagination-toolbar page="1" total="${this._matchingDocumentNumber !== null ? this._matchingDocumentNumber : 1}" limit="${this.paginationLimit}"></sc-pagination-toolbar>
                    <div id="search-result-items"></div>                
                </div>
            </div>        
        `;
    }
    _search = async () => {
        // some initializations

        // reset the searcher
        this._searcher.reset();

        // reset form controls
        this._progressBar.style.display = "inline";
        this._paginationToolbar.page = 1;
        this._searchResultContainer.innerHTML = "";
        this._suggestionListContent.innerHTML = "";

        // get the search string
        let searchString = this._searchStringInput.value.trim();

        // test if this is a proximity search
        //if ((searchString.startsWith("\"") && searchString.endsWith("\"")) || searchString.contains(("NEAR/"))) {
            //this._isProximitySearch = true;
        //}
        //console.log(this._isProximitySearch);
        //console.log(searchString);

        // process the search string (currently, only by tokenisation)
        searchString = searchString.replaceAll("\"", "");
        let searchStringTokens = searchString.split(" ");



        // execute the selected searches and get the matching IDs
        this._searcher.terms = searchStringTokens;
        await this._searcher.executeSearch(this._searchTypes);

        // case when there exist an exact match for each search string
        if (this._searcher.allExactMatches) {
            let exactMatchingDocumentIDs = [];
            this._searcher.termStructures.forEach((termStructure) => {
                exactMatchingDocumentIDs.push([...termStructure.suggestions.get(termStructure.term)]);
            });
            this._matchingDocumentIDs = this._searcher._intersectIDs(exactMatchingDocumentIDs);

            this._matchingDocumentNumber = this._matchingDocumentIDs.length;

            // display the paginated search results
            await this._displaySearchResultsPage(1, this._searcher.markTerms);

            // if it is any fuzzy search, display the suggestions
            if (this._searcher.isFuzzySearch) {
                let suggestionStructures = new Map();
                this._searcher.termStructures.forEach((termStructure) => {
                    suggestionStructures.set(termStructure.term, termStructure.suggestions);
                });
    
                this._displaySuggestions(suggestionStructures);
            }
        } else {

        }
    }

    _toggleSearchTypes = (event) => {
        let target = event.originalTarget;
        let value = target.value;
        let checked = target.checked;

        this._searchTypes[value] = checked;
    }

    _searchBySuggestions = async () => {
        this._progressBar.style.display = "inline";
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
                console.log();
                commonInvertedIndexes = await fetch(new URL(this._calculateRelativeURL(selectedSuggestion), this.fulltextIndexBaseURL), {
                    mode: "cors",
                })
                    .then(response => response.json());
                break;
            // case with two selected suggestions
            case 2:
                firstSelectedSuggestion = selectedSuggestions[0];
                secondSelectedSuggestion = selectedSuggestions[1];
                commonInvertedIndexes = await this._intersectTwoArraysPromises([
                    fetch(new URL(this._calculateRelativeURL(firstSelectedSuggestion), this.fulltextIndexBaseURL), {
                        mode: "cors",
                    })
                        .then(response => response.json()),
                    fetch(new URL(this._calculateRelativeURL(secondSelectedSuggestion), this.fulltextIndexBaseURL), {
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
                    fetch(new URL(this._calculateRelativeURL(firstSelectedSuggestion), this.fulltextIndexBaseURL), {
                        mode: "cors",
                    })
                        .then(response => response.json()),
                    fetch(new URL(this._calculateRelativeURL(secondSelectedSuggestion), this.fulltextIndexBaseURL), {
                        mode: "cors",
                    })
                        .then(response => response.json())
                ]);

                for (let i = 2; i < selectedSuggestionsNumber; i++) {
                    let ithSelectedSuggestion = selectedSuggestions[i];
                    commonInvertedIndexes = await this._intersectTwoArraysPromises([
                        commonInvertedIndexes,
                        fetch(new URL(this._calculateRelativeURL(ithSelectedSuggestion), this.fulltextIndexBaseURL), {
                            mode: "cors",
                        })
                            .then(response => response.json())
                    ]);
                }
        }
        
        this._matchingDocumentIDs = Object.keys(commonInvertedIndexes);
        this._matchingDocumentNumber = this._matchingDocumentIDs.length;

        // display the paginated search results
        this._paginationToolbar.page = 1;
        this._paginationToolbar.total = 0;
        this._searcher.markTerms = selectedSuggestions;
        await this._displaySearchResultsPage(1, this._searcher.markTerms);
    }

    async _displaySearchResultsPage(newPageNumber, terms) {
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
            text = text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");

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

        // highlight the search results
        this._markInstance.mark(terms, {
            "accuracy": {
                "value": "exactly",
                "limiters": [
                    '„', '“',
                    // punctuation-regex › regex101
                    // https://www.npmjs.com/package/punctuation-regex
                    '-', '‒', '–', '—', '―', '|', '$', '&', '~', '=',
                    '\\', '/', '⁄', '@', '+', '*', '!', '?', '(', '{', '[', ']',
                    '}', ')', '<', '>', '‹', '›', '«', '»', '.', ';', ':', '^',
                    '‘', '’', '“', '”', "'", '"', ',', '،', '、', '`', '·', '•',
                    '†', '‡', '°', '″', '¡', '¿', '※', '#', '№', '÷', '×', '%',
                    '‰', '−', '‱', '¶', '′', '‴', '§', '_', '‖', '¦',
                ],
            },
        });
    }

    /**
     * @param {Array.<Map>} suggestionStructures
     */
    _displaySuggestions(suggestionStructures) {
        // initialize the container
        this._suggestionListContent.innerHTML = "";

        // initialize the DOMString for suggestions
        let suggestionsDOMString = "";

        // generate the form controls for suggestions
        for (let suggestionStructure of suggestionStructures) {
            let term = suggestionStructure[0];
            let suggestions = Array.from(suggestionStructure[1].keys());

            suggestionsDOMString += this._suggestionListTemplate(suggestions.map(suggestion => this._suggestionTemplate({ term, suggestion })).join(""));
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

    _calculateRelativeURL = (token) => {
        let firstCharacter = token.slice(0, 1);
        let suggestionRelativeURL = firstCharacter + "/";

        let secondCharacter = token.slice(1, 2);
        if (secondCharacter !== "") {
            suggestionRelativeURL = suggestionRelativeURL + secondCharacter;
        }

        return `${suggestionRelativeURL}/${token}.json`;
    }
}

window.customElements.define("multiple-indexes-searcher", MultipleIndexesSearcher);

// tattvacintam