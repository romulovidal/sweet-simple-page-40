import { buildDestinationInsights } from "./destination-insights.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("aggregates routes, health and activity without message content", () => {
  const insights = buildDestinationInsights([
    { status: "replied", assistant_route: "bible_lookup", metadata: { context_source: "memory" }, received_at: "2026-08-17T12:05:00Z" },
    { status: "replied", assistant_route: "bible_lookup", metadata: {}, received_at: "2026-08-17T12:20:00Z" },
    { status: "failed", assistant_route: "ask_bible", metadata: {}, received_at: "2026-08-18T12:20:00Z" },
    { status: "ignored", assistant_route: null, metadata: {}, received_at: "2026-08-18T14:20:00Z" },
  ], "group");

  assert(insights.total === 4, "must count all operational interactions");
  assert(insights.replied === 2 && insights.failed === 1 && insights.ignored === 1, "must split statuses");
  assert(insights.reply_success_rate === 66.7, "success rate excludes ignored messages");
  assert(insights.top_routes[0]?.route === "bible_lookup" && insights.top_routes[0]?.count === 2, "must rank routes");
  assert(insights.active_days === 2, "must count active days");
  assert(insights.memory_hits === 1, "must expose structured memory usage");
});

Deno.test("recommends study mode only from repeated study-route usage", () => {
  const rows = [
    { status: "replied", assistant_route: "exegetai", received_at: "2026-08-17T10:00:00Z" },
    { status: "replied", assistant_route: "connections", received_at: "2026-08-17T10:02:00Z" },
    { status: "replied", assistant_route: "timeline", received_at: "2026-08-17T10:04:00Z" },
    { status: "replied", assistant_route: "bible_lookup", received_at: "2026-08-17T10:06:00Z" },
  ];
  const insights = buildDestinationInsights(rows, "contact");
  assert(insights.recommendations.some((item) => item.includes("modo Estudo")), "repeated study use should create a manual recommendation");
});

Deno.test("degraded replies stay visible separately from hard failures", () => {
  const insights = buildDestinationInsights([
    { status: "replied", assistant_route: "ask_bible", metadata: { degraded: true }, received_at: "2026-08-17T10:00:00Z" },
  ], "individual");
  assert(insights.degraded === 1 && insights.failed === 0, "degraded reply must not become a hard failure");
  assert(insights.recommendations.some((item) => item.includes("degradada")), "degraded use should be reviewable");
});
