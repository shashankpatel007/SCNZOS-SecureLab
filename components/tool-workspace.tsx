import Link from "next/link";
import type { Tool } from "@/lib/tools";

function UploadArea({ kind }: { kind: "file" | "image" }) {
  const isImage = kind === "image";
  const inputId = isImage ? "screenshot-upload" : "file-upload";
  return (
    <label className="upload-area" htmlFor={inputId}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="upload-symbol" fill="none" stroke="currentColor" strokeWidth="1.25">
        {isImage ? <><rect x="4" y="5" width="24" height="22" rx="2" /><circle cx="11" cy="12" r="2" /><path d="m6 24 7-7 5 5 3-3 5 5" /></> : <><path d="M9 3h9l8 8v18H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M18 3v9h8" /></>}
      </svg>
      <span className="upload-title">Drop {isImage ? "an image" : "a file"} here</span>
      <span className="upload-or">or</span>
      <span className="button button-light">Choose {isImage ? "Image" : "File"}</span>
      <input id={inputId} type="file" accept={isImage ? "image/*" : undefined} />
    </label>
  );
}

function FileWorkspace() {
  return (
    <div className="workspace-grid file-workspace">
      <section className="workspace-main">
        <UploadArea kind="file" />
        <p className="workspace-caption">Analysis is not available yet. No metadata report is generated.</p>
      </section>
      <aside className="result-panel" aria-label="File details">
        <h2>File details</h2>
        <div className="empty-state"><span>Choose a file to begin.</span></div>
        <div className="result-divider" />
        <h3>Metadata</h3>
        <p className="muted-copy">Available metadata will appear here when inspection is implemented.</p>
      </aside>
    </div>
  );
}

function ScreenshotWorkspace() {
  return (
    <div className="workspace-grid screenshot-workspace">
      <section className="workspace-main">
        <UploadArea kind="image" />
        <p className="workspace-caption">Image processing is not available yet.</p>
      </section>
      <section className="preview-panel">
        <h2>Preview</h2>
        <div className="preview-empty"><span className="preview-image-icon" aria-hidden="true">▧</span><span>No image selected</span></div>
      </section>
      <aside className="options-panel">
        <h2>Detection options</h2>
        {[
          "Detect text (OCR)",
          "Find sensitive information",
          "Blur selected areas",
          "Review before download",
        ].map((option) => (
          <label className="option-row" key={option}>
            <input type="checkbox" disabled aria-label={`${option} (not available yet)`} />
            <span>{option}</span>
          </label>
        ))}
        <button className="button button-outline download-button" type="button" disabled>Download cleaned image</button>
      </aside>
    </div>
  );
}

function UrlWorkspace() {
  return (
    <div className="url-workspace">
      <form className="url-form">
        <label className="visually-hidden" htmlFor="redirect-url">URL to trace</label>
        <input id="redirect-url" type="url" placeholder="Enter a URL (e.g. https://example.com)" disabled />
        <button className="button button-light" type="button" disabled>Trace URL</button>
      </form>
      <p className="workspace-caption">Redirect tracing is not available yet. No request will be made.</p>
      <section className="redirect-panel">
        <h2>Redirect chain</h2>
        <div className="redirect-empty">
          <svg aria-hidden="true" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="7" r="3" /><circle cx="27" cy="27" r="3" /><path d="M11 10v11c0 4 4 6 8 6h5M14 12l10 8" /></svg>
          <p>Enter a URL to see its redirect chain.</p>
        </div>
      </section>
    </div>
  );
}

export function ToolWorkspace({ tool, interactiveContent }: { tool: Tool; interactiveContent?: React.ReactNode }) {
  const index = tool.slug === "file-privacy-inspector" ? "01" : tool.slug === "screenshot-privacy-cleaner" ? "02" : "03";
  return (
    <div className="shell tool-page">
      <Link href="/#tools" className="back-link"><span aria-hidden="true">←</span> Tools</Link>
      <div className="tool-heading-row">
        <h1>{tool.name}</h1>
        <span className="tool-index">{index} / 03</span>
      </div>
      <p className="tool-intro">{tool.description}</p>
      {interactiveContent ?? (tool.slug === "file-privacy-inspector" ? <FileWorkspace /> : tool.slug === "screenshot-privacy-cleaner" ? <ScreenshotWorkspace /> : <UrlWorkspace />)}
    </div>
  );
}
