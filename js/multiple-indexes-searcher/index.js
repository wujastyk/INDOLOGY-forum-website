import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";
import { LitElement, css, html } from "https://cdn.jsdelivr.net/npm/lit/+esm";

export default class MultipleIndexesSearcher extends LitElement {
    static properties = {
        indexBaseURL: { attribute: "index-base-url" },
        _searchResultItemsNumber : {state: true},
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
        div#search-result-toolbar {
            background-color: #cac4f5;
        }
    `;

    constructor() {
        super();
        this._searchResultItemsNumber = null;
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

        return root;
    }

    render() {
        return html`
            <div>
                <div id="search-input-container">
                    <sl-input placeholder="Enter search string..." clearable value="Sanskrit verse similar"></sl-input>
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
                        <output .value=${this._searchResultItemsNumber !== null ? this._searchResultItemsNumber : ""}></header>
                    </div>
                    <div id="search-result-items"></div>                
                </div>
            </div>        
        `;
    }
    _executeExactSearch = async () => {
        let exactMatches = new Map();
        let exactMatchesCounter = 0;

        // tokenize the search string
        let searchStringTokens = this.renderRoot?.querySelector("sl-input").value.split(" ");
        let searchStringTokenNumber = searchStringTokens.length;

        // get document id-s
        for (let searchStringToken of searchStringTokens) {
            searchStringToken = searchStringToken.toLowerCase();

            let documentIDs = await fetch(new URL(`${this.indexBaseURL}/${this._calculateRelativeURL(searchStringToken)}`))
                .then(async response => {
                    if (response.status === 200) {
                        return response.json();
                    }
                });

            exactMatches.set(searchStringToken, documentIDs);
            exactMatchesCounter += 1;
        }

        if (searchStringTokenNumber === exactMatchesCounter) {
            let commonDocumentIDs = this._intersectDocumentIDs(Array.from(exactMatches.values()));

            let searchResultContainer = this.renderRoot?.querySelector("div#search-result-items");
            searchResultContainer.innerHTML = "";
            let searchResultHTMLString = commonDocumentIDs.map((docId) => {
                return this.resultItemTemplate(docId);
            }).join("");

            this._searchResultItemsNumber = `${commonDocumentIDs.length} entries`;
            searchResultContainer.innerHTML = searchResultHTMLString;
        } else {

        }

        console.log(exactMatches);

        let suggestionListContent = this.renderRoot?.querySelector("div#suggestion-lists-content");
        suggestionListContent.innerHTML = "";

        // generate the form controls for suggestions
        searchStringTokens.forEach(token => {
            let suggestions = [token, token, token];

            let suggestionsHTMLString = suggestions.map(suggestion => this.suggestionTemplate(suggestion)).join("");
            suggestionsHTMLString = this.suggestionListTemplate(suggestionsHTMLString);

            suggestionListContent.insertAdjacentHTML("beforeend", suggestionsHTMLString);

            suggestionListContent.hidden = false;
        });

        // select the first suggestion from each list
        suggestionListContent
            .querySelectorAll("div.suggestion-list > div.suggestion:first-of-type")
            .forEach((suggestionElement) => suggestionElement.classList.add("suggestion-selected")
            );
    }

    _getSearchResults = async () => {
        let suggestionListContent = this.renderRoot?.querySelector("div#suggestion-lists-content");

        let selectedSuggestions = [...suggestionListContent
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

        let searchResultContainer = this.renderRoot?.querySelector("div#search-result-container");
        searchResultContainer.innerHTML = "";
        let searchResultHTMLString = commonInvertedIndexes.map((docId) => {
            return this.resultItemTemplate(docId);
        }).join("");
        searchResultContainer.innerHTML = searchResultHTMLString;


        // other types of lookups for inverted indexes        
    }

    suggestionTemplate = (data) => `<div class="suggestion">${data}</div>`

    suggestionListTemplate = (data) => `<div class="suggestion-list">${data}</div>`

    resultItemTemplate = (data) => `<div class="result-item">${data}</div>`

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
