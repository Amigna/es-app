import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import type { Answer, StreakRecord } from "./progress";
import { recordAnswer, recordStreak, saveProgress, setProgressEnabled } from "./progress-queue";

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

describe("best drill streak", () => {
  const best = () => JSON.parse(stored.get("progress-best-streak") ?? "null")?.streak ?? null;

  beforeEach(() => {
    setProgressEnabled(false);
    setProgressEnabled(true);
  });

  it("keeps only a new high", () => {
    recordStreak(3);
    recordStreak(5);
    recordStreak(2);
    assert.equal(best(), 5);
  });

  it("ignores streaks when saving is off", () => {
    setProgressEnabled(false);
    recordStreak(4);
    assert.equal(best(), null);
  });

  it("is sent even with no answers, then cleared", async () => {
    recordStreak(7);
    let sent: StreakRecord | null = null;
    await saveProgress(async (_answers, streak) => {
      sent = streak;
    });
    assert.equal(sent!.streak, 7);
    assert.equal(best(), null);
  });

  it("stays queued when a save fails", async () => {
    const logged = mock.method(console, "error", () => {});
    recordStreak(6);
    await saveProgress(() => Promise.reject(new Error("offline")));
    logged.mock.restore();
    assert.equal(best(), 6);
  });

  it("keeps a longer streak reached during a save", async () => {
    recordStreak(4);
    const write = deferred();
    const saved = saveProgress(() => write.promise);
    recordStreak(9);
    write.resolve();
    await saved;
    assert.equal(best(), 9);
  });

  it("is cleared on sign out", () => {
    recordStreak(4);
    setProgressEnabled(false);
    assert.equal(best(), null);
  });
});
