import { builder } from "./builder";
import "./types.js";
import "./queries.js";
import "./mutations.js";

export const schema = builder.toSchema();
