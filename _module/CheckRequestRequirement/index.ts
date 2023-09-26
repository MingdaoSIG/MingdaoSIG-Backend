import { Request } from "express";

import checkQuery from "./functions/checkQuery.js";
import checkBody from "./functions/checkBody.js";


export default class CheckRequestRequirement {
    request: Request;
    constructor(request: Request) {
        this.request = request;
    }

    hasQuery(requiredQuery: string[]) {
        return checkQuery(this.request, requiredQuery);
    }

    hasBody(requiredBody: string[]) {
        return checkBody(this.request, requiredBody);
    }
}