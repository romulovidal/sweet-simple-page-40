import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBundledBibleVersion } from "@/services/bibleDataLoader";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bibleDataLoader", () => {
  it("loads bundled NVI bible data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ abbrev: "gn", chapters: [["No princípio"]] }]),
    } as Response);

    const data = await loadBundledBibleVersion("NVI");

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(Array.isArray(data[0].chapters)).toBe(true);
    expect(data[0].chapters.length).toBeGreaterThan(0);

  });
});
