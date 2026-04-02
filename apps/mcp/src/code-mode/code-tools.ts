import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { gqlRequest } from "../graphql";
import type { Executor } from "./executor";
import type { ToolDescriptor } from "./type-generator";
import { generateTypes } from "./type-generator";

/**
 * Tool descriptors describing the individual tools' schemas.
 * Used by search_api to let the LLM discover the API surface.
 */
const toolDescriptors: ToolDescriptor[] = [
  {
    description:
      "Log a baby event (feed, sleep, diaper, or note). Returns the created event.",
    inputSchema: {
      properties: {
        amountMl: { description: "Amount in ml", type: "number" },
        babyId: { description: "UUID of the baby", type: "string" },
        color: {
          enum: ["yellow", "green", "brown", "black", "red"],
          type: "string",
        },
        endedAt: { description: "ISO timestamp", type: "string" },
        foodDesc: { type: "string" },
        location: {
          enum: ["crib", "bassinet", "held", "carrier", "other"],
          type: "string",
        },
        method: { enum: ["breast", "bottle", "solid"], type: "string" },
        notes: { type: "string" },
        quality: { enum: ["good", "restless", "poor"], type: "string" },
        side: { enum: ["left", "right", "both"], type: "string" },
        soiled: { type: "boolean" },
        startedAt: { description: "ISO timestamp", type: "string" },
        text: { description: "Note text", type: "string" },
        type: { enum: ["feed", "sleep", "diaper", "note"], type: "string" },
        wet: { type: "boolean" },
      },
      required: ["babyId", "type"],
      type: "object",
    },
    name: "log_event",
  },
  {
    description: "Get recent events for a baby. Returns newest first.",
    inputSchema: {
      properties: {
        babyId: { description: "UUID of the baby", type: "string" },
        limit: { description: "Max events, default 20", type: "number" },
        type: {
          enum: ["feed", "sleep", "diaper", "note"],
          type: "string",
        },
      },
      required: ["babyId"],
      type: "object",
    },
    name: "get_recent_events",
  },
  {
    description: "Get the most recent event for a baby.",
    inputSchema: {
      properties: {
        babyId: { description: "UUID of the baby", type: "string" },
        type: {
          enum: ["feed", "sleep", "diaper", "note"],
          type: "string",
        },
      },
      required: ["babyId"],
      type: "object",
    },
    name: "get_last_event",
  },
  {
    description: "List all babies in your household.",
    inputSchema: { properties: {}, type: "object" },
    name: "list_babies",
  },
  {
    description: "Add a baby to your household.",
    inputSchema: {
      properties: {
        birthDate: { description: "YYYY-MM-DD", type: "string" },
        birthWeightG: { description: "Weight in grams", type: "number" },
        name: { description: "Baby's name", type: "string" },
      },
      required: ["name", "birthDate"],
      type: "object",
    },
    name: "add_baby",
  },
  {
    description: "Update an existing event.",
    inputSchema: {
      properties: {
        endedAt: { type: "string" },
        id: { description: "Event UUID", type: "string" },
        startedAt: { type: "string" },
      },
      required: ["id"],
      type: "object",
    },
    name: "update_event",
  },
  {
    description: "Delete an event by ID.",
    inputSchema: {
      properties: {
        id: { description: "Event UUID", type: "string" },
      },
      required: ["id"],
      type: "object",
    },
    name: "delete_event",
  },
  {
    description: "Get your household info and invite code.",
    inputSchema: { properties: {}, type: "object" },
    name: "get_household",
  },
  {
    description: "Create a new household.",
    inputSchema: { properties: {}, type: "object" },
    name: "create_household",
  },
  {
    description: "Join an existing household with an invite code.",
    inputSchema: {
      properties: {
        inviteCode: { description: "8-char code", type: "string" },
      },
      required: ["inviteCode"],
      type: "object",
    },
    name: "join_household",
  },
];

const typeDefinitions = generateTypes(toolDescriptors);

// GraphQL queries/mutations for tool dispatch
const TOOL_QUERIES: Record<string, string> = {
  add_baby: `mutation($name:String!,$birthDate:String!,$birthWeightG:Int){addBaby(name:$name,birthDate:$birthDate,birthWeightG:$birthWeightG){id name birthDate}}`,
  create_household: `mutation{createHousehold{id inviteCode}}`,
  delete_event: `mutation($id:String!){deleteEvent(id:$id)}`,
  get_household: `query{myHousehold{id inviteCode createdAt}}`,
  get_last_event: `query($babyId:String!,$type:String){lastEvent(babyId:$babyId,type:$type){id type startedAt endedAt metadata}}`,
  get_recent_events: `query($babyId:String!,$type:String,$limit:Int){recentEvents(babyId:$babyId,type:$type,limit:$limit){id type startedAt endedAt metadata}}`,
  join_household: `mutation($inviteCode:String!){joinHousehold(inviteCode:$inviteCode){id inviteCode}}`,
  list_babies: `query{myBabies{id name birthDate birthWeightG}}`,
  log_event: `mutation($babyId:String!,$type:EventType!,$startedAt:String,$endedAt:String,$feedMeta:FeedMetadataInput,$sleepMeta:SleepMetadataInput,$diaperMeta:DiaperMetadataInput,$noteMeta:NoteMetadataInput){logEvent(babyId:$babyId,type:$type,startedAt:$startedAt,endedAt:$endedAt,feedMeta:$feedMeta,sleepMeta:$sleepMeta,diaperMeta:$diaperMeta,noteMeta:$noteMeta){id type startedAt endedAt metadata}}`,
  update_event: `mutation($id:String!,$startedAt:String,$endedAt:String,$feedMeta:FeedMetadataInput,$sleepMeta:SleepMetadataInput,$diaperMeta:DiaperMetadataInput,$noteMeta:NoteMetadataInput){updateEvent(id:$id,startedAt:$startedAt,endedAt:$endedAt,feedMeta:$feedMeta,sleepMeta:$sleepMeta,diaperMeta:$diaperMeta,noteMeta:$noteMeta){id type startedAt endedAt metadata}}`,
};

const createToolFunctions = (
  token: string
): Record<string, (...args: unknown[]) => Promise<unknown>> => {
  const fns: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  for (const [name, query] of Object.entries(TOOL_QUERIES)) {
    fns[name] = (args: unknown) => {
      const variables = (args as Record<string, unknown>) ?? {};
      return gqlRequest(token, query, variables);
    };
  }

  return fns;
};

export const registerCodeModeTools = (
  server: McpServer,
  getToken: () => string,
  executor: Executor
) => {
  server.tool(
    "search_api",
    `Search the BabyTalk API schema. Write JavaScript code that filters the \`schema\` array (each entry has name, description, inputSchema). Return the entries you need. The schema has ${String(toolDescriptors.length)} tools for baby tracking (feeds, sleep, diapers, notes).`,
    {
      code: z
        .string()
        .describe(
          "JavaScript code. `schema` is available as an array of tool descriptors. Return the filtered result."
        ),
    },
    async (args) => {
      const searchResult = await executor.execute(
        `const schema = await babytalk._getSchema(); ${args.code}`,
        { _getSchema: () => Promise.resolve(toolDescriptors) }
      );

      return {
        content: [
          {
            text: JSON.stringify({
              logs: searchResult.logs,
              result: searchResult.result,
              types: typeDefinitions,
              ...(searchResult.error ? { error: searchResult.error } : {}),
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.tool(
    "execute_code",
    `Execute JavaScript code that calls BabyTalk API functions. Available functions: ${toolDescriptors.map((t) => t.name).join(", ")}. Call them via babytalk.toolName(args). You can chain multiple calls. TypeScript types:\n\n${typeDefinitions}`,
    {
      code: z
        .string()
        .describe(
          "JavaScript async code. Call babytalk.list_babies(), babytalk.log_event({...}), etc. Return the final result."
        ),
    },
    async (args) => {
      const fns = createToolFunctions(getToken());
      const result = await executor.execute(args.code, fns);

      return {
        content: [
          {
            text: JSON.stringify({
              logs: result.logs,
              result: result.result,
              ...(result.error ? { error: result.error } : {}),
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
