export default class IndexSearch extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    const shadowRoot = this.shadowRoot;
    shadowRoot.innerHTML = `
            <style>
              :host(*) > div {
                display: flex;  
                gap: 10px;
              }            
              #search-whole-container {
                width: var(--sc-width, 500px);
              }            
              #search-input-container {
                position: relative;
                display: flex;
              }
              #search-input {
                width: 100%;
                padding: 0.5em;
                font-size: 16px;
                border: 1px solid #ccc;
                border-radius: 3px;
                outline: none;
                color: #555;
                box-shadow: none;                
              }              
              #search-clear {
                position: absolute;
                top: 0;
                bottom: 0.2em;
                right: 0.5em;
                font-size: 1.5em;
                line-height: 1;
                z-index: 20;
                border: none;
                background: none;
                outline: none;
                margin: 0;
                padding: 0;
              }    
              button#search svg {
                width: 20px;
              }                      
            </style>
            <div>
              <div id="search-whole-container">
                <div id="search-input-container">
                  <input id="search-input" type="text" autocomplete="none" autocorrect="none" autocapitalize="none" spellcheck="false" value=""></input>
                  <button id="search-clear">×</button>
                </div>
                <button id="search">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>
                </button>
              </div>
            </div>
        `;


  }
};

window.customElements.define("wc-index-search", IndexSearch);
