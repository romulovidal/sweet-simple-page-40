import { getCharacter, CHARACTERS } from "../data/characters";
import { getEvent, EVENTS } from "../data/events";
import { getPlace, PLACES } from "../data/places";
import { getBook, BOOKS } from "../data/books";
import { getPeriod } from "../data/periods";
import type { HistoriaCharacter, HistoriaEvent, HistoriaPlace, HistoriaBook } from "../types";

export function relatedForCharacter(c: HistoriaCharacter) {
  const events = EVENTS.filter(
    (e) => e.characterIds?.includes(c.id) || (c.eventIds ?? []).includes(e.id)
  );
  const places = PLACES.filter((p) => (c.placeIds ?? []).includes(p.id));
  const books = BOOKS.filter((b) => (c.bookIds ?? []).includes(b.id) || b.periodId === c.periodId);
  const contemporaries = CHARACTERS.filter(
    (o) => o.id !== c.id && o.periodId === c.periodId && Math.abs(o.year - c.year) <= 120
  );
  return { events, places, books: books.slice(0, 6), contemporaries };
}

export function relatedForEvent(e: HistoriaEvent) {
  const characters = (e.characterIds ?? []).map(getCharacter).filter(Boolean) as HistoriaCharacter[];
  const places = (e.placeIds ?? []).map(getPlace).filter(Boolean) as HistoriaPlace[];
  const period = getPeriod(e.periodId);
  const nearbyEvents = EVENTS
    .filter((x) => x.id !== e.id && x.periodId === e.periodId)
    .sort((a, b) => Math.abs(a.year - e.year) - Math.abs(b.year - e.year))
    .slice(0, 4);
  return { characters, places, period, nearbyEvents };
}

export function relatedForPlace(p: HistoriaPlace) {
  const events = EVENTS.filter((e) => e.placeIds?.includes(p.id));
  const characters = CHARACTERS.filter((c) => c.placeIds?.includes(p.id));
  return { events, characters };
}

export function relatedForBook(b: HistoriaBook) {
  const period = getPeriod(b.periodId);
  const characters = CHARACTERS.filter((c) => c.periodId === b.periodId).slice(0, 8);
  const events = EVENTS.filter((e) => e.periodId === b.periodId).slice(0, 6);
  return { period, characters, events };
}

export { getCharacter, getEvent, getPlace, getBook, getPeriod };
