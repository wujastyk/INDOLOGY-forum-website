import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";
import { LitElement, css, html } from "https://cdn.jsdelivr.net/npm/lit/+esm";
import "https://solirom.gitlab.io/web-components/pagination-toolbar/index.js";
import Searcher from "./searcher.js";
import "../query-string-parser/query-string-parser.js";

export default class MultipleIndexesSearcher extends LitElement {
    static properties = {
        /** The URL for the documentation. */
        documentationURL: {
            attribute: "documentation-url"
        },        
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
        /** Base URL for the raw documents. */
        rawDocumentsBaseURL: {
            attribute: "raw-documents-base-url"
        },
        /** Per-page limit of the elements. */
        paginationLimit: {
            type: Number,
            reflect: true,
            attribute: "pagination-limit"
        },
        /** The search ID */
        _searchTerms: {
            hasChanged(newVal, oldVal) {
                return newVal?.toLowerCase() !== oldVal?.toLowerCase();
            }
        },
        /** The list with document relative IRIs */
        _documentRelativeIRIs: {
            type: Array,
        },
        /** The list of IDs of the matching documents, resulted after intersections of ID lists for words. */
        _matchingDocumentIDs: {
            type: Array,
        },
        /** The list of positions of the matching documents, resulted after intersections of ID lists for words. */
        _matchingDocumentPositions: {
            type: Map,
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
    };

    static styles = css`
        :host(*) > div {
            display: flex;
            flex-direction: column; 
            gap: 5px;
            align-items: center; 
        }            
        div#search-input-container {
            width: var(--sc-width, 60vw);
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
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
            width: var(--sc-width, 60vw);
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
        /* small screen sizes */
        @media only screen and (max-width: 664px) {
            div#search-input-container {
                width: 90vw;
                align-items: center;
            } 
            div#search-types-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-evenly;
                gap: 1px;
            } 
            div#search-result-container {
                width: 95vw;
            }                                            
        }
        @media only screen and (max-width: 835px) {
            div#search-input-container {
                width: 90vw;
                align-items: center;
            } 
            div#search-types-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-evenly;
                gap: 1px;
            } 
            div#search-result-container {
                width: 95vw;
            }                                            
        }                 
    `;

    constructor() {
        super();

        this._matchingDocumentNumber = 0;
        this._matchingDocumentIDs = [];
        this._matchingDocumentPositions = new Map();

        // Variables for the NGram index
        this._ngram_similarity_threshold = 0.7;
        this._words = [];

        // Variables for the FST index
        this._fstIndex = [];

        // Variables for the global searcher
        this._searcher = {};

        // flags
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

        // open the documentation page
        this.renderRoot?.querySelector("sl-button#open-documentation").addEventListener("click", () => window. open(this.documentationURL, "_blank"));
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
                    <sl-button id="exact-search" @click="${this._search}" variant="default" outline>Search</sl-button>
                    <sl-button id="open-documentation">Help</sl-button>
                </div>
                <div id="search-types-container">
                    <label>Search types:</label>
                    <sl-checkbox value="exact" disabled checked>exact</sl-checkbox>
                    <sl-checkbox value="prefix">prefix</sl-checkbox>
                    <sl-checkbox value="levenstein_1">one difference</sl-checkbox>
                    <sl-checkbox value="levenstein_2">two differences</sl-checkbox>
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
                        <output>${this._displaySearchResultStatement()}</output>
                    </div>
                    <sc-pagination-toolbar page="1" total="${this._matchingDocumentNumber !== null ? this._matchingDocumentNumber : 1}" limit="${this.paginationLimit}" size="1"></sc-pagination-toolbar>
                    <div id="search-result-items"></div>                
                </div>
            </div>        
        `;
    }
    _search = async () => {
        // some initializations
        this._progressBar.style.display = "inline";

        // resets
        this._reset();
        this._searcher.reset();
        this._paginationToolbar.reset();
        this._resetSuggestionList();
        this._searchResultContainer.innerHTML = "";

        // get the search string
        let searchString = this._searchStringInput.value.toLowerCase().trim();

        // generate the search string abstract syntax tree
        let searchStringAST = queryStringParser.parse(searchString);
        this._searcher.searchStringAST = searchStringAST;

        // execute the selected searches and get the matching IDs
        await this._searcher.executeSearch(this._searchTypes);

        // case when there exist an exact match for each search string
        if (this._searcher.allExactMatches) {

            this._matchingDocumentPositions = this._searcher.intersect();
            this._matchingDocumentIDs = Array.from(this._matchingDocumentPositions.keys());
            this._matchingDocumentNumber = this._matchingDocumentIDs.length;

            // display the paginated search results
            await this._displaySearchResultsPage(1);

            // if it is any fuzzy search, display the suggestions
            if (this._searcher.isFuzzySearch) {
                let suggestionStructures = new Map();
                this._searcher.termAndOperatorsStructures.forEach((termStructure) => {
                    suggestionStructures.set(termStructure.term, termStructure.suggestions);
                });

                this._displaySuggestions(suggestionStructures);
            }
        } else {
            let suggestionStructures = new Map();
            this._searcher.termAndOperatorsStructures
                .filter(item => item.hasOwnProperty("term"))
                .forEach((termStructure) => {
                    suggestionStructures.set(termStructure.term, termStructure.suggestions);
                });

            this._displaySuggestions(suggestionStructures);

            this.requestUpdate("_matchingDocumentNumber");
        }
    }

    _toggleSearchTypes = (event) => {
        let target = event.originalTarget;
        let value = target.value;

        if (value === "levenstein_1" || value === "levenstein_2") {
            let targetParent = target.parentNode;
            let other_levenstein_value = (value === "levenstein_1") ? "levenstein_2" : "levenstein_1";
            let other_levenstein_checkbox = targetParent.querySelector(`sl-checkbox[value = ${other_levenstein_value}]`)

            this._searchTypes[value] = false;
            other_levenstein_checkbox.checked = false;
        }

        let checked = target.checked;
        this._searchTypes[value] = checked;
    }

    _searchBySuggestions = async () => {
        this._progressBar.style.display = "inline";

        let selected_suggestions = [...this._suggestionListContent
            .querySelectorAll("div.suggestion-selected")]
            .map((selectedSuggestion) => selectedSuggestion.textContent.toLowerCase())
            .filter(Boolean);
        let selectedSuggestionsNumber = selected_suggestions.length;

        const promises = this._searcher.termAndOperatorsStructures
            .filter(item => item.hasOwnProperty("term"))
            .map(async (termStructure, index) => {
                // process only the suggestions
                let selected_suggestion = selected_suggestions[index];
                let current_term = termStructure.term;
                if (selected_suggestion !== current_term) {
                    // fetch the positional index record, if it is not fetched already
                    let current_positional_index_record = termStructure.suggestions.get(selected_suggestion);
                    if (current_positional_index_record.length === 0) {
                        let positional_index_record = await this._searcher._fetchPositionalIndexRecord(this._searcher._words.indexOf(selected_suggestion));
                        
                        termStructure.suggestions.set(selected_suggestion, positional_index_record);
                    }

                    termStructure.selected_suggestion = selected_suggestion;
                }
            });

        await Promise.all(promises);

        this._matchingDocumentPositions = this._searcher.intersect();
        this._matchingDocumentIDs = Array.from(this._matchingDocumentPositions.keys());
        this._matchingDocumentNumber = this._matchingDocumentIDs.length;

        // display the paginated search results
        this._paginationToolbar.reset();
        this._searcher.termsToHighlight = selected_suggestions;
        console.log(this._searcher.termsToHighlight);
        await this._displaySearchResultsPage(1);
    }

    async _displaySearchResultsPage(newPageNumber) {
        let matchingDocumentIDs = this._matchingDocumentIDs;
        this._searchResultContainer.innerHTML = "";

        if (matchingDocumentIDs.length !== 0) {
            let startIndex = (newPageNumber - 1) * this.paginationLimit;
            let endIndex = newPageNumber * this.paginationLimit;
            let currentPageDocumentIDs = matchingDocumentIDs.slice(startIndex, endIndex);

            // generate the HTML string with the results on the current page
            let currentPageDocumentIDsIndex = 0;
            let current_index = 0;
            for (let currentPageDocumentID of currentPageDocumentIDs) {
                // initialisations
                ++current_index;
                ++currentPageDocumentIDsIndex;
                let documentRelativeIRI = this._documentRelativeIRIs[currentPageDocumentID];

                // create the section for the document
                let textSectionHTMLString = this._resultItemTemplate({
                    currentPageDocumentID,
                    "index": startIndex + currentPageDocumentIDsIndex,
                    documentRelativeIRI,
                    "text": ""
                });
                this._searchResultContainer.insertAdjacentHTML("beforeend", textSectionHTMLString);
                let current_section_content_selector = this._searchResultContainer.querySelector(`div.result-item:nth-of-type(${current_index}) > div.result-item-content`);

                // get the text of the document
                let textURL = new URL(documentRelativeIRI, this.documentsBaseIRI);
                let text = await fetch(textURL).then((response) => response.text(), {
                    mode: "cors",
                });

                // tokenize the text by words
                let text_tokens = this._tokenizeToWords(text);

                // display the text
                text = text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
                current_section_content_selector.innerHTML = text;

                // generate the highlight ranges
                let positions = this._matchingDocumentPositions.get(currentPageDocumentID);
                let highlight_ranges = [];
                positions.forEach(position => {
                    let text_token = text_tokens[position];
                    let range = { "start": text_token.start, "length": text_token.length };
                    highlight_ranges.push(range);
                });

                // highlight the search results
                var instance = new Mark(current_section_content_selector);
                instance.markRanges(highlight_ranges);
            }
        }
    }

    /**
     * @param {Array.<Map>} suggestionStructures
     */
    _displaySuggestions(suggestionStructures) {
        // reset the container
        this._resetSuggestionList();

        // initialize the DOMString for suggestions
        let suggestionsDOMString = "";

        // generate the form controls for suggestions
        for (let suggestionStructure of suggestionStructures) {
            let term = suggestionStructure[0];
            let suggestions = Array.from(suggestionStructure[1].keys());

            suggestionsDOMString += this._suggestionListTemplate(suggestions.map(suggestion => this._suggestionTemplate({ term, suggestion, "suggestions_number": suggestions.length })).join(""));
        }

        this._suggestionListContent.insertAdjacentHTML("beforeend", suggestionsDOMString);

        this._suggestionListsContainer.style.display = "inline";
    }

    _displaySearchResultStatement() {
        if (this._matchingDocumentNumber !== 0) {
            return `${this._matchingDocumentNumber} results for ${this._searcher.termsToHighlight}`;
        } else {
            if (this._searcher.termsToHighlight !== null) {
                return `0 results for ${this._searcher.termsToHighlight}`;
            } else {
                return `0 results`;
            }
        }
    }

    _suggestionTemplate = (data) => {
        let classValue = "suggestion";
        if (data.term === data.suggestion || data.suggestions_number === 1) {
            classValue += " suggestion-selected";
        }

        return `<div class="${classValue}">${data.suggestion}</div>`;
    }

    _suggestionListTemplate = (data) => `<div class="suggestion-list">${data}</div>`

    _resultItemTemplate = (data) => {
        let rawDocumentURL = new URL(data.documentRelativeIRI, this.rawDocumentsBaseURL);

        return `<div class="result-item">
            <div class="result-item-toolbar">${data.index}. ${data.documentRelativeIRI.split("-")[0]} <a href="${rawDocumentURL}" target="_blank">full text</a></div>
            <div class="result-item-content">${data.text}</div>
        </div>
        `
    }

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

    _reset = () => {
        this._matchingDocumentNumber = 0;
        this._matchingDocumentIDs = [];
    }

    _resetSuggestionList = () => {
        this._suggestionListContent.innerHTML = "";
        this._suggestionListsContainer.style.display = "none";
    }

    _tokenizeToWords = (text) => {
        let WORD_BOUNDARY_CHARS = ["\t", "\r\n", "\u2000-\u206F", "\u2E00-\u2E7F",
            "\u00A0", " ", "!", "\"", "#", "$", "%", "&", "(", ")",
            "*", "+", ",", "\\-", ".", "\\/", ":", ";", "<", "=",
            ">", "@", "\\\\", "\[", "\\]", "^", "_", "`", "{", "|", "}", "~", "'"];
        let SPLIT_REGEX = new RegExp(`([^${WORD_BOUNDARY_CHARS.join()}]+)`);

        let tokens = text.split(SPLIT_REGEX).filter(Boolean);

        let startOffset = 0;
        let words = [];

        tokens.forEach(token => {
            let tokenLength = token.length;

            if (SPLIT_REGEX.test(token)) {
                words.push({ "word": token, "start": startOffset, "length": tokenLength });
            }
            startOffset += tokenLength;
        });

        return words;
    }


}

window.customElements.define("multiple-indexes-searcher", MultipleIndexesSearcher);
