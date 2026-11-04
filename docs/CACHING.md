# Lookup caching

`src/api/lookupCache.ts` stores successful lookup DTOs in memory for 120 seconds,
with at most 100 entries. It shares concurrent requests, returns an independent
copy to each consumer and isolates cancellation per consumer. Failed reads are
removed. Keys include sorted query parameters; the cache is scoped to the current
bearer token and cleared at login/logout, 401/403 permission refresh, browser focus,
online, tab visibility restoration, storage changes and realtime resync/diagnosis
or permission events. Invalidated in-flight reads cannot publish stale results.

The API client uses an explicit GET allowlist for category lists/trees, brands,
units, active ingredients, disease content and advisory problem lookups. Product
receiving lookups and packaging selectors cache only their required metadata.
The complete product management detail response still loads from the server,
including current store activation and sellability. Prices, stock, permission
responses, orders, payments, credit/debt, reports and recommendation POSTs are not
cached. Requests with custom headers or explicit HTTP cache options bypass this
lookup cache.

Successful catalog/product/disease/auth writes clear the lookup cache before
subsequent reads. Failed writes retain the last successful data. Other users'
catalog changes become visible on the next uncached read, TTL expiry or browser
resync; there is currently no catalog-specific realtime topic. Combined with the
server's default 120-second TTL, an external SQL change can remain cached across
both layers for up to about four minutes. Server-side business validation remains
authoritative.

Run `node scripts/test-lookup-cache.mjs` for isolated HTTP/cache regression checks;
the script never contacts a live backend. Also run TypeScript, build and lint.

Report caching remains deferred until a representative load measurement exists.
Measure request count, SQL execution count/time, p50/p95 response latency and error
rate per report, date range and concurrent-user level. Compare cold and repeated
reads before choosing a TTL; invalidate on the relevant committed business writes
and recheck report authorization before returning any cached result.
