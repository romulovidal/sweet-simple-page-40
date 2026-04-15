import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_BIBLE = [{
  abbrev: "gn",
  chapters: [["No principio"]],
  epigraphs: [
    {
      title: "O principio",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 3 },
    },
  ],
}];

function installMockCaches() {
  const stores = new Map<string, Map<string, Response>>();

  const cacheStorage = {
    keys: vi.fn(async () => Array.from(stores.keys())),
    delete: vi.fn(async (name: string) => stores.delete(name)),
    open: vi.fn(async (name: string) => {
      let store = stores.get(name);
      if (!store) {
        store = new Map<string, Response>();
        stores.set(name, store);
      }

      return {
        match: vi.fn(async (key: string) => {
          const response = store?.get(String(key));
          return response ? response.clone() : undefined;
        }),
        put: vi.fn(async (key: string, response: Response) => {
          store?.set(String(key), response.clone());
        }),
        delete: vi.fn(async (key: string) => store?.delete(String(key)) ?? false),
      };
    }),
  };

  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    writable: true,
    value: cacheStorage,
  });

  return { stores, cacheStorage };
}

beforeEach(() => {
  vi.resetModules();
  installMockCaches();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "caches");
});

describe("bibleOffline", () => {
  it("stores and reads a downloaded version from offline cache", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_BIBLE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { downloadVersion, fetchWithOffline, getCachedVersionData } = await import("@/lib/bibleOffline");

    await downloadVersion({
      id: "ntlh",
      name: "Nova Tradução na Linguagem de Hoje",
      shortName: "NTLH",
      fileName: "NTLH",
      supportsEpigraphs: true,
    });

    expect(await getCachedVersionData("NTLH")).toEqual(SAMPLE_BIBLE);

    const response = await fetchWithOffline("/biblias/NTLH.json");
    expect(await response.json()).toEqual(SAMPLE_BIBLE);
  });

  it("removes invalid cached payloads automatically", async () => {
    const { getCachedVersionData } = await import("@/lib/bibleOffline");

    const cache = await caches.open("bible-offline-v5");
    await cache.put(
      "/offline-bibles/NTLH.json",
      new Response(JSON.stringify([{ abbrev: "gn", chapters: [123] }]), {
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(await getCachedVersionData("NTLH")).toBeNull();
    expect(await cache.match("/offline-bibles/NTLH.json")).toBeUndefined();
  });
});
