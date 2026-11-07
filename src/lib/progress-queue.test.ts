import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { localDay, type Answer, type RunningStreak } from "./progress";
import { drillStreak, recordAnswer, recordStreak, saveProgress, setProgressEnabled, syncDrillStreak } from "./progress-queue";

const stored = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});

const queued = (): Answer[] => JSON.parse(stored.get("progress-queue") ?? "[]");
const items = () => queued().map((a) => a.item);

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve: () => resolve() };
}

describe("progress queue", () => {
  beforeEach(() => {
    setProgressEnabled(false);
    setProgressEnabled(true);
  });

  it("ignores answers when saving is off", () => {
    setProgressEnabled(false);
    recordAnswer({ item: "a" }, "correct");
    assert.deepEqual(items(), []);
  });

  it("keeps answers until the write is confirmed", async () => {
    recordAnswer({ item: "a" }, "correct");
    const write = deferred();
    const saved = saveProgress(() => write.promise);
    assert.deepEqual(items(), ["a"]);
    write.resolve();
    await saved;
    assert.deepEqual(items(), []);
  });

  it("keeps answers when a save fails", async () => {
    const logged = mock.method(console, "error", () => {});
    recordAnswer({ item: "a" }, "correct");
    await saveProgress(() => Promise.reject(new Error("offline")));
    logged.mock.restore();
    assert.deepEqual(items(), ["a"]);
  });

  it("keeps answers given during a save", async () => {
    recordAnswer({ item: "a" }, "correct");
    const write = deferred();
    const saved = saveProgress(() => write.promise);
    recordAnswer({ item: "b" }, "wrong");
    write.resolve();
    await saved;
    assert.deepEqual(items(), ["b"]);
  });

  it("sends each answer once when saves overlap", async () => {
    recordAnswer({ item: "a" }, "correct");
    const write = deferred();
    let calls = 0;
    const save = () => {
      calls++;
      return write.promise;
    };
    const first = saveProgress(save);
    const second = saveProgress(save);
    write.resolve();
    await Promise.all([first, second]);
    assert.equal(calls, 1);
  });
});

describe("running drill streak", () => {
  const local = () => JSON.parse(stored.get("progress-drill-streak") ?? "null");
  const sends = async () => {
    let sent: RunningStreak | null = null;
    await saveProgress(async (_answers, streak) => {
      sent = streak;
    });
    return sent as RunningStreak | null;
  };

  beforeEach(() => {
    setProgressEnabled(false);
    setProgressEnabled(true);
  });

  it("carries on into the next drill, and a miss starts it again", () => {
    recordStreak(1);
    recordStreak(2);
    assert.equal(drillStreak(), 2);
    recordStreak(0);
    assert.equal(drillStreak(), 0);
  });

  it("keeps the day's best through a miss", () => {
    recordStreak(5);
    recordStreak(0);
    recordStreak(1);
    assert.equal(local().best, 5);
  });

  it("starts again on a new day", () => {
    stored.set("progress-drill-streak", JSON.stringify({ day: "2020-01-01", streak: 8, best: 8, at: 1, unsaved: false }));
    assert.equal(drillStreak(), 0);
    recordStreak(1);
    assert.equal(local().best, 1);
  });

  it("ignores streaks when saving is off", () => {
    setProgressEnabled(false);
    recordStreak(4);
    assert.equal(local(), null);
    assert.equal(drillStreak(), 0);
  });

  it("is sent even with no answers, and only once", async () => {
    recordStreak(7);
    assert.equal((await sends())?.best, 7);
    assert.equal(await sends(), null);
    assert.equal(drillStreak(), 7);
  });

  it("stays unsaved when a save fails", async () => {
    const logged = mock.method(console, "error", () => {});
    recordStreak(6);
    await saveProgress(() => Promise.reject(new Error("offline")));
    logged.mock.restore();
    assert.equal((await sends())?.streak, 6);
  });

  it("keeps a change made during a save for the next one", async () => {
    recordStreak(4);
    const write = deferred();
    const saved = saveProgress(() => write.promise);
    // A different time, so it's seen as a change.
    await new Promise((resolve) => setTimeout(resolve, 2));
    recordStreak(0);
    write.resolve();
    await saved;
    assert.equal((await sends())?.streak, 0);
  });

  it("picks up a newer streak from another device", async () => {
    recordStreak(3);
    const carried = await syncDrillStreak(async () => ({ day: localDay(), streak: 12, best: 12, at: Date.now() + 1000 }), async () => {});
    assert.equal(carried, 12);
    assert.equal(local().unsaved, false);
  });

  it("keeps this browser's when the other device's is older or from another day", async () => {
    recordStreak(3);
    assert.equal(await syncDrillStreak(async () => ({ day: localDay(), streak: 12, best: 12, at: 1 }), async () => {}), 3);
    assert.equal(await syncDrillStreak(async () => ({ day: "2020-01-01", streak: 12, best: 12, at: Date.now() + 1000 }), async () => {}), 3);
  });

  it("is cleared on sign out", () => {
    recordStreak(4);
    setProgressEnabled(false);
    assert.equal(local(), null);
  });
});
