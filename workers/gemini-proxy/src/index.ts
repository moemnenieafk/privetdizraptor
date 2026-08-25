/**
 * gemini-proxy — reverse proxy to Google Gemini (Generative Language API).
 *
 * Purpose: bypass the regional egress block. Requests originating from RU / Timeweb
 * hit `FAILED_PRECONDITION: User location is not supported`. Cloudflare's egress is
 * trusted, so routing the call through this Worker fixes it.
 *
 * Contract:
 *   - Only POST, only paths matching /v1beta/{...}:(generateContent|streamGenerateContent).
 *   - Forwards to https://generativelanguage.googleapis.com preserving path + query.
 *   - Passes through `content-type` and `x-goog-api-key` headers and the request body.
 *   - Returns Google's response verbatim (status + body).
 *   - Everything else → 404. The API key is never stored.
 */

const UPSTREAM = "https://generativelanguage.googleapis.com";
const PATH_RE = /^\/v1beta\/.+:(generateContent|streamGenerateContent)$/;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST" || !PATH_RE.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    const apiKey = request.headers.get("x-goog-api-key");
    if (contentType) headers.set("content-type", contentType);
    if (apiKey) headers.set("x-goog-api-key", apiKey);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: request.body,
    });

    // Return Google's response 1:1 (status + body + headers).
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });
  },
};
