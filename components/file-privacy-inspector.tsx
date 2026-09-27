"use client";

import { useRef, useState } from "react";
import {
  countFindingsBySeverity,
  getSupportedTypes,
  inspectFile,
  isSupportedFile,
  type InspectionResult,
  type PrivacyFinding,
  type Severity,
} from "@/lib/file-inspector";

const severityLabels: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

function FileSymbol() {
  return <svg aria-hidden="true" viewBox="0 0 32 32" className="upload-symbol" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M9 3h9l8 8v18H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M18 3v9h8" /></svg>;
}

function FindingsGroup({ severity, findings }: { severity: Severity; findings: PrivacyFinding[] }) {
  if (!findings.length) return null;
  return <div className="finding-group"><h3><span className={`severity-dot severity-${severity}`} aria-hidden="true" />{severityLabels[severity]} risk</h3>{findings.map((finding) => <div className="finding-row" key={`${finding.label}-${finding.value}`}><div><strong>{finding.label}</strong><span>{finding.explanation}</span></div><code>{finding.value}</code></div>)}</div>;
}

function Report({ result, onReset }: { result: InspectionResult; onReset: () => void }) {
  const counts = countFindingsBySeverity(result.findings);
  return <div className="inspection-report">
    <div className="report-header"><div><p className="report-eyebrow">Inspection report</p><h2>{result.file.name}</h2></div><button type="button" className="button button-outline" onClick={onReset}>Remove file</button></div>
    <div className="file-summary"><div><span>Type</span><strong>{result.file.type}</strong></div><div><span>Size</span><strong>{result.file.size}</strong></div><div><span>Potential findings</span><strong>{result.findings.length}</strong></div></div>
    <section className="report-section"><div className="report-section-heading"><h3>Privacy findings</h3><span>{counts.high + counts.medium} potentially sensitive</span></div>{result.findings.length ? <div className="finding-groups"><FindingsGroup severity="high" findings={result.findings.filter((item) => item.severity === "high")} /><FindingsGroup severity="medium" findings={result.findings.filter((item) => item.severity === "medium")} /><FindingsGroup severity="low" findings={result.findings.filter((item) => item.severity === "low")} /></div> : <p className="report-empty">No privacy-sensitive metadata was detected.</p>}</section>
    <section className="report-section"><div className="report-section-heading"><h3>Metadata</h3><span>{result.metadata.length} fields found</span></div>{result.metadata.length ? <div className="metadata-table">{result.metadata.map((item) => <div className="metadata-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div> : <p className="report-empty">No readable metadata was found in this file.</p>}</section>
    {result.note ? <p className="report-note">{result.note}</p> : null}
  </div>;
}

export function FilePrivacyInspector() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setResult(null);
    setError(null);
    if (!isSupportedFile(file)) {
      setError(`This file type is not supported. Try ${getSupportedTypes()}.`);
      return;
    }
    setIsProcessing(true);
    try {
      setResult(await inspectFile(file));
    } catch {
      setError("The file could not be inspected. It may be corrupted, encrypted, or use metadata this browser cannot read.");
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return <>
    {!result ? <section className="workspace-grid file-workspace">
      <div className="workspace-main">
        <label className={`upload-area ${isDragging ? "upload-area-active" : ""}`} htmlFor="file-upload" onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleFile(event.dataTransfer.files[0]); }}>
          <FileSymbol />
          <span className="upload-title">Drop a file here</span>
          <span className="upload-or">or</span>
          <span className="button button-light">Choose File</span>
          <input ref={inputRef} id="file-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.docx" onChange={(event) => void handleFile(event.target.files?.[0])} />
        </label>
        <p className="workspace-caption">Files are inspected locally in your browser and held only for this session.</p>
        <p className="workspace-caption supported-types">Supported: {getSupportedTypes()}. HEIC/HEIF is not currently supported.</p>
        {isProcessing ? <p className="processing-status" role="status" aria-live="polite">Inspecting {selectedFile?.name}…</p> : null}
        {error ? <div className="tool-error" role="alert"><strong>Inspection unavailable</strong><span>{error}</span>{selectedFile ? <button type="button" onClick={reset}>Remove file</button> : null}</div> : null}
      </div>
      <aside className="result-panel" aria-label="File details"><h2>File details</h2><div className="empty-state"><span>{selectedFile ? selectedFile.name : "Choose a file to begin."}</span></div><div className="result-divider" /><h3>Metadata</h3><p className="muted-copy">{isProcessing ? "Reading available fields…" : "The report will show available metadata and potential privacy exposure."}</p></aside>
    </section> : <Report result={result} onReset={reset} />}
  </>;
}
