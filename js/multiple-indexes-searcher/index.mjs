import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";

export default class MultipleIndexesSearcher extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    const shadowRoot = this.shadowRoot;
    shadowRoot.innerHTML = `
        <style>
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
            hidden: true;
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
        </style>
        <div>
          <div id="search-input-container">
            <sl-input placeholder="Enter search string..." clearable value="Sanskrit verse similar"></sl-input>
            <sl-button id="suggestions" variant="default" outline>Search</sl-button>
          </div>
          <div id="suggestion-lists-container">
            <div id="suggestion-lists-toolbar">
              <header>Suggestion lists (one list for each search term; select suggestions in desired combinations, and press the Search button)</header>
              <sl-button id="search" variant="default" outline>Fuzzy search</sl-button>
            </div>
            <div id="suggestion-lists-content"></div>
          </div>
        </div>
    `;

    this.searchInput = shadowRoot.querySelector("sl-input");
    this.suggestionsButton = shadowRoot.querySelector("sl-button#suggestions");
    this.suggestionListContent = shadowRoot.querySelector("div#suggestion-lists-content");
    this.indexBaseURL = this.getAttribute("index-base-url");

    shadowRoot.addEventListener("click", async (event) => {
      const target = event.target;

      if (target.matches("sl-button#suggestions")) {
        this.suggestionListContent.innerHTML = "";

        // tokenize the search string
        let searchStringTokens = this.searchInput.value.split(" ");

        // generate the form controls for suggestions
        searchStringTokens.forEach(token => {
          let suggestions = [token, token, token];

          let suggestionsHTMLString = suggestions.map(suggestion => this.suggestionTemplate(suggestion)).join("");
          suggestionsHTMLString = this.suggestionListTemplate(suggestionsHTMLString);

          this.suggestionListContent.insertAdjacentHTML("beforeend", suggestionsHTMLString);

          this.suggestionListContent.hidden = false;
        });

        // select the first suggestion from each list
        this.suggestionListContent
          .querySelectorAll("div.suggestion-list > div.suggestion:first-of-type")
          .forEach((suggestionElement) => suggestionElement.classList.add("suggestion-selected")
        );
      }

      if (target.matches("div.suggestion")) {
        target
          .parentNode
          .querySelectorAll("div.suggestion")
          .forEach((suggestionElement) => suggestionElement.classList.remove("suggestion-selected")
          );
        target.classList.add("suggestion-selected");

      }

      if (target.matches("sl-button#search")) {
        let selectedSuggestions = [...this.suggestionListContent
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
            commonInvertedIndexes = await fetch(new URL(`${this.indexBaseURL}/${this.getRelativeURL(selectedSuggestion)}/${selectedSuggestion}.json`))
              .then(response => response.json());
          break;
          // case with two selected suggestions
          case 2:
            firstSelectedSuggestion = selectedSuggestions[0];
            secondSelectedSuggestion = selectedSuggestions[1];
            commonInvertedIndexes = await this.intersection_destructive([
              fetch(new URL(`${this.indexBaseURL}/${this.getRelativeURL(firstSelectedSuggestion)}/${firstSelectedSuggestion}.json`))
              .then(response => response.json()),
              fetch(new URL(`${this.indexBaseURL}/${this.getRelativeURL(secondSelectedSuggestion)}/${secondSelectedSuggestion}.json`))
              .then(response => response.json())
            ]);
          break;
          // case with at least three selected suggestions
          default:
            firstSelectedSuggestion = selectedSuggestions[0];
            secondSelectedSuggestion = selectedSuggestions[1];
            commonInvertedIndexes = await this.intersection_destructive([
              fetch(new URL(`${this.indexBaseURL}/${this.getRelativeURL(firstSelectedSuggestion)}/${firstSelectedSuggestion}.json`))
              .then(response => response.json()),
              fetch(new URL(`${this.indexBaseURL}/${this.getRelativeURL(secondSelectedSuggestion)}/${secondSelectedSuggestion}.json`))
              .then(response => response.json())
            ]);

            for (let i = 2; i < selectedSuggestionsNumber; i++) {
              let ithSelectedSuggestion = selectedSuggestions[i];
              commonInvertedIndexes = await this.intersection_destructive([
                commonInvertedIndexes,
                fetch(new URL(`${this.indexBaseURL}/${this.getRelativeURL(ithSelectedSuggestion)}/${ithSelectedSuggestion}.json`))
                .then(response => response.json())
              ]);
            }
        }

        console.log(commonInvertedIndexes);
        

        // other types of lookups for inverted indexes

      }
    });
  }

  suggestionTemplate = (data) => `<div class="suggestion">${data}</div>`

  suggestionListTemplate = (data) => `<div class="suggestion-list">${data}</div>`

  intersection_destructive = async (promises) => {
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

  getRelativeURL = (selectedSuggestion) => {
    let firstCharacter = selectedSuggestion.slice(0, 1);
    let suggestionRelativeURL = firstCharacter + "/";

    let secondCharacter = selectedSuggestion.slice(1, 2);
    if (secondCharacter !== "") {
      suggestionRelativeURL = suggestionRelativeURL + secondCharacter;
    }
    
    return suggestionRelativeURL;
  }
};

window.customElements.define("multiple-indexes-searcher", MultipleIndexesSearcher);
