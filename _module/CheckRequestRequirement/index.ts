import { Request } from "express";

import matchQuery from "./functions/matchQuery.js";
import matchBody from "./functions/matchBody.js";
import forbiddenBody from "./functions/forbiddenBody.js";
import onlyIncludesBody from "./functions/onlyIncludesBody.js";
import onlyIncludesQuery from "./functions/onlyIncludesQuery.js";


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

  onlyIncludesBody(requiredBody: string[]) {
    return onlyIncludesBody(this.request, requiredBody);
  }

  onlyIncludesQuery(requiredQuery: string[]) {
    return onlyIncludesQuery(this.request, requiredQuery);
  }
}
