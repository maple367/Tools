# Maple favicon URL resolver

Deployable module: **`worker.js`**, self-contained ES module with no runtime imports. Do not upload `test-worker.js`. The production Worker has been deployed separately from the static homepage.

Expected endpoint: `https://maple-home-icons.haihuang367.workers.dev/resolve?url=https%3A%2F%2Fwww.incopat.com%2F`

## Deployed service

- Health: https://maple-home-icons.haihuang367.workers.dev/health
- Worker name: `maple-home-icons`; workers.dev enabled, preview URLs disabled.
- Downloaded source SHA-256 matches local: `730dff5131057917fba0b9200b1ef7c9a75e63c427c43f591d1d8a83c35871d5`.
- Production GET tests returned the correct declaration URLs for incoPat and Maple. A real Edge end-to-end run loaded actual 48×48 and 256×256 icons respectively, saved only URL metadata, and on reload needed no resolver request.
- Production tests: allowed CORS origins work, private literal target returns 400, unauthorized Origin returns 403. Existing Workers remained unchanged. No subscription or DNS settings were modified. The implementation requires only Workers Free-compatible features.

## REST upload contract

Use `upload-metadata.json` as the multipart `metadata` JSON part. Upload `worker.js` as a module part named `worker.js`, content type `application/javascript+module`. The main module must be `worker.js`; the required binding is:

```json
{"type":"ratelimit","name":"RATE_LIMITER","namespace_id":"36720261103","simple":{"limit":30,"period":60}}
```

`wrangler.jsonc` has the equivalent local/dev configuration and script name `maple-home-icons`. No secrets, KV, external favicon service, or paid npm runtime dependencies are needed. Use the Free plan; platform request/CPU limits still apply. Built-in limits are per Cloudflare location and approximate, not a global quota. `/resolve` fails closed with 503 if the binding is missing or throws. `/health` works without it and returns `{"ok":true,"version":"maple-home-icons-v1","rateLimiter":true}` when present. The boolean reports binding presence, not a rate-limiter health probe.

## API and privacy

Only GET `/resolve?url=...` and GET `/health` are supported. `/resolve` outputs JSON such as:

```json
{"iconUrl":"https://www.incopat.com/resources/css/images/favicon.ico","origin":"https://www.incopat.com","source":"html","verified":false}
```

`source: html` means declared in HTML, NOT image-fetched or image-verified. `source: fallback` means the unverified original-origin `/favicon.ico` guess; `reason` explains why. The browser must still handle image loading errors. No image, CSS, or HTML is proxied. Initial bookmark paths, queries and fragments are discarded before homepage fetch, resolution and cache-key construction. Normal public homepage redirects may contain their own paths/queries. No client cookies, credentials, Referer or authorization are forwarded, and the script contains no logging. Cloudflare observability and Logpush are disabled in both supplied deployment configurations; the caller should likewise avoid logging full incoming URLs.

Exact CORS origins: `https://home.maple367.eu.org`, `http://127.0.0.1:8765`, `http://localhost:8765`. Missing Origin is accepted for CLI GET; any other Origin gets 403. CORS does not authenticate CLI callers; IP-based rate limiting is still essential. The browser should use simple GET without custom headers (OPTIONS is intentionally 405).

## Safety and bounds

- Only HTTP(S), ports 80/443, valid dotted DNS hostnames, no credentials/IP literals/single-label or known internal suffixes. Alternate IPv4 URL encodings are normalized by URL parsing then rejected.
- Fixed Cloudflare DNS-over-HTTPS endpoint, A AND AAAA, inspect every Answer address and CNAME, recursively validate CNAME chains. Mixed public/private answers fail closed. IPv4 private, loopback, link-local, shared, documentation, multicast/reserved ranges are rejected. IPv6 accepts global unicast only, excluding mapped IPv4, ULA, link-local, NAT64, 6to4 and special/documentation ranges.
- DNS response cap 64 KiB, 64 answers, five-name chain and 24 DNS fetches per resolution. No automatic redirects: at most three hops, with URL and DNS validation before each fetched target. Icon candidate hosts also pass URL/DNS checks, though images are never fetched.
- Total resolution deadline 7.5 seconds, including DNS and HTML parsing; AbortController cancels in-flight fetches. HTML capped at 512 KiB, checking both Content-Length and streamed bytes. Non-HTML/error/blocked upstreams produce an explicitly unverified fallback where safe.
- Actual Cloudflare HTMLRewriter extracts `link[rel]`: icon/shortcut icon preferred over apple-touch-icon; stylesheets ignored; first base[href] only; relative links use the final redirected page URL. Numeric references and ASCII/Latin-1 named character references are decoded before URL interpretation. The bounded named-entity subset is embedded to keep the upload module self-contained; uncommon other HTML5 named references remain literal, so their URLs may not resolve correctly.
- Cache API keys contain only original origin. HTML declarations cached seven days, fallbacks five minutes. CORS headers are applied per request, not cached; limiter runs before cache lookup. Public JSON responses use no-store to avoid shared-client caching. Errors are not cached.

**Residual DNS rebinding risk:** DoH is a preflight validation, NOT an IP pin. `fetch(hostname)` resolves DNS again through Cloudflare's own resolver. A hostile hostname can change between the validation and the actual connection. Workers' standard fetch API here does not pin the validated address. This implementation reduces SSRF exposure but does not claim complete DNS-rebinding prevention. Cross-origin icons/redirects are allowed only after equivalent validation. A stricter threat model requires an egress service that binds validated IPs or a maintained domain allowlist. Cached declared URLs can also change ownership/content; they remain unverified.

## Local verification

From the repository's `worker/` directory:

```sh
npm ci --no-audit --no-fund
npm test
npm run test:live
# On this Windows host, native workerd networking bypasses the HTTP proxy:
CURL_TRANSPORT=1 npm run test:live
```

`npm test` executes 14 groups inside real Cloudflare workerd via Miniflare, with real HTMLRewriter and Cache API, injecting public-network DNS/HTML fixtures only. Tests cover hostile URLs/IP formats, private IPv4/IPv6, mixed DNS and CNAME chains, redirects/private redirect DNS, content limits/types/upstream failure, base tags/entity/rel/CSS parsing, exact CORS, missing/failing/denied limiter, cache TTL/key privacy and the actual 7.5-second deadline. This is not a deployed edge test.

`test:live` loads the exact production worker module with the actual workerd built-in RATE_LIMITER and requests the two real sites. It separately issues 31 requests on one test IP and verifies 30 pass rate limiting (400 for intentionally invalid URL), then the 31st gets 429. Direct workerd outbound networking on this host failed with Windows WSARecv error 64; both direct live lookups returned 502. The optional CURL_TRANSPORT routes outbound requests through Miniflare's host transport using curl, preserving real target URLs and fetching real DoH/site responses; it is not a fixture and is test-only.

Verified with CURL_TRANSPORT: both returned 200/source=html in under one second each, resolving respectively:

- `https://www.incopat.com/resources/css/images/favicon.ico`
- `https://imgs.maple367.eu.org/maple_logo.ico`

These prove real HTML declaration discovery, not image availability or deployed-Cloudflare connectivity. Deployed connectivity has additionally been verified as described above. Neither command contacts Cloudflare account APIs or deploys anything. `npm run dev` is available for an optional local Wrangler server, without Wrangler authentication. All npm packages are development-only; `node_modules/` and `.wrangler/` are ignored.
