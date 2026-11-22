import { syncMessage } from "./sync-copy";

const calm = { failed: 0, online: true, queued: 0, unstored: 0 };

describe("sync pill", () => {
  it("says nothing when everything is saved", () => {
    expect(syncMessage(calm)).toBeNull();
  });

  it("warns that entries are not stored before promising to save them", () => {
    expect(
      syncMessage({ ...calm, online: false, queued: 2, unstored: 2 })
    ).toStrictEqual({
      canRetry: false,
      text: "2 entries not stored on this device. Keep Bubsie open",
    });
  });

  it("offers retry for failures", () => {
    expect(syncMessage({ ...calm, failed: 1 })).toStrictEqual({
      canRetry: true,
      text: "Couldn't save 1 entry",
    });
  });
});
