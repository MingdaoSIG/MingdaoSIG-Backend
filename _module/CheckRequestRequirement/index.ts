import { Request } from "express";

import matchQuery from "./functions/matchQuery.js";
import matchBody from "./functions/matchBody.js";
import forbiddenBody from "./functions/forbiddenBody.js";
import includesBody from "./functions/includesBody.js";


export default class CheckRequestRequirement {
    request: Request;
    constructor(request: Request) {
        this.request = request;
    }

    matchQuery(requiredQuery: string[]) {
        return matchQuery(this.request, requiredQuery);
    }

    matchBody(requiredBody: string[]) {
        return matchBody(this.request, requiredBody);
    }

    forbiddenBody(forbiddenKeys: string[]) {
        return forbiddenBody(this.request, forbiddenKeys);
    }

    includesBody(requiredBody: string[], strict: boolean = false) {
        return includesBody(this.request, requiredBody, strict);
    }
}