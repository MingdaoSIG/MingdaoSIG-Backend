import checkQuery from "./functions/checkQuery.js";
import checkBody from "./functions/checkBody.js";

import { ExtendedRequest } from "@type/extendRequest.js";


export default class CheckRequestRequirement {
    request: ExtendedRequest;
    constructor(request: ExtendedRequest) {
        this.request = request;
    }

    hasQuery(requiredQuery: string[]) {
        return checkQuery(this.request, requiredQuery);
    }

    hasBody(requiredBody: string[]) {
        return checkBody(this.request, requiredBody);
    }
}