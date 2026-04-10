import { builder } from "./builder";

export const MeasurementType = builder.objectRef<{
  babyId: string;
  createdAt: Date;
  headMm: number | null;
  id: string;
  lengthMm: number | null;
  loggedById: string;
  measuredAt: Date;
  notes: string | null;
  weightG: number | null;
}>("Measurement");

MeasurementType.implement({
  fields: (t) => ({
    babyId: t.exposeString("babyId"),
    createdAt: t.field({
      resolve: (parent) => parent.createdAt.toISOString(),
      type: "String",
    }),
    headMm: t.exposeInt("headMm", { nullable: true }),
    id: t.exposeString("id"),
    lengthMm: t.exposeInt("lengthMm", { nullable: true }),
    loggedById: t.exposeString("loggedById"),
    measuredAt: t.field({
      resolve: (parent) => parent.measuredAt.toISOString(),
      type: "String",
    }),
    notes: t.exposeString("notes", { nullable: true }),
    weightG: t.exposeInt("weightG", { nullable: true }),
  }),
});
