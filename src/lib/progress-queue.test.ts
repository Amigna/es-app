import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import type { Answer } from "./progress";
import { recordAnswer, saveProgress, setProgressEnabled } from "./progress-queue";

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
