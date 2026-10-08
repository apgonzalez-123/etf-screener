# Plan: static prototype (phases 0–3)

**Goal.** A hosted, clickable prototype on real data that bankers can review before the platform build starts.

**Shape.** No backend: a Python job snapshots the sources into JSON; a static React app reads it. The snapshot reruns hourly in GitHub Actions. `web/src/lib/data.ts` is the provider seam the live `equity-etf-service` replaces.

**Out of scope here.** Platform SSO, entitlements, watchlist sharing, order routing, Postgres/Redis, licensed vendor feeds, the AI layer. Live quotes (snapshot only, shown with a "Delayed" badge).

**Schema changes.** None to shared platform schemas. Snapshot JSON shapes are in `pipeline/models.py` and `web/src/lib/types.ts`.

**Exit.** Acceptance tests 1–9, 12, 13, 15–17, 19, 21 automated and passing. Tests 7 (≥ 100 holders) and 8 (SPY vs VOO) need multi-issuer holdings: the prototype tests them against SPDR-only coverage (SPY vs SPYM). Tests 14, 18, 20 need the live feed and AI layer.
