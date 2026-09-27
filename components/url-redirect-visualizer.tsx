"use client";

import { FormEvent, useState } from "react";
import type { RedirectTraceResponse } from "@/lib/redirect-types";

function formatStatus(hop: { status: number; statusDescription: string }) {
  return `${hop.status} ${hop.statusDescription}`;
}

export function UrlRedirectVisualizer() {
  const [url, setUrl] = useState("");
  const [trace, setTrace] = useState<RedirectTraceResponse | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsTracing(true);
    setError(null);
    setTrace(null);
    try {
      const response = await fetch("/api/redirect-trace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await response.json() as RedirectTraceResponse;
      if (!response.ok || !data.ok) { setError(data.error ?? "The URL could not be traced."); return; }
      setTrace(data);
    } catch {
      setError("The trace could not be completed. Check your connection and try again.");
    } finally {
      setIsTracing(false);
    }
  }

  return <div className="url-visualizer">
    <form className="url-form" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="redirect-url">URL to trace</label>
      <input id="redirect-url" type="text" inputMode="url" autoComplete="url" placeholder="Enter a URL (e.g. https://example.com)" value={url} onChange={(event) => setUrl(event.target.value)} disabled={isTracing} />
      <button className="button button-light" type="submit" disabled={isTracing || !url.trim()}>{isTracing ? "Tracing…" : "Trace URL"}</button>
    </form>
    <p className="workspace-caption">The trace runs through a protected server endpoint. URLs are processed for the duration of the trace and are not stored by the application.</p>
    {error ? <div className="tool-error" role="alert"><strong>Trace failed</strong><span>{error}</span></div> : null}
    {isTracing ? <p className="processing-status" role="status" aria-live="polite">Tracing redirect chain…</p> : null}
    {trace ? <TraceReport trace={trace} /> : <section className="redirect-panel"><h2>Redirect chain</h2><div className="redirect-empty"><svg aria-hidden="true" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="7" r="3" /><circle cx="27" cy="27" r="3" /><path d="M11 10v11c0 4 4 6 8 6h5M14 12l10 8" /></svg><p>Enter a URL to see its redirect chain.</p></div></section>}
  </div>;
}

function TraceReport({ trace }: { trace: RedirectTraceResponse }) {
  return <div className="trace-report">
    <section className="redirect-panel"><div className="trace-panel-heading"><h2>Redirect chain</h2><span>{trace.hops.length} {trace.hops.length === 1 ? "request" : "requests"}</span></div><div className="trace-chain">{trace.hops.map((hop, index) => <div className="trace-step-wrap" key={`${hop.step}-${hop.url}`}><article className={`trace-step ${hop.isFinal ? "trace-step-final" : ""}`}><div className="trace-step-meta"><span className="trace-step-number">{hop.step}</span><span className="trace-step-status">{formatStatus(hop)}</span><span className="trace-step-protocol">{hop.protocol}</span></div><strong className="trace-step-host">{hop.hostname}</strong><span className="trace-step-url">{hop.url}</span>{hop.location ? <span className="trace-step-location">→ {hop.location}</span> : null}{hop.isFinal ? <span className="trace-final-label">Final destination</span> : null}</article>{index < trace.hops.length - 1 ? <span className="trace-arrow" aria-hidden="true">↓</span> : null}</div>)}</div></section>
    {trace.final ? <section className="final-destination"><h2>Final destination</h2><strong>{trace.final.url}</strong><div><span>Final status <b>{formatStatus(trace.final)}</b></span><span>Protocol <b>{trace.final.protocol}</b></span><span>Hostname <b>{trace.final.hostname}</b></span></div></section> : null}
    {trace.observations.length ? <section className="trace-observations"><h2>Observations</h2>{trace.observations.map((observation, index) => <div className={`observation observation-${observation.kind}`} key={`${observation.label}-${index}`}><strong>{observation.label}</strong><span>{observation.detail}</span></div>)}</section> : null}
  </div>;
}
