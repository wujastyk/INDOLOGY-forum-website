import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";
import { LitElement, css, html } from "https://cdn.jsdelivr.net/npm/lit/+esm";
import "https://solirom.gitlab.io/web-components/pagination-toolbar/index.js";

export default class MultipleIndexesSearcher extends LitElement {
    static properties = {
        /** Base URL for words index. */
        indexBaseURL: {
            attribute: "index-base-url"
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
        /** The list of IDs of the documents, resulted after intersections of ID lists for words. */
        _resultDocumentIDs: {
            type: Array,
        },
        _searchResultItemsNumber: {
            state: true
        },
    };

    static styles = css`
        :host(*) > div {
            display: flex;
            flex-direction: column; 
            gap: 5px; 
        }            
        #search-input-container {
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
        }
        div#suggestion-lists-toolbar {
            display: flex;
            align-items: center;
            padding: 5px 0;
        }
        div#suggestion-lists-toolbar > header {
            font-size: 14px;
        }        
        div#suggestion-lists-content {
            display: flex;
            gap: 2px;
        } 
        div.suggestion-list {
            flex-grow: 1;
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

        this._searchResultItemsNumber = null;
        this._resultDocumentIDs = [];
    }

    async firstUpdated() {
        await fetch(this.documentRelativeIRIsURL)
            .then(r => r.json())
            .then(async data => {
                this._documentRelativeIRIs = data;
            });
    }

    get _searchStringInput() {
        return this.renderRoot?.querySelector("sl-input");
    }

    get _searchResultContainer() {
        return this.renderRoot?.querySelector("div#search-result-items");
    }

    get _suggestionListContent() {
        return this.renderRoot?.querySelector("div#suggestion-lists-content");
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

            await this._displayResultsPage(newPage);

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
                    <sl-button id="exact-search" @click="${this._executeExactSearch}" variant="default" outline>Search</sl-button>
                </div>
                <div id="suggestion-lists-container">
                    <div id="suggestion-lists-toolbar">
                        <header>Suggestion lists (one list for each search term; select suggestions in desired combinations, and press the Search button)</header>
                        <sl-button id="search" @click="${this._getSearchResults}" variant="default" outline>Fuzzy search</sl-button>
                    </div>
                    <div id="suggestion-lists-content"></div>
                </div>
                <div id="search-result-container">
                    <div id="search-result-toolbar">
                        <output .value=${this._searchResultItemsNumber !== null ? this._searchResultItemsNumber + ' results' : "0 results"}></header>
                    </div>
                    <sc-pagination-toolbar page="1" total="${this._searchResultItemsNumber !== null ? this._searchResultItemsNumber : 1}" limit="${this.paginationLimit}"></sc-pagination-toolbar>
                    <sl-progress-bar style="--height: 6px;" indeterminate></sl-progress-bar>
                    <div id="search-result-items"></div>                
                </div>
            </div>        
        `;
    }
    _executeExactSearch = async () => {
        this._progressBar.style.display = "inline";

        let exactMatches = new Map();
        let exactMatchesCounter = 0;

        // reset form controls
        this._paginationToolbar.page = 1;
        this._searchResultContainer.innerHTML = "";

        // tokenize the search string
        let searchStringTokens = this._searchStringInput.value.trim().split(" ");
        let searchStringTokenNumber = searchStringTokens.length;

        // get document id-s
        for (let searchStringToken of searchStringTokens) {
            searchStringToken = searchStringToken.toLowerCase();

            let documentIDs = await fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(searchStringToken)}`))
                .then(async response => {
                    if (response.status === 200) {
                        return response.json();
                    } else {
                        alert(`The term '${searchStringToken}' was not found by using exact search, which is the only one currently available. This means that either the term does not exist, or it is mispelled within the database. Fuzzy search is working on, to deal with the latter case.`);
                    }
                });

            exactMatches.set(searchStringToken, documentIDs);
            exactMatchesCounter += 1;
        }

        // case when all the search strings exist
        if (searchStringTokenNumber === exactMatchesCounter) {
            this._resultDocumentIDs = this._intersectDocumentIDs(Array.from(exactMatches.values()));
            this._searchResultItemsNumber = this._resultDocumentIDs.length;

            this._displayResultsPage(1);
        } else {
            // case when not all the search strings exist

        }

        //console.log(exactMatches);

        this._suggestionListContent.innerHTML = "";

        // generate the form controls for suggestions
        searchStringTokens.forEach(token => {
            let suggestions = [token, token, token];

            let suggestionsHTMLString = suggestions.map(suggestion => this.suggestionTemplate(suggestion)).join("");
            suggestionsHTMLString = this.suggestionListTemplate(suggestionsHTMLString);

            this._suggestionListContent.insertAdjacentHTML("beforeend", suggestionsHTMLString);

            this._suggestionListContent.hidden = false;
        });

        // select the first suggestion from each list
        this._suggestionListContent
            .querySelectorAll("div.suggestion-list > div.suggestion:first-of-type")
            .forEach((suggestionElement) => suggestionElement.classList.add("suggestion-selected")
            );
    }

    _getSearchResults = async () => {
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
                commonInvertedIndexes = await fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(selectedSuggestion)}/${selectedSuggestion}.json`))
                    .then(response => response.json());
                break;
            // case with two selected suggestions
            case 2:
                firstSelectedSuggestion = selectedSuggestions[0];
                secondSelectedSuggestion = selectedSuggestions[1];
                commonInvertedIndexes = await this._intersectTwoArraysPromises([
                    fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(firstSelectedSuggestion)}/${firstSelectedSuggestion}.json`))
                        .then(response => response.json()),
                    fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(secondSelectedSuggestion)}/${secondSelectedSuggestion}.json`))
                        .then(response => response.json())
                ]);
                break;
            // case with at least three selected suggestions
            default:
                firstSelectedSuggestion = selectedSuggestions[0];
                secondSelectedSuggestion = selectedSuggestions[1];
                commonInvertedIndexes = await this._intersectTwoArraysPromises([
                    fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(firstSelectedSuggestion)}/${firstSelectedSuggestion}.json`))
                        .then(response => response.json()),
                    fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(secondSelectedSuggestion)}/${secondSelectedSuggestion}.json`))
                        .then(response => response.json())
                ]);

                for (let i = 2; i < selectedSuggestionsNumber; i++) {
                    let ithSelectedSuggestion = selectedSuggestions[i];
                    commonInvertedIndexes = await this._intersectTwoArraysPromises([
                        commonInvertedIndexes,
                        fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(ithSelectedSuggestion)}/${ithSelectedSuggestion}.json`))
                            .then(response => response.json())
                    ]);
                }
        }

        this._searchResultContainer.innerHTML = "";
        let searchResultHTMLString = commonInvertedIndexes.map((docId) => {
            return this._resultItemTemplate(docId);
        }).join("");
        this._searchResultContainer.innerHTML = searchResultHTMLString;


        // other types of lookups for inverted indexes        
    }

    async _displayResultsPage(newPageNumber) {
        let startIndex = (newPageNumber - 1) * this.paginationLimit;
        let endIndex = newPageNumber * this.paginationLimit;
        let currentPageDocumentIDs = this._resultDocumentIDs.slice(startIndex, endIndex);

        // generate the HTML string with the results on the current page
        let searchResultHTMLString = "";
        let currentPageDocumentIDsIndex = 0;
        for (let currentPageDocumentID of currentPageDocumentIDs) {
            let documentRelativeIRI = this._documentRelativeIRIs[currentPageDocumentID];
            let textURL = new URL(documentRelativeIRI, this.documentsBaseIRI);
            let text = await fetch(textURL).then((response) => response.text());
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

    suggestionTemplate = (data) => `<div class="suggestion">${data}</div>`

    suggestionListTemplate = (data) => `<div class="suggestion-list">${data}</div>`

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

    _intersectDocumentIDs = (documentIDsets) => {
        let setsNumber = documentIDsets.length;
        let commonDocumentIDs = [];
        let firstSet = null;
        let secondSet = null;

        // successive lookup for inverted indexes
        switch (setsNumber) {
            // case with one selected suggestions
            case 1:
                commonDocumentIDs = documentIDsets[0];
                break;
            // case with two selected suggestions
            case 2:
                firstSet = documentIDsets[0];
                secondSet = documentIDsets[1];
                commonDocumentIDs = this._intersectTwoArrays([
                    firstSet,
                    secondSet
                ]);
                break;
            // case with at least three selected suggestions
            default:
                firstSet = documentIDsets[0];
                secondSet = documentIDsets[1];
                commonDocumentIDs = this._intersectTwoArrays([
                    firstSet,
                    secondSet
                ]);

                for (let i = 2; i < setsNumber; i++) {
                    let ithSelectedSuggestion = documentIDsets[i];
                    commonDocumentIDs = this._intersectTwoArrays([
                        commonDocumentIDs,
                        ithSelectedSuggestion
                    ]);
                }
        }

        return commonDocumentIDs;
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
