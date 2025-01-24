import assert from "assert";
import PositionalIntersector from "../js/multiple-indexes-searcher/positional-intersector.js";

// get the positional index records
/* console.time("get the positional index records");
let suggestions_1 = await fetch("https://wujastyk.github.io/INDOLOGY-forum-data//indexes/terms/so-fulltext-static/1/0/1/101443.json")
    .then(async response => await response.json());
let suggestions_2 = await fetch("https://wujastyk.github.io/INDOLOGY-forum-data//indexes/terms/so-fulltext-static/2/0/7/207781.json")
    .then(async response => await response.json());
console.timeEnd("get the positional index records"); */
const search_string_AST = [
    {
        "term": "unicode",
        "isExactMatch": true,
        "suggestions": new Map(Object.entries({ "unicode": new Map() }))
    },
    {
        "and": -1
    },
    {
        "term": "encoding",
        "isExactMatch": true,
        "suggestions": new Map(Object.entries({ "encoding": new Map() }))
    }
];
const _intersectPositionalIndexRecords = (positions_1, positions_2, search_definition) => {
    search_string_AST[0].suggestions.set("unicode", new Map(Object.entries({ "1": positions_1 })));
    search_string_AST[2].suggestions.set("encoding", new Map(Object.entries({ "1": positions_2 })));
    let [search_type, number_of_words] = search_definition.split("/")
    number_of_words = parseInt(number_of_words);

    search_string_AST[1] = {};
    search_string_AST[1][search_type] = number_of_words;

    if (search_type === "and") {
        search_string_AST[1][search_type] = -1;
    }
    
    return PositionalIntersector.intersectPositionalIndexRecords(search_string_AST);
};

let positions_1 = [113, 144, 200];
let positions_2 = [112, 114, 146, 147, 201, 203, 1008];
let and_search = _intersectPositionalIndexRecords(positions_1, positions_2, "and");
assert.deepStrictEqual(and_search, new Map(Object.entries({
    "1": [112, 113, 114, 144, 146, 147, 200, 201, 203, 1008]
})));

// "exact" ordered searches
let ordered_exact_0 = _intersectPositionalIndexRecords(positions_1, positions_2, "o-exact/0");
assert.deepStrictEqual(ordered_exact_0, new Map(Object.entries({ "1": [113, 114, 200, 201] })));

let ordered_exact_1 = _intersectPositionalIndexRecords(positions_1, positions_2, "o-exact/1");
assert.deepStrictEqual(ordered_exact_1, new Map(Object.entries({ "1": [144, 146] })));

positions_1 = [113];
positions_2 = [110, 116];
let ordered_exact_2 = _intersectPositionalIndexRecords(positions_1, positions_2, "o-exact/2");
assert.deepStrictEqual(ordered_exact_2, new Map(Object.entries({ "1": [113, 116] })));

// "exact" unordered searches
positions_1 = [113, 144, 200];
positions_2 = [112, 199];
let unordered_exact_0 = _intersectPositionalIndexRecords(positions_1, positions_2, "u-exact/0");
assert.deepStrictEqual(unordered_exact_0, new Map(Object.entries({ "1": [112, 113, 199, 200] })));

positions_1 = [113, 144, 200];
positions_2 = [111, 198];
let unordered_exact_1 = _intersectPositionalIndexRecords(positions_1, positions_2, "u-exact/1");
assert.deepStrictEqual(unordered_exact_1, new Map(Object.entries({ "1": [111, 113, 198, 200] })));

positions_1 = [114, 144, 200];
positions_2 = [111, 197];
let unordered_exact_2 = _intersectPositionalIndexRecords(positions_1, positions_2, "u-exact/2");
assert.deepStrictEqual(unordered_exact_2, new Map(Object.entries({ "1": [111, 114, 197, 200] })));

// "maximum" ordered searches
positions_1 = [13, 17];
positions_2 = [2, 14];
let ordered_max_0 = _intersectPositionalIndexRecords(positions_1, positions_2, "o-max/0");
assert.deepStrictEqual(ordered_max_0, new Map(Object.entries({ "1": [13, 14] })));

positions_1 = [10, 17];
positions_2 = [8, 12];
let ordered_max_1 = _intersectPositionalIndexRecords(positions_1, positions_2, "o-max/1");
assert.deepStrictEqual(ordered_max_1, new Map(Object.entries({ "1": [10, 12] })));

positions_1 = [13, 17];
positions_2 = [10, 16];
let ordered_max_2 = _intersectPositionalIndexRecords(positions_1, positions_2, "o-max/2");
assert.deepStrictEqual(ordered_max_2, new Map(Object.entries({ "1": [13, 16] })));

// "maximum" unordered searches
positions_1 = [13, 17];
positions_2 = [12, 14];
let unordered_max_0 = _intersectPositionalIndexRecords(positions_1, positions_2, "u-max/0");
assert.deepStrictEqual(unordered_max_0, new Map(Object.entries({ "1": [12, 13, 14] })));

positions_1 = [10, 17];
positions_2 = [8, 12];
let unordered_max_1 = _intersectPositionalIndexRecords(positions_1, positions_2, "u-max/1");
assert.deepStrictEqual(unordered_max_1, new Map(Object.entries({ "1": [8, 10, 12] })));

positions_1 = [13, 17];
positions_2 = [10, 16];
let unordered_max_2 = _intersectPositionalIndexRecords(positions_1, positions_2, "u-max/2");
assert.deepStrictEqual(unordered_max_2, new Map(Object.entries({ "1": [10, 13, 16, 17] })));

positions_1 = [];
positions_2 = [10, 16];
let ordered_exact_1_empty = _intersectPositionalIndexRecords(positions_1, positions_2, "and");
assert.deepStrictEqual(ordered_exact_1_empty, new Map(Object.entries({ "1": [10, 16] })));
