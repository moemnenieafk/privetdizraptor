/**
 * gemini-proxy — reverse proxy to Google Gemini (Generative Language API).
 *
 * Purpose: bypass the regional egress block. Requests originating from RU / Timeweb
 * hit `FAILED_PRECONDITION: User location is not supported`. Cloudflare's egress is
 * trusted, so routing the call through this Worker fixes it.
 *
 * Two routes are proxied to https://generativelanguage.googleapis.com (path + query 1:1):
 *
 *   1. Native API — POST /v1beta/{...}:(generateContent|streamGenerateContent)
 *      Auth: `x-goog-api-key` header (forwarded as-is).
 *
 *   2. OpenAI-compat layer — /v1beta/openai/*  (GET + POST)
 *      e.g. GET /v1beta/openai/models, POST /v1beta/openai/chat/completions,
 *      POST /v1beta/openai/images/... — used by Open WebUI.
 *      Auth: `Authorization: Bearer <key>` header (forwarded as-is).
 *
 * Google's response is returned verbatim (status + body + headers), streaming included.
 * Everything else → 404. The API key is never stored — it always arrives from the client.
 */

// Native Gemini calls go through ProxyAPI (RU-payable, ruble billing, no geoblock).
// ProxyAPI mirrors Google's native path under /google and auths via Authorization: Bearer.
const UPSTREAM = "https://generativelanguage.googleapis.com"; // OpenAI-compat path (Open WebUI) — TODO: repoint to ProxyAPI
const PROXYAPI_UPSTREAM = "https://api.proxyapi.ru/google";
const NATIVE_RE = /^\/v1beta\/.+:(generateContent|streamGenerateContent)$/;
const OPENAI_RE = /^\/v1beta\/openai\/.+$/;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { method, pathname } = { method: request.method, pathname: url.pathname };

    const isNative = method === "POST" && NATIVE_RE.test(pathname);
    const isOpenAI = (method === "POST" || method === "GET") && OPENAI_RE.test(pathname);

    if (!isNative && !isOpenAI) {
      return new Response("Not found", { status: 404 });
    }

    const base = isNative ? PROXYAPI_UPSTREAM : UPSTREAM;
    const upstreamUrl = base + pathname + url.search;

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    if (isOpenAI) {
      // OpenAI-compat authenticates via Authorization: Bearer <key>.
      const auth = request.headers.get("authorization");
      if (auth) headers.set("authorization", auth);
    } else {
      // Native path → ProxyAPI, which authenticates via Authorization: Bearer <ProxyAPI key>.
      // Clients still send the key in x-goog-api-key; translate it to a Bearer token.
      const apiKey =
        request.headers.get("x-goog-api-key") ??
        (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (apiKey) headers.set("authorization", `Bearer ${apiKey}`);
    }

    // GET has no body; Response.body would be null anyway, but keep it explicit.
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body: method === "GET" ? undefined : request.body,
    });

    // Return Google's response 1:1 (status + body + headers), streaming included.
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });
  },
};
