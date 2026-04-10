import { builder } from "./builder";
import "./types.js";
import "./queries.js";
import "./mutations.js";
import "./household-types.js";
import "./household-queries.js";
import "./household-mutations.js";
import "./measurement-types.js";
import "./measurement-mutations.js";

export const schema = builder.toSchema();
