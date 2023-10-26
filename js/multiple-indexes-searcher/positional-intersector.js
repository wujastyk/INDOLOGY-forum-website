const intersectPositionalIndexRecords = (searchStringAST) => {
    let positionalIntersectionResult = new Map();
    let distance = 0;
    let operator = "and";

    searchStringAST.forEach(item => {
        switch (true) {
            case item.hasOwnProperty("term"):
                let term = item.term.toLowerCase();
                let positionalIndexRecords = item.suggestions.get(term);

                switch (operator) {
                    case "and":
                        positionalIntersectionResult = andSearch(positionalIntersectionResult, positionalIndexRecords);
                        break;
                    case "o-exact":
                        positionalIntersectionResult = oExactSearch(positionalIntersectionResult, positionalIndexRecords, distance);
                        break;
                    case "u-exact":
                        positionalIntersectionResult = uExactSearch(positionalIntersectionResult, positionalIndexRecords, distance);
                        break;
                    case "o-max":
                        positionalIntersectionResult = oMaximumSearch(positionalIntersectionResult, positionalIndexRecords, distance);
                        break;
                    case "u-max":
                        positionalIntersectionResult = uMaximumSearch(positionalIntersectionResult, positionalIndexRecords, distance);
                        break;
                };
                break;
            case item.hasOwnProperty("o-exact"):
                distance = item["o-exact"];
                operator = "o-exact";
                break;
            case item.hasOwnProperty("u-exact"):
                distance = item["u-exact"];
                operator = "u-exact";
                break;
            case item.hasOwnProperty("o-max"):
                distance = item["o-max"];
                operator = "o-max";
                break;
            case item.hasOwnProperty("u-max"):
                distance = item["u-max"];
                operator = "u-max";
                break;
        }
    });

    return positionalIntersectionResult;
};

const andSearch = (positional_index_records_1, positional_index_records_2) => {
    return positionalIndexRecordsIntersection(positional_index_records_1, positional_index_records_2, -1, "exact", true);
};

const oExactSearch = (positional_index_records_1, positional_index_records_2, distance) => {
    return positionalIndexRecordsIntersection(positional_index_records_1, positional_index_records_2, distance, "exact", true);
};

const uExactSearch = (positional_index_records_1, positional_index_records_2, distance) => {
    return positionalIndexRecordsIntersection(positional_index_records_1, positional_index_records_2, distance, "exact", false);
};

const oMaximumSearch = (positional_index_records_1, positional_index_records_2, distance) => {
    return positionalIndexRecordsIntersection(positional_index_records_1, positional_index_records_2, distance, "maximum", true);
};

const uMaximumSearch = (positional_index_records_1, positional_index_records_2, distance) => {
    return positionalIndexRecordsIntersection(positional_index_records_1, positional_index_records_2, distance, "maximum", false);
};

const positionalIndexRecordsIntersection = (positionalIndexRecord_1, positionalIndexRecord_2, distance, search_type, ordered) => {
    let result = new Map();
    let docIDs_1 = Array.from(positionalIndexRecord_1.keys());
    let docIDs_2 = Array.from(positionalIndexRecord_2.keys());

    if (docIDs_1.length === 0) {
        return positionalIndexRecord_2;
    }
    if (docIDs_2.length === 0) {
        return positionalIndexRecord_1;
    }

    let commonDocIDs = intersectTwoArrays([docIDs_1, docIDs_2]);

    for (let common_doc_ID of commonDocIDs) {
        let positions_1 = positionalIndexRecord_1.get(common_doc_ID);
        let positions_2 = positionalIndexRecord_2.get(common_doc_ID);
        let proximity_positions = [];

        if (distance === -1) {
            proximity_positions = positions_1.concat(positions_2);
        } else {
            switch (search_type) {
                case "exact":
                    proximity_positions = intersectionWithExactDistance(positions_1, positions_2, distance, ordered);
                    break;
                case "maximum":
                    proximity_positions = intersectionWithMaximumDistance(positions_1, positions_2, distance, ordered);
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
}

const intersectionWithExactDistance = (positions_1, positions_2, distance, ordered) => {
    let proximity_positions = intersectTwoArraysWithDistance([positions_1, positions_2], distance);

    if (!ordered) {
        let reverse_proximity_positions = intersectTwoArraysWithDistance([positions_2, positions_1], distance);
        proximity_positions = proximity_positions.concat(reverse_proximity_positions);
    }

    //proximity_positions = proximity_positions.flatMap(item => [item, item + distance + 1]);
    proximity_positions = proximity_positions.flat();

    return proximity_positions;
}

const intersectionWithMaximumDistance = (positions_1, positions_2, distance, ordered) => {
    let proximity_positions = [];

    for (let step = 0; step <= distance; step++) {
        proximity_positions = proximity_positions.concat(intersectionWithExactDistance(positions_1, positions_2, step, ordered));
    }

    return proximity_positions;
}

const intersectTwoArrays = (arrays) => {
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
}

const PositionalIntersector = {
    intersectPositionalIndexRecords
};

export default PositionalIntersector;