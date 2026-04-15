import { afterEach, describe, expect, it, vi } from "vitest";
import { isBibleBookData, loadBundledBibleVersion } from "@/services/bibleDataLoader";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bibleDataLoader", () => {
  it("loads bundled NVI bible data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{
        abbrev: "gn",
        chapters: [["No principio"]],
        epigraphs: [
          {
            title: "O principio",
            start: { chapter: 1, verse: 1 },
            end: { chapter: 1, verse: 3 },
          },
        ],
      }]),
    } as Response);

    const data = await loadBundledBibleVersion("NVI");

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(Array.isArray(data[0].chapters)).toBe(true);
    expect(data[0].chapters.length).toBeGreaterThan(0);
  });

  it("retries with cache busting when a cached bible payload is invalid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{
          abbrev: "gn",
          chapters: [["No principio"], [123]],
        }]),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{
          abbrev: "gn",
          chapters: [["No principio"]],
        }]),
      } as unknown as Response);

    const data = await loadBundledBibleVersion("NTLH");

    expect(data[0].chapters[0][0]).toBe("No principio");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("biblias/NTLH.json?v=");
  });

  it("rejects invalid bible payloads", () => {
    expect(isBibleBookData([{ abbrev: "gn", chapters: [["No principio"]] }])).toBe(true);
    expect(isBibleBookData([{
      abbrev: "gn",
      chapters: [["No principio"]],
      epigraphs: [{ title: "O principio", start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 3 } }],
    }])).toBe(true);
    expect(isBibleBookData([{ abbrev: "gn", chapters: [123] }])).toBe(false);
    expect(isBibleBookData([{
      abbrev: "gn",
      chapters: [["No principio"]],
      epigraphs: [{ title: "Invalida", start: { chapter: 1 }, end: { chapter: 1, verse: 3 } }],
    }])).toBe(false);
    expect(isBibleBookData({ abbrev: "gn", chapters: [["No principio"]] })).toBe(false);
  });
});
