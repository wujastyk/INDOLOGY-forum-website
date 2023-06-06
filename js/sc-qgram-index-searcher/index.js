import { LitElement, html } from "https://cdn.jsdelivr.net/npm/lit/+esm";

export default class QGramIndexSearcher extends LitElement {
    static properties = {
        /** Base URL for words index. */
        indexBaseURL: {
            type: String,
            attribute: "index-base-url",
        },
        /** Size of ngrams. */
        q: {
            type: Number,
            attribute: "q",
        },
        /** The list of words, for lookup by word's index in list. */
        _tokens: {
            type: Array,
        },
    };

    constructor() {
        super();

        this._tokens = [];
    }

    async firstUpdated() {
        let tokensURL = new URL("words.json", this.indexBaseURL);
        await fetch(tokensURL)
            .then(response => response.json())
            .then(async data => {
                this._tokens = data;
            });
    }

    render() {
        return html``;
    }
}

window.customElements.define("sc-qgram-index-searcher", QGramIndexSearcher);

const getNGrams = (s, len) => {
    s = ' '.repeat(len - 1) + s.toLowerCase() + ' '.repeat(len - 1);
    let v = new Array(s.length - len + 1);
    for (let i = 0; i < v.length; i++) {
        v[i] = s.slice(i, i + len);
    }
    return v;
}

"use strict";
function stringSimilarity(str1, str2, gramSize = 2) {
    if (!(str1 === null || str1 === void 0 ? void 0 : str1.length) || !(str2 === null || str2 === void 0 ? void 0 : str2.length)) {
        return 0.0;
    }
    let s1 = str1.length < str2.length ? str1 : str2;
    let s2 = str1.length < str2.length ? str2 : str1;
    let pairs1 = getNGrams(s1, gramSize);
    let pairs2 = getNGrams(s2, gramSize);
    let set = new Set(pairs1);
    let total = pairs2.length;
    let hits = 0;
    for (let item of pairs2) {
        if (set.delete(item)) {
            hits++;
        }
    }
    return hits / total;
}
console.log(stringSimilarity("tattvacintam", "cIvakacintAmaNi"));
console.log(stringSimilarity("tattvacintam", "???avaci??am"));
