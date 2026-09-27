import type { LookupAddress } from "node:dns";
import { STATUS_CODES } from "node:http";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { RedirectHop, RedirectObservation, RedirectTraceResponse, TraceErrorCode } from "@/lib/redirect-types";
import {
  MAX_REDIRECTS,
  REQUEST_TIMEOUT_MS,
  TraceError,
  classifyNetworkError,
  normalizeInput,
  resolvePublicAddresses,
} from "@/lib/redirect-security";

export const runtime = "nodejs";

type RequestResult = {
  status: number;
  statusDescription: string;
  location?: string;
};

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function requestHop(
  url: URL,
  addresses: Array<{ address: string; family: number }>,
  method: "HEAD" | "GET"
): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const requestModule = isHttps ? https : http;
    const cleanHostname = url.hostname.replace(/^\[|\]$/g, "");

    const customLookup = (
      _hostname: string,
      options: unknown,
      callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
    ) => {
      let opt: { all?: boolean } = {};
      let cb = callback;
      if (typeof options === "function") {
        cb = options as typeof callback;
      } else if (options && typeof options === "object") {
        opt = options as { all?: boolean };
      }

      if (opt.all) {
        cb(null, addresses as LookupAddress[]);
      } else {
        cb(null, addresses[0].address, addresses[0].family);
      }
    };

    let settled = false;

    const req = requestModule.request(
      {
        protocol: url.protocol,
        hostname: cleanHostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname || "/"}${url.search}`,
        method,
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": BROWSER_USER_AGENT,
          connection: "close",
        },
        timeout: REQUEST_TIMEOUT_MS,
        lookup: customLookup,
        servername: net.isIP(cleanHostname) ? undefined : cleanHostname,
      },
      (res) => {
        if (settled) return;
        settled = true;

        const status = res.statusCode ?? 0;
        let location = typeof res.headers.location === "string" ? res.headers.location : undefined;

        // Strip credentials from location header if present so they are never stored or displayed
        if (location) {
          try {
            const locUrl = new URL(location, url);
            if (locUrl.username || locUrl.password) {
              locUrl.username = "";
              locUrl.password = "";
              location = locUrl.toString();
            }
          } catch {
            // Keep original location string if unparseable
          }
        }

        // Abort incoming stream immediately to avoid downloading or buffering response bodies
        res.destroy();
        req.destroy();

        resolve({
          status,
          statusDescription: STATUS_CODES[status] ?? "Unknown status",
          ...(location ? { location } : {}),
        });
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      if (settled) return;
      settled = true;
      req.destroy(new TraceError("TIMEOUT", "The request timed out while contacting the destination."));
    });

    req.once("error", (err) => {
      if (settled) return;
      settled = true;
      reject(classifyNetworkError(err));
    });

    req.end();
  });
}

async function requestWithHeadFallback(
  url: URL,
  addresses: Array<{ address: string; family: number }>
): Promise<RequestResult> {
  try {
    const headResult = await requestHop(url, addresses, "HEAD");
    const isRedirectWithLocation = headResult.status >= 300 && headResult.status < 400 && Boolean(headResult.location);
    const isSuccessful = headResult.status >= 200 && headResult.status < 300;

    // If HEAD succeeded with 2xx or provided a redirect Location, use it
    if (isRedirectWithLocation || isSuccessful) {
      return headResult;
    }

    // Server rejected HEAD (e.g. 405 Method Not Allowed, 501, 403, 400)
    // or returned a redirect without Location header. Safely fall back to GET.
    return await requestHop(url, addresses, "GET");
  } catch (error) {
    // If HEAD failed with a transport/protocol error (e.g. server closed connection on HEAD), try GET
    try {
      return await requestHop(url, addresses, "GET");
    } catch {
      // If GET also fails, throw classified error from the failure
      throw error;
    }
  }
}

function safeHop(url: URL, step: number, result: RequestResult, isFinal: boolean): RedirectHop {
  const cleanUrl = new URL(url.toString());
  cleanUrl.username = "";
  cleanUrl.password = "";

  let cleanLocation = result.location;
  if (cleanLocation) {
    try {
      const parsedLoc = new URL(cleanLocation, url);
      parsedLoc.username = "";
      parsedLoc.password = "";
      if (/^[a-z][a-z\d+.-]*:\/\//i.test(cleanLocation)) {
        cleanLocation = parsedLoc.toString();
      }
    } catch {
      // Keep original location string if unparseable
    }
  }

  return {
    step,
    url: cleanUrl.toString(),
    protocol: cleanUrl.protocol === "https:" ? "HTTPS" : "HTTP",
    hostname: cleanUrl.hostname.replace(/^\[|\]$/g, ""),
    status: result.status,
    statusDescription: result.statusDescription,
    ...(cleanLocation ? { location: cleanLocation } : {}),
    isRedirect: result.status >= 300 && result.status < 400,
    isFinal,
  };
}

function observationsFor(hops: RedirectHop[]): RedirectObservation[] {
  const observations: RedirectObservation[] = [];
  for (let index = 1; index < hops.length; index += 1) {
    const previous = hops[index - 1];
    const current = hops[index];
    if (previous.protocol === "HTTPS" && current.protocol === "HTTP") {
      observations.push({
        kind: "warning",
        label: "HTTPS downgraded to HTTP",
        detail: "A redirect moves from an encrypted connection to HTTP.",
      });
    }
    if (previous.protocol === "HTTP" && current.protocol === "HTTPS") {
      observations.push({
        kind: "info",
        label: "HTTP upgraded to HTTPS",
        detail: "A redirect moves to an encrypted connection.",
      });
    }
    if (previous.hostname !== current.hostname) {
      observations.push({
        kind: "info",
        label: "Cross-domain redirect",
        detail: "The hostname changes between these steps.",
      });
    } else {
      observations.push({
        kind: "info",
        label: "Same-domain redirect",
        detail: "The hostname stays the same for this step.",
      });
    }
  }
  if (hops.length > 5) {
    observations.push({
      kind: "warning",
      label: "Long redirect chain",
      detail: "This trace used more than five requests.",
    });
  }

  const finalHop = hops.find((h) => h.isFinal);
  if (finalHop && (finalHop.status === 401 || finalHop.status === 403 || finalHop.status === 429)) {
    observations.push({
      kind: "warning",
      label: "Automated access restricted",
      detail: `The destination returned HTTP ${finalHop.status} (${finalHop.statusDescription}), indicating that automated requests or direct access may be restricted.`,
    });
  }

  return observations;
}

export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return Response.json(
      {
        ok: false,
        hops: [],
        observations: [],
        error: "Send a valid URL to trace.",
        errorCode: "INVALID_URL",
      } satisfies RedirectTraceResponse,
      { status: 400 }
    );
  }

  let current: URL;
  try {
    current = normalizeInput(body.url);
  } catch (error) {
    const classified = classifyNetworkError(error);
    return Response.json(
      {
        ok: false,
        hops: [],
        observations: [],
        error: classified.message,
        errorCode: classified.code,
      } satisfies RedirectTraceResponse,
      { status: 400 }
    );
  }

  const visited = new Set<string>();
  const hops: RedirectHop[] = [];
  let traceError: { message: string; code: TraceErrorCode } | undefined;

  for (let step = 1; step <= MAX_REDIRECTS + 1; step += 1) {
    const key = current.toString();
    if (visited.has(key)) {
      traceError = { message: "Redirect loop detected.", code: "REDIRECT_LOOP" };
      break;
    }
    visited.add(key);

    if (step > MAX_REDIRECTS) {
      traceError = { message: "Too many redirects (maximum limit reached).", code: "TOO_MANY_REDIRECTS" };
      break;
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await resolvePublicAddresses(current.hostname);
    } catch (error) {
      const classified = classifyNetworkError(error);
      traceError = { message: classified.message, code: classified.code };
      break;
    }

    let result: RequestResult;
    try {
      result = await requestWithHeadFallback(current, addresses);
    } catch (error) {
      const classified = classifyNetworkError(error);
      traceError = { message: classified.message, code: classified.code };
      break;
    }

    const isRedirect = result.status >= 300 && result.status < 400;

    if (!isRedirect || !result.location) {
      hops.push(safeHop(current, step, result, true));
      break;
    }

    hops.push(safeHop(current, step, result, false));

    let nextUrl: URL;
    try {
      const resolvedLocation = new URL(result.location, current).toString();
      nextUrl = normalizeInput(resolvedLocation);
    } catch (error) {
      const classified = classifyNetworkError(error);
      traceError = {
        message:
          classified.code === "UNSUPPORTED_PROTOCOL"
            ? "The redirect target used an unsupported protocol."
            : "The redirect target was invalid or unsupported.",
        code: classified.code,
      };
      break;
    }

    current = nextUrl;
  }

  const observations = observationsFor(hops);
  const final = hops.find((hop) => hop.isFinal);

  if (traceError) {
    return Response.json(
      {
        ok: false,
        hops,
        observations,
        ...(final
          ? {
              final: {
                url: final.url,
                status: final.status,
                statusDescription: final.statusDescription,
                protocol: final.protocol,
                hostname: final.hostname,
              },
            }
          : {}),
        error: traceError.message,
        errorCode: traceError.code,
      } satisfies RedirectTraceResponse,
      { status: 400 }
    );
  }

  return Response.json({
    ok: true,
    hops,
    observations,
    ...(final
      ? {
          final: {
            url: final.url,
            status: final.status,
            statusDescription: final.statusDescription,
            protocol: final.protocol,
            hostname: final.hostname,
          },
        }
      : {}),
  } satisfies RedirectTraceResponse);
}

