import assert from "assert";
import PositionalIntersector from "../js/multiple-indexes-searcher/positional-intersector.js";

// get the positional index records
/* console.time("get the positional index records");
let suggestions_1 = await fetch("https://wujastyk.github.io/INDOLOGY-forum-data//indexes/terms/so-fulltext-static/1/0/1/101443.json")
    .then(async response => await response.json());
let suggestions_2 = await fetch("https://wujastyk.github.io/INDOLOGY-forum-data//indexes/terms/so-fulltext-static/2/0/7/207781.json")
    .then(async response => await response.json());
console.timeEnd("get the positional index records"); */

let suggestions_1 = { "1": [113, 144, 200] };
let suggestions_2 = { "1": [112, 114, 146, 147, 201, 203, 1008] };

const _intersectTwoArrays = (arrays) => {
    let result = [];
    let a = [...arrays[0]];
    let b = [...arrays[1]];

    while (a.length > 0 && b.length > 0) {
        let left = +a[0];
        let right = +b[0];

        if (left < right) {
            a.shift();
        }
        else if (left > right) {
            b.shift();
        }
        else /* they're equal */ {
            result.push(a.shift());
            b.shift();
        }
    }

    return result;
};

const _intersectTwoArraysWithDistance = (arrays, distance) => {
    let result = [];
    let a = [...arrays[0]];
    let b = [...arrays[1]];

    while (a.length > 0 && b.length > 0) {
        let left = +a[0];
        let right = +b[0] - distance - 1;

        if (left < right) {
            a.shift();
        }
        else if (left > right) {
            b.shift();
        }
        else /* they're equal */ {
            result.push(a.shift());
            b.shift();
        }
    }

    if (result.length > 0) {
        result = result.map(item => [item, item + distance + 1])
    }

    return result;
};

const _positionalIndexRecordsIntersection = (positionalIndexRecord_1, positionalIndexRecord_2, distance, search_type, ordered) => {
    if (positionalIndexRecord_1 instanceof Object) {
        positionalIndexRecord_1 = new Map(Object.entries(positionalIndexRecord_1));
    }
    if (positionalIndexRecord_2 instanceof Object) {
        positionalIndexRecord_2 = new Map(Object.entries(positionalIndexRecord_2));
    }

    let result = new Map();
    let docIDs_1 = Array.from(positionalIndexRecord_1.keys());
    let docIDs_2 = Array.from(positionalIndexRecord_2.keys());

    if (docIDs_1.length === 0) {
        return positionalIndexRecord_2;
    }
    if (docIDs_2.length === 0) {
        return positionalIndexRecord_1;
    }

    let commonDocIDs = _intersectTwoArrays([docIDs_1, docIDs_2]);

    for (let common_doc_ID of commonDocIDs) {
        let positions_1 = positionalIndexRecord_1.get(common_doc_ID);
        let positions_2 = positionalIndexRecord_2.get(common_doc_ID);
        let proximity_positions = [];

        if (distance === -1) {
            proximity_positions = positions_1.concat(positions_2);
        } else {
            switch (search_type) {
                case "exact":
                    proximity_positions = _intersectionWithExactDistance(positions_1, positions_2, distance, ordered);
                    break;
                case "maximum":
                    proximity_positions = _intersectionWithMaximumDistance(positions_1, positions_2, distance, ordered);
                    break;
            }
        }

        if (proximity_positions.length > 0) {
            proximity_positions = new Uint32Array(proximity_positions);
            proximity_positions.sort();
            proximity_positions = Array.from(new Set(proximity_positions));

            result.set(common_doc_ID, proximity_positions);
        }
    }

    return result;
};

const _intersectionWithExactDistance = (positions_1, positions_2, distance, ordered) => {
    let proximity_positions = _intersectTwoArraysWithDistance([positions_1, positions_2], distance);

    if (!ordered) {
        let reverse_proximity_positions = _intersectTwoArraysWithDistance([positions_2, positions_1], distance);
        proximity_positions = proximity_positions.concat(reverse_proximity_positions);
    }

    //proximity_positions = proximity_positions.flatMap(item => [item, item + distance + 1]);
    proximity_positions = proximity_positions.flat();

    return proximity_positions;
};

const _intersectionWithMaximumDistance = (positions_1, positions_2, distance, ordered) => {
    let proximity_positions = [];

    for (let step = 0; step <= distance; step++) {
        proximity_positions = proximity_positions.concat(_intersectionWithExactDistance(positions_1, positions_2, step, ordered));
    }

    return proximity_positions;
};

let and_search = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, -1, "exact", true);
assert.deepStrictEqual(and_search, new Map(Object.entries({
    "1": [112, 113, 114, 144, 146, 147, 200, 201, 203, 1008]
})));

// "exact" ordered searches
let ordered_exact_0 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 0, "exact", true);
assert.deepStrictEqual(ordered_exact_0, new Map(Object.entries({ "1": [113, 114, 200, 201] })));

let ordered_exact_1 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 1, "exact", true);
assert.deepStrictEqual(ordered_exact_1, new Map(Object.entries({ "1": [144, 146] })));

suggestions_1 = { "1": [113] };
suggestions_2 = { "1": [110, 116] };
let ordered_exact_2 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 2, "exact", true);
assert.deepStrictEqual(ordered_exact_2, new Map(Object.entries({ "1": [113, 116] })));

// "exact" unordered searches
suggestions_1 = { "1": [113, 144, 200] };
suggestions_2 = { "1": [112, 199] };
let unordered_exact_0 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 0, "exact", false);
assert.deepStrictEqual(unordered_exact_0, new Map(Object.entries({ "1": [112, 113, 199, 200] })));

suggestions_1 = { "1": [113, 144, 200] };
suggestions_2 = { "1": [111, 198] };
let unordered_exact_1 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 1, "exact", false);
assert.deepStrictEqual(unordered_exact_1, new Map(Object.entries({ "1": [111, 113, 198, 200] })));

suggestions_1 = { "1": [114, 144, 200] };
suggestions_2 = { "1": [111, 197] };
let unordered_exact_2 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 2, "exact", false);
assert.deepStrictEqual(unordered_exact_2, new Map(Object.entries({ "1": [111, 114, 197, 200] })));

// "maximum" ordered searches
suggestions_1 = { "1": [13, 17] };
suggestions_2 = { "1": [2, 14] };
let ordered_max_0 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 0, "maximum", true);
assert.deepStrictEqual(ordered_max_0, new Map(Object.entries({ "1": [13, 14] })));

suggestions_1 = { "1": [10, 17] };
suggestions_2 = { "1": [8, 12] };
let ordered_max_1 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 1, "maximum", true);
assert.deepStrictEqual(ordered_max_1, new Map(Object.entries({ "1": [10, 12] })));

suggestions_1 = { "1": [13, 17] };
suggestions_2 = { "1": [10, 16] };
let ordered_max_2 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 2, "maximum", true);
assert.deepStrictEqual(ordered_max_2, new Map(Object.entries({ "1": [13, 16] })));

// "maximum" unordered searches
suggestions_1 = { "1": [13, 17] };
suggestions_2 = { "1": [12, 14] };
let unordered_max_0 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 0, "maximum", false);
assert.deepStrictEqual(unordered_max_0, new Map(Object.entries({ "1": [12, 13, 14] })));

suggestions_1 = { "1": [10, 17] };
suggestions_2 = { "1": [8, 12] };
let unordered_max_1 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 1, "maximum", false);
assert.deepStrictEqual(unordered_max_1, new Map(Object.entries({ "1": [8, 10, 12] })));

suggestions_1 = { "1": [13, 17] };
suggestions_2 = { "1": [10, 16] };
let unordered_max_2 = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 2, "maximum", false);
assert.deepStrictEqual(unordered_max_2, new Map(Object.entries({ "1": [10, 13, 16, 17] })));

suggestions_1 = new Map();
suggestions_2 = { "1": [10, 16] };
let ordered_exact_1_empty = _positionalIndexRecordsIntersection(suggestions_1, suggestions_2, 1);
assert.deepStrictEqual(ordered_exact_1_empty, new Map(Object.entries({ "1": [10, 16] })));

console.log(ordered_exact_1_empty);
