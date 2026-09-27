import { STATUS_CODES } from "node:http";
import http from "node:http";
import https from "node:https";
import type { RedirectHop, RedirectObservation, RedirectTraceResponse } from "@/lib/redirect-types";
import { MAX_REDIRECTS, REQUEST_TIMEOUT_MS, normalizeInput, resolvePublicAddress } from "@/lib/redirect-security";

export const runtime = "nodejs";

type RequestResult = { status: number; statusDescription: string; location?: string };

function requestHop(url: URL, address: { address: string; family: number }, method: "HEAD" | "GET"): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const requestModule = url.protocol === "https:" ? https : http;
    const request = requestModule.request({
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ""),
      port: url.port || undefined,
      path: `${url.pathname || "/"}${url.search}`,
      method,
      headers: { accept: "*/*", "user-agent": "SCNZOS-SecureLab-RedirectTracer/1.0" },
      timeout: REQUEST_TIMEOUT_MS,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      servername: url.hostname.replace(/^\[|\]$/g, ""),
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = typeof response.headers.location === "string" ? response.headers.location : undefined;
      response.destroy();
      resolve({ status, statusDescription: STATUS_CODES[status] ?? "Unknown status", ...(location ? { location } : {}) });
    });
    request.once("timeout", () => request.destroy(new Error("timeout")));
    request.once("error", reject);
    request.end();
  });
}

async function requestWithHeadFallback(url: URL, address: { address: string; family: number }) {
  const head = await requestHop(url, address, "HEAD");
  if (head.status === 405 || head.status === 501) return requestHop(url, address, "GET");
  return head;
}

function safeHop(url: URL, step: number, result: RequestResult, isFinal: boolean): RedirectHop {
  return { step, url: url.toString(), protocol: url.protocol === "https:" ? "HTTPS" : "HTTP", hostname: url.hostname.replace(/^\[|\]$/g, ""), status: result.status, statusDescription: result.statusDescription, ...(result.location ? { location: result.location } : {}), isRedirect: result.status >= 300 && result.status < 400, isFinal };
}

function observationsFor(hops: RedirectHop[]): RedirectObservation[] {
  const observations: RedirectObservation[] = [];
  for (let index = 1; index < hops.length; index += 1) {
    const previous = hops[index - 1];
    const current = hops[index];
    if (previous.protocol === "HTTPS" && current.protocol === "HTTP") observations.push({ kind: "warning", label: "HTTPS downgraded to HTTP", detail: "A redirect moves from an encrypted connection to HTTP." });
    if (previous.protocol === "HTTP" && current.protocol === "HTTPS") observations.push({ kind: "info", label: "HTTP upgraded to HTTPS", detail: "A redirect moves to an encrypted connection." });
    if (previous.hostname !== current.hostname) observations.push({ kind: "info", label: "Cross-domain redirect", detail: "The hostname changes between these steps." });
    else observations.push({ kind: "info", label: "Same-domain redirect", detail: "The hostname stays the same for this step." });
  }
  if (hops.length > 5) observations.push({ kind: "warning", label: "Long redirect chain", detail: "This trace used more than five requests." });
  return observations;
}

export async function POST(request: Request) {
  let body: { url?: unknown };
  try { body = await request.json() as { url?: unknown }; } catch { return Response.json({ ok: false, hops: [], observations: [], error: "Send a valid URL to trace." } satisfies RedirectTraceResponse, { status: 400 }); }
  try {
    let current = normalizeInput(body.url);
    const visited = new Set<string>();
    const hops: RedirectHop[] = [];
    let traceError: string | undefined;
    for (let step = 1; step <= MAX_REDIRECTS + 1; step += 1) {
      const key = current.toString();
      if (visited.has(key)) { traceError = "Redirect loop detected."; break; }
      visited.add(key);
      const address = await resolvePublicAddress(current.hostname);
      const result = await requestWithHeadFallback(current, address);
      const isRedirect = result.status >= 300 && result.status < 400;
      if (!isRedirect || !result.location) {
        hops.push(safeHop(current, step, result, true));
        break;
      }
      hops.push(safeHop(current, step, result, false));
      try { current = normalizeInput(new URL(result.location, current).toString()); } catch { traceError = "The redirect target was invalid or unsupported."; break; }
      if (step === MAX_REDIRECTS + 1) traceError = "Too many redirects.";
    }
    const observations = observationsFor(hops);
    const final = hops.find((hop) => hop.isFinal);
    if (traceError) return Response.json({ ok: false, hops, observations, ...(final ? { final: { url: final.url, status: final.status, statusDescription: final.statusDescription, protocol: final.protocol, hostname: final.hostname } } : {}), error: traceError } satisfies RedirectTraceResponse, { status: 400 });
    return Response.json({ ok: true, hops, observations, ...(final ? { final: { url: final.url, status: final.status, statusDescription: final.statusDescription, protocol: final.protocol, hostname: final.hostname } } : {}) } satisfies RedirectTraceResponse);
  } catch (error) {
    const message = error instanceof Error && ["Enter a valid URL.", "Enter a URL to trace.", "Enter a valid URL, such as https://example.com.", "Only HTTP and HTTPS URLs can be traced.", "URLs containing usernames or passwords are not accepted.", "The URL must include a hostname.", "This destination is not available for tracing.", "The destination could not be reached."].includes(error.message) ? error.message : "The URL could not be traced. It may be unreachable, blocked, or timed out.";
    return Response.json({ ok: false, hops: [], observations: [], error: message } satisfies RedirectTraceResponse, { status: 400 });
  }
}
