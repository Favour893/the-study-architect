import { afterEach, describe, expect, it } from "vitest";
import { firedAlarmKey, listFiredAlarmKeys, markAlarmFired } from "../../lib/alarms/fired-store";

describe("fired-store", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("lists fired alarm keys without the storage prefix", () => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      get length() {
        return storage.size;
      },
      key(index: number) {
        return [...storage.keys()][index] ?? null;
      },
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
    };

    Object.defineProperty(globalThis, "window", {
      value: { localStorage: localStorageMock },
      configurable: true,
    });

    markAlarmFired("todo:c1:t1", "2026-07-07T10:00:00.000Z");
    expect(localStorageMock.getItem(firedAlarmKey("todo:c1:t1", "2026-07-07T10:00:00.000Z"))).toBe("1");
    expect(listFiredAlarmKeys()).toEqual(["todo:c1:t1:2026-07-07T10:00:00.000Z"]);
  });
});
