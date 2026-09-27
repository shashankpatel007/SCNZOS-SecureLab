import dns from "node:dns/promises";
import net from "node:net";

export const MAX_REDIRECTS = 10;
export const REQUEST_TIMEOUT_MS = 8000;

function ipv4Parts(address: string) {
  return address.split(".").map(Number);
}

function isPrivateIPv4(address: string) {
  const [a, b, c] = ipv4Parts(address);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113) || a >= 224;
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const mappedIPv4 = normalized.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  return mappedIPv4 ? isPrivateIPv4(mappedIPv4) : false;
}

export function isPrivateAddress(address: string) {
  const cleanAddress = address.replace(/^\[|\]$/g, "");
  return net.isIP(cleanAddress) === 4 ? isPrivateIPv4(cleanAddress) : isPrivateIPv6(cleanAddress);
}

export function normalizeInput(rawInput: unknown) {
  if (typeof rawInput !== "string") throw new Error("Enter a valid URL.");
  const input = rawInput.trim();
  if (!input) throw new Error("Enter a URL to trace.");
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid URL, such as https://example.com.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only HTTP and HTTPS URLs can be traced.");
  if (parsed.username || parsed.password) throw new Error("URLs containing usernames or passwords are not accepted.");
  if (!parsed.hostname) throw new Error("The URL must include a hostname.");
  parsed.hash = "";
  return parsed;
}

export async function resolvePublicAddress(hostname: string) {
  const cleanHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (cleanHostname === "localhost" || cleanHostname.endsWith(".localhost") || cleanHostname.endsWith(".local") || cleanHostname.endsWith(".internal") || cleanHostname === "metadata" || cleanHostname === "metadata.google.internal" || cleanHostname === "instance-data.ec2.internal") throw new Error("This destination is not available for tracing.");
  if (net.isIP(cleanHostname) && isPrivateAddress(cleanHostname)) throw new Error("This destination is not available for tracing.");
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(cleanHostname, { all: true, verbatim: true });
  } catch {
    throw new Error("The destination could not be reached.");
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("This destination is not available for tracing.");
  return addresses[0];
}
