import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.4.0/dist/shoelace.js";

export default class IndexSearch extends HTMLElement {
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
            <sl-input placeholder="Enter search string..." clearable value="point zero"></sl-input>
            <sl-button id="suggestions" variant="default" outline>Suggestions</sl-button>
          </div>
          <div id="suggestion-lists-container">
            <div id="suggestion-lists-toolbar">
              <header>Suggestion lists (one list for each search term; select suggestions in desired combinations, and press the Search button)</header>
              <sl-button id="search" variant="default" outline>Search</sl-button>
            </div>
            <div id="suggestion-lists-content"></div>
          </div>
        </div>
    `;

    this.searchInput = shadowRoot.querySelector("sl-input");
    this.suggestionsButton = shadowRoot.querySelector("sl-button#suggestions");
    this.suggestionListContent = shadowRoot.querySelector("div#suggestion-lists-content");
    this.indexBaseURL = this.getAttribute("index-base-url");

    shadowRoot.addEventListener("click", event => {
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
          .map((selectedSuggestion) => selectedSuggestion.textContent);

        // lookup for inverted indexes
        let invertedIndexes = [];
        selectedSuggestions.forEach(async (selectedSuggestion, index) => {
          let firstCharacter = selectedSuggestion.slice(0, 1);
          let suggestionRelativeURL = firstCharacter + "/";

          let secondCharacter = selectedSuggestion.slice(1, 2);
          if (secondCharacter !== "") {
            suggestionRelativeURL = suggestionRelativeURL + secondCharacter;
          }

          let invertedIndex = await fetch(new URL(`${this.indexBaseURL}/${suggestionRelativeURL}/${selectedSuggestion}.json`))
            .then(response => response.json());
          console.log(invertedIndex);

          invertedIndexes[index] = invertedIndex;
        });
        setTimeout(() => {
          console.log(invertedIndexes);

          console.time("intersection");
          let invertedIndexesIntersection = this.intersection_destructive(invertedIndexes);
          console.timeEnd("intersection");
          console.log(invertedIndexesIntersection);        
        }, 5000);        
      }
    });        
  }

  suggestionTemplate = (data) => `<div class="suggestion">${data}</div>`
  
  suggestionListTemplate = (data) => `<div class="suggestion-list">${data}</div>`

  intersection_destructive = (arrays) => 
  {
    console.log(arrays);
    var result = [];
    let a = arrays[0];
    let b = arrays[1];

    while( a.length > 0 && b.length > 0 )
    {  
       if      (a[0] < b[0] ){ a.shift(); }
       else if (a[0] > b[0] ){ b.shift(); }
       else /* they're equal */
       {
         result.push(a.shift());
         b.shift();
       }
    }
  
    return result;
  }  
};

window.customElements.define("wc-index-search", IndexSearch);
