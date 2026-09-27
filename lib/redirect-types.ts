export type RedirectHop = {
  step: number;
  url: string;
  protocol: "HTTP" | "HTTPS";
  hostname: string;
  status: number;
  statusDescription: string;
  location?: string;
  isRedirect: boolean;
  isFinal: boolean;
};

export type RedirectObservation = {
  kind: "warning" | "info";
  label: string;
  detail: string;
};

export type TraceErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "SSRF_BLOCKED"
  | "DNS_FAILURE"
  | "CONNECTION_FAILURE"
  | "TLS_FAILURE"
  | "TIMEOUT"
  | "REDIRECT_LOOP"
  | "TOO_MANY_REDIRECTS"
  | "SERVER_REFUSED"
  | "UNEXPECTED_ERROR";

export type RedirectTraceResponse = {
  ok: boolean;
  hops: RedirectHop[];
  final?: {
    url: string;
    status: number;
    statusDescription: string;
    protocol: "HTTP" | "HTTPS";
    hostname: string;
  };
  observations: RedirectObservation[];
  error?: string;
  errorCode?: TraceErrorCode;
};
