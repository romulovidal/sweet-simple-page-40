import { describe, expect, it } from "vitest";
import { loadBundledBibleVersion } from "@/services/bibleDataLoader";

describe("bibleDataLoader", () => {
  it("loads bundled NVI bible data", async () => {
    const data = await loadBundledBibleVersion("NVI");

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(Array.isArray(data[0].chapters)).toBe(true);
    expect(data[0].chapters.length).toBeGreaterThan(0);
  });
});
