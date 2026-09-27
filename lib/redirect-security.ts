import dns from "node:dns/promises";
import net from "node:net";
import type { TraceErrorCode } from "@/lib/redirect-types";

export const MAX_REDIRECTS = 10;
export const REQUEST_TIMEOUT_MS = 8000;

export class TraceError extends Error {
  readonly code: TraceErrorCode;

  constructor(code: TraceErrorCode, message: string) {
    super(message);
    this.name = "TraceError";
    this.code = code;
  }
}

function ipv4Parts(address: string): number[] {
  return address.split(".").map(Number);
}

export function isPrivateIPv4(address: string): boolean {
  const parts = ipv4Parts(address);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b, c] = parts;

  // 0.0.0.0/8 (current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (RFC 1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local & cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 (6to4 relay anycast, deprecated)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (RFC 1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved & broadcast)
  if (a >= 224) return true;

  return false;
}

export function parseIPv6Words(address: string): number[] | null {
  let clean = address.toLowerCase().replace(/^\[|\]$/g, "");
  const zoneIndex = clean.indexOf("%");
  if (zoneIndex !== -1) clean = clean.slice(0, zoneIndex);

  // Parse embedded IPv4 at the end (e.g. ::ffff:192.168.1.1)
  const lastColon = clean.lastIndexOf(":");
  if (lastColon !== -1 && clean.slice(lastColon + 1).includes(".")) {
    const ipv4Str = clean.slice(lastColon + 1);
    const parts = ipv4Str.split(".").map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const high = (parts[0] << 8) | parts[1];
      const low = (parts[2] << 8) | parts[3];
      clean = `${clean.slice(0, lastColon)}:${high.toString(16)}:${low.toString(16)}`;
    } else {
      return null;
    }
  }

  const splitDouble = clean.split("::");
  if (splitDouble.length > 2) return null;

  let left = splitDouble[0] ? splitDouble[0].split(":").filter(Boolean) : [];
  const right = splitDouble[1] ? splitDouble[1].split(":").filter(Boolean) : [];

  if (splitDouble.length === 2) {
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    left = [...left, ...Array(missing).fill("0"), ...right];
  }

  if (left.length !== 8) return null;
  const words: number[] = [];
  for (const part of left) {
    const num = parseInt(part, 16);
    if (isNaN(num) || num < 0 || num > 0xffff) return null;
    words.push(num);
  }
  return words;
}

export function isPrivateIPv6(address: string): boolean {
  const words = parseIPv6Words(address);
  if (!words) return true;

  // ::/128 (unspecified)
  if (words.every((w) => w === 0)) return true;
  // ::1/128 (loopback)
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return true;

  // IPv4-mapped IPv6 (::ffff:0:0/96)
  if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) {
    const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
    return isPrivateIPv4(ipv4);
  }

  // IPv4-compatible IPv6 (deprecated, ::/96)
  if (words.slice(0, 6).every((w) => w === 0)) {
    const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
    return isPrivateIPv4(ipv4);
  }

  // NAT64 prefix (64:ff9b::/96)
  if (words[0] === 0x0064 && words[1] === 0xff9b && words.slice(2, 6).every((w) => w === 0)) {
    const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
    return isPrivateIPv4(ipv4);
  }

  // Unique Local Address (fc00::/7 -> fc00 to fdff)
  if ((words[0] & 0xfe00) === 0xfc00) return true;

  // Link-Local Unicast (fe80::/10 -> fe80 to febf)
  if ((words[0] & 0xffc0) === 0xfe80) return true;

  // Site-Local Unicast (fec0::/10, deprecated)
  if ((words[0] & 0xffc0) === 0xfec0) return true;

  // Multicast (ff00::/8)
  if ((words[0] & 0xff00) === 0xff00) return true;

  // Documentation prefix (2001:db8::/32)
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true;

  // Discard prefix (100::/64)
  if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0) return true;

  // Benchmarking (2001:2::/48)
  if (words[0] === 0x2001 && words[1] === 2 && words[2] === 0) return true;

  // 6to4 prefix (2002::/16) -> words[1] and words[2] contain IPv4
  if (words[0] === 0x2002) {
    const ipv4 = `${words[1] >> 8}.${words[1] & 0xff}.${words[2] >> 8}.${words[2] & 0xff}`;
    if (isPrivateIPv4(ipv4)) return true;
  }

  return false;
}

export function isPrivateAddress(address: string): boolean {
  const cleanAddress = address.replace(/^\[|\]$/g, "");
  const ipVer = net.isIP(cleanAddress);
  if (ipVer === 4) return isPrivateIPv4(cleanAddress);
  if (ipVer === 6) return isPrivateIPv6(cleanAddress);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const cleanHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    cleanHostname === "localhost" ||
    cleanHostname.endsWith(".localhost") ||
    cleanHostname.endsWith(".local") ||
    cleanHostname.endsWith(".internal") ||
    cleanHostname.endsWith(".lan") ||
    cleanHostname.endsWith(".home.arpa") ||
    cleanHostname.endsWith(".onion") ||
    cleanHostname === "metadata" ||
    cleanHostname === "metadata.google.internal" ||
    cleanHostname === "metadata.goog" ||
    cleanHostname === "instance-data.ec2.internal"
  ) {
    return true;
  }

  // Reject single-label internal hostnames without a dot (unless it is a valid IP)
  if (!cleanHostname.includes(".") && net.isIP(cleanHostname) === 0) {
    return true;
  }

  return false;
}

export function classifyNetworkError(error: unknown): TraceError {
  if (error instanceof TraceError) return error;

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    const msg = error.message.toLowerCase();

    if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || msg === "timeout" || msg.includes("timed out")) {
      return new TraceError("TIMEOUT", "The request timed out while contacting the destination.");
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA" || code === "EADDRNOTAVAIL") {
      return new TraceError("DNS_FAILURE", "The destination host could not be resolved.");
    }
    if (code === "ECONNRESET") {
      return new TraceError("SERVER_REFUSED", "The destination server refused the automated request.");
    }
    if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH" || code === "EPIPE") {
      return new TraceError("CONNECTION_FAILURE", "Could not connect to the destination server.");
    }
    if (
      code.startsWith("ERR_TLS_") ||
      code.startsWith("ERR_SSL_") ||
      code === "CERT_HAS_EXPIRED" ||
      code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
      code === "SELF_SIGNED_CERT_IN_CHAIN" ||
      code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
      code === "EPROTO" ||
      msg.includes("ssl") ||
      msg.includes("tls") ||
      msg.includes("certificate")
    ) {
      return new TraceError("TLS_FAILURE", "A secure TLS/SSL connection could not be established.");
    }
  }

  return new TraceError("UNEXPECTED_ERROR", "The URL could not be traced due to an unexpected error.");
}

export function normalizeInput(rawInput: unknown): URL {
  if (typeof rawInput !== "string") {
    throw new TraceError("INVALID_URL", "Enter a valid URL.");
  }
  const input = rawInput.trim();
  if (!input) {
    throw new TraceError("INVALID_URL", "Enter a URL to trace.");
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new TraceError("INVALID_URL", "Enter a valid URL, such as https://example.com.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TraceError("UNSUPPORTED_PROTOCOL", "Only HTTP and HTTPS URLs can be traced.");
  }

  if (parsed.username || parsed.password) {
    throw new TraceError("INVALID_URL", "URLs containing usernames or passwords are not accepted.");
  }

  if (!parsed.hostname || parsed.hostname === "." || parsed.hostname.startsWith("-")) {
    throw new TraceError("INVALID_URL", "The URL must include a valid hostname.");
  }

  parsed.hash = "";
  return parsed;
}

export async function resolvePublicAddresses(hostname: string): Promise<Array<{ address: string; family: number }>> {
  const cleanHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (isBlockedHostname(cleanHostname)) {
    throw new TraceError("SSRF_BLOCKED", "This destination is not available for tracing.");
  }

  if (net.isIP(cleanHostname) && isPrivateAddress(cleanHostname)) {
    throw new TraceError("SSRF_BLOCKED", "This destination is not available for tracing.");
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(cleanHostname, { all: true, verbatim: true });
  } catch (error) {
    throw classifyNetworkError(error);
  }

  if (!addresses.length) {
    throw new TraceError("DNS_FAILURE", "The destination host could not be resolved.");
  }

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new TraceError("SSRF_BLOCKED", "This destination is not available for tracing.");
  }

  return addresses;
}

export const resolvePublicAddress = resolvePublicAddresses;

