import { buildToastCopy, formatDuration } from "./toast-copy";

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 10, 21, 3, minutes)).toISOString();

describe("toast copy", () => {
  it("says a timer started, not that it was logged", () => {
    expect(
      buildToastCopy(
        {
          endedAt: null,
          metadata: JSON.stringify({ method: "breast", side: "left" }),
          startedAt: at(0),
          type: "feed",
        },
        "started"
      )
    ).toBe("Feed started · Left");
  });

  it("gives duration and side when a feed finishes", () => {
    expect(
      buildToastCopy(
        {
          endedAt: at(18),
          metadata: JSON.stringify({ method: "breast", side: "left" }),
          startedAt: at(0),
          type: "feed",
        },
        "saved"
      )
    ).toBe("Feed saved · 18 min · Left");
  });

  it("names the method and amount for bottle feeds", () => {
    expect(
      buildToastCopy(
        {
          endedAt: at(10),
          metadata: JSON.stringify({ amountMl: 90, method: "bottle" }),
          startedAt: at(0),
          type: "feed",
        },
        "saved"
      )
    ).toBe("Feed saved · 10 min · Bottle · 90 ml");
  });

  it("describes an instant diaper without a duration", () => {
    const diaper = (meta: object) =>
      buildToastCopy(
        {
          endedAt: at(0),
          metadata: JSON.stringify(meta),
          startedAt: at(0),
          type: "diaper",
        },
        "saved"
      );
    expect(diaper({ soiled: false, wet: true })).toBe("Diaper saved · Wet");
    expect(diaper({ soiled: true, wet: true })).toBe(
      "Diaper saved · Wet and dirty"
    );
    expect(diaper({ soiled: true, wet: false })).toBe("Diaper saved · Dirty");
  });

  it("covers sleep, pump and unreadable metadata", () => {
    expect(
      buildToastCopy(
        {
          endedAt: null,
          metadata: JSON.stringify({ location: "crib" }),
          startedAt: at(0),
          type: "sleep",
        },
        "started"
      )
    ).toBe("Sleep started · Crib");
    expect(
      buildToastCopy(
        { endedAt: at(75), metadata: "{", startedAt: at(0), type: "pump" },
        "saved"
      )
    ).toBe("Pump saved · 1 h 15 min");
  });
});

describe("duration text", () => {
  it("rounds to whole minutes and switches to hours", () => {
    expect(formatDuration(20_000)).toBe("Under 1 min");
    expect(formatDuration(18 * 60_000)).toBe("18 min");
    expect(formatDuration(120 * 60_000)).toBe("2 h");
  });
});

describe("discarded timer", () => {
  it("says the timer was discarded and which one", () => {
    expect(
      buildToastCopy(
        {
          endedAt: null,
          metadata: JSON.stringify({ location: "crib" }),
          startedAt: "2026-11-21T03:00:00.000Z",
          type: "sleep",
        },
        "discarded"
      )
    ).toBe("Sleep timer discarded · Crib");
  });
});

describe("amount unit", () => {
  it("shows the amount in the parent's chosen unit", () => {
    expect(
      buildToastCopy(
        {
          endedAt: "2026-11-21T03:00:00.000Z",
          metadata: JSON.stringify({ amountMl: 118, side: "left" }),
          startedAt: "2026-11-21T03:00:00.000Z",
          type: "pump",
        },
        "saved",
        "oz"
      )
    ).toBe("Pump saved · Left · 4 oz");
  });
});
