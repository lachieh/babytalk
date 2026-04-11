import { builder } from "./builder";

// --- Enums ---

export const EventTypeEnum = builder.enumType("EventType", {
  values: ["feed", "sleep", "diaper", "note", "pump"] as const,
});

export const FeedMethodEnum = builder.enumType("FeedMethod", {
  values: ["breast", "bottle", "formula", "solid"] as const,
});

export const FeedSideEnum = builder.enumType("FeedSide", {
  values: ["left", "right", "both"] as const,
});

export const SleepLocationEnum = builder.enumType("SleepLocation", {
  values: ["crib", "bassinet", "held", "carrier", "other"] as const,
});

export const SleepQualityEnum = builder.enumType("SleepQuality", {
  values: ["good", "restless", "poor"] as const,
});

export const DiaperColorEnum = builder.enumType("DiaperColor", {
  values: ["yellow", "green", "brown", "black", "red"] as const,
});

// --- Object Types ---

export const HouseholdType = builder.objectRef<{
  createdAt: Date;
  id: string;
  inviteCode: string;
}>("Household");

HouseholdType.implement({
  fields: (t) => ({
    createdAt: t.field({
      resolve: (parent) => parent.createdAt.toISOString(),
      type: "String",
    }),
    id: t.exposeString("id"),
    inviteCode: t.exposeString("inviteCode"),
  }),
});

export const GenderEnum = builder.enumType("Gender", {
  values: ["male", "female", "other"] as const,
});

export const BabyType = builder.objectRef<{
  birthDate: string;
  birthWeightG: number | null;
  createdAt: Date;
  gender: string | null;
  householdId: string;
  id: string;
  name: string;
}>("Baby");

BabyType.implement({
  fields: (t) => ({
    birthDate: t.exposeString("birthDate"),
    birthWeightG: t.exposeInt("birthWeightG", { nullable: true }),
    createdAt: t.field({
      resolve: (parent) => parent.createdAt.toISOString(),
      type: "String",
    }),
    gender: t.exposeString("gender", { nullable: true }),
    id: t.exposeString("id"),
    name: t.exposeString("name"),
  }),
});

export const BabyEventType = builder.objectRef<{
  babyId: string;
  createdAt: Date;
  endedAt: Date | null;
  id: string;
  loggedById: string;
  metadata: unknown;
  startedAt: Date;
  type: string;
}>("BabyEvent");

BabyEventType.implement({
  fields: (t) => ({
    babyId: t.exposeString("babyId"),
    createdAt: t.field({
      resolve: (parent) => parent.createdAt.toISOString(),
      type: "String",
    }),
    endedAt: t.field({
      nullable: true,
      resolve: (parent) => parent.endedAt?.toISOString() ?? null,
      type: "String",
    }),
    id: t.exposeString("id"),
    loggedById: t.exposeString("loggedById"),
    metadata: t.field({
      resolve: (parent) => JSON.stringify(parent.metadata),
      type: "String",
    }),
    startedAt: t.field({
      resolve: (parent) => parent.startedAt.toISOString(),
      type: "String",
    }),
    type: t.exposeString("type"),
  }),
});

// --- Input Types ---

export const FeedMetadataInput = builder.inputType("FeedMetadataInput", {
  fields: (t) => ({
    amountMl: t.int({ required: false }),
    foodDesc: t.string({ required: false }),
    method: t.field({ required: true, type: FeedMethodEnum }),
    side: t.field({ required: false, type: FeedSideEnum }),
  }),
});

export const SleepMetadataInput = builder.inputType("SleepMetadataInput", {
  fields: (t) => ({
    location: t.field({ required: false, type: SleepLocationEnum }),
    quality: t.field({ required: false, type: SleepQualityEnum }),
  }),
});

export const DiaperMetadataInput = builder.inputType("DiaperMetadataInput", {
  fields: (t) => ({
    color: t.field({ required: false, type: DiaperColorEnum }),
    notes: t.string({ required: false }),
    soiled: t.boolean({ required: true }),
    wet: t.boolean({ required: true }),
  }),
});

export const NoteMetadataInput = builder.inputType("NoteMetadataInput", {
  fields: (t) => ({
    text: t.string({ required: true }),
  }),
});

export const PumpSideEnum = builder.enumType("PumpSide", {
  values: ["left", "right", "both"] as const,
});

export const PumpMetadataInput = builder.inputType("PumpMetadataInput", {
  fields: (t) => ({
    amountMl: t.int({ required: false }),
    side: t.field({ required: true, type: PumpSideEnum }),
  }),
});
