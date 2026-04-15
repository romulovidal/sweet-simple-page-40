import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BIBLE_VERSIONS, getVersionById } from "@/services/bibleApi";
import { parseBibleBookData } from "@/services/bibleDataLoader";

function countEpigraphs(fileName: string) {
  const rawPayload = readFileSync(
    join(process.cwd(), "public", "biblias", `${fileName}.json`),
    "utf8"
  );
  const books = JSON.parse(rawPayload) as Array<{ epigraphs?: unknown[] }>;

  return books.reduce((total, book) => total + (Array.isArray(book.epigraphs) ? book.epigraphs.length : 0), 0);
}

describe("bible version metadata", () => {
  it("matches the bundled epigraph data for ARA and NTLH", () => {
    expect(countEpigraphs("ARA")).toBeGreaterThan(0);
    expect(countEpigraphs("NTLH")).toBeGreaterThan(0);
    expect(getVersionById("ara").supportsEpigraphs).toBe(true);
    expect(getVersionById("ntlh").supportsEpigraphs).toBe(true);
  });

  it("keeps all bundled bible files parseable", () => {
    for (const version of BIBLE_VERSIONS) {
      const rawPayload = readFileSync(
        join(process.cwd(), "public", "biblias", `${version.fileName}.json`),
        "utf8"
      );

      expect(() => parseBibleBookData(rawPayload, version.fileName)).not.toThrow();
    }
  });
});
