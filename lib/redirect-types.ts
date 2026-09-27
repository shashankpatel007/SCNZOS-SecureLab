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
};
