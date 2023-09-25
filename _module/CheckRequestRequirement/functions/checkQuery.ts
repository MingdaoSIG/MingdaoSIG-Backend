import { ExtendedRequest } from "@type/extendRequest";


export default function checkQuery(request: ExtendedRequest, requiredQuery: string[]) {
    try {
        const query = request.query;

        if (!query) throw new Error("Query is empty");

        if (!hasAllRequiredQuery(query, requiredQuery)) {
            throw new Error(`The following items are all required for this route: [${requiredQuery.join(", ")}]`);
        }

        if (Object.keys(query).length > requiredQuery.length) {
            throw new Error(`Only allowed ${requiredQuery.length} items in the query: [${requiredQuery.join(", ")}]`);
        }
    }
    catch (error) {
        throw new Error("Invalid query");
    }
}

function hasAllRequiredQuery(query: object, requiredQuery: string[]) {
    return requiredQuery.every((item: string) => Object.keys(query).includes(item));
}
