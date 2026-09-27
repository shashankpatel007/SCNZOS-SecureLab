"use client";

import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

type FindingType = "Email" | "Phone" | "URL" | "IP address" | "Possible secret/token" | "Username" | "OTP / verification code" | "UPI ID" | "Card-like number" | "Possible PAN" | "Possible Aadhaar" | "Other";
type RedactionMode = "blur" | "solid";
type Box = { x: number; y: number; width: number; height: number };
type Finding = { id: string; text: string; type: FindingType; box: Box; selected: boolean };
type OCRWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
type OCRLine = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number }; words: OCRWord[] };

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const FINDING_TYPES: FindingType[] = ["Email", "Phone", "URL", "IP address", "Possible secret/token", "Username", "OTP / verification code", "UPI ID", "Card-like number", "Possible PAN", "Possible Aadhaar", "Other"];

function normalizeOCRText(value: string) {
  return value.normalize("NFKC").replace(/[\u00a0|]/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

function trimDetectedValue(value: string) {
  return value.trim().replace(/[),.;:!?]+$/g, "");
}

function isValidIP(value: string) {
  return value.split(".").length === 4 && value.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function detectLineMatches(value: string) {
  const text = normalizeOCRText(value);
  const repairedText = text.replace(/\s*@\s*/g, "@").replace(/\s*\.\s*/g, ".");
  const candidates = repairedText === text ? [text] : [text, repairedText];
  const matches: Array<{ type: FindingType; text: string }> = [];
  const add = (type: FindingType, expression: RegExp, transform = (match: string) => match) => {
    for (const candidate of candidates) for (const match of candidate.matchAll(expression)) {
      const detected = trimDetectedValue(transform(match[0]));
      if (detected && !matches.some((item) => item.type === type && item.text === detected)) matches.push({ type, text: detected });
    }
  };

  add("Email", /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g);
  add("UPI ID", /[a-zA-Z0-9._-]+@(?:upi|okaxis|ybl|oksbi|paytm|ibl|axl|sbi)\b/gi);
  add("URL", /(?:https?:\/\/|www\.)[^\s]+/gi);
  add("IP address", /(?:\d{1,3}\.){3}\d{1,3}/g, (match) => isValidIP(match) ? match : "");
  add("OTP / verification code", /(?:otp|verification\s+code|one[- ]time\s+password)\s*[:#=-]?\s*(\d{4,8})/gi, (match) => match.match(/\d{4,8}/)?.[0] ?? "");
  add("Possible PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/gi);
  add("Possible Aadhaar", /\b\d{4}[ -]\d{4}[ -]\d{4}\b/g);
  add("Card-like number", /\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && /[ -]/.test(match) ? match : "";
  });
  add("Phone", /(?:\+?\d[\d\s().-]{7,}\d)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? match : "";
  });
  add("Possible secret/token", /(?:api[_ -]?key|token|secret|bearer)\s*[:=]\s*([A-Za-z0-9._~+/=-]{4,})/gi, (match) => match.split(/[:=]/).pop()?.trim() ?? "");
  add("Possible secret/token", /\b(?:sk|pk|ghp|github_pat|xox[baprs]-|AIza)[A-Za-z0-9_-]{8,}\b/gi);
  add("Username", /@[A-Za-z0-9_.-]{3,}/g);
  const labeledValue = repairedText.match(/\b(?:password|pass|address|account\s+number|customer\s+id|order\s+id)\s*[:=-]\s*(\S+)/i)?.[1];
  if (labeledValue && !matches.some((item) => item.type === "Other" && item.text === labeledValue)) matches.push({ type: "Other", text: labeledValue });
  return matches;
}

function lineFromBlockData(data: unknown) {
  const blocks = (data as { blocks?: Array<{ paragraphs?: Array<{ lines?: OCRLine[] }> }> }).blocks ?? [];
  return blocks.flatMap((block) => (block.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? []));
}

function findingBox(line: OCRLine, value: string): Box {
  const normalizedLine = normalizeOCRText(line.text).toLowerCase();
  const normalizedValue = normalizeOCRText(value).toLowerCase();
  const start = normalizedLine.indexOf(normalizedValue);
  if (start < 0 || !line.words.length) return { x: line.bbox.x0, y: line.bbox.y0, width: line.bbox.x1 - line.bbox.x0, height: line.bbox.y1 - line.bbox.y0 };
  const end = start + normalizedValue.length;
  let cursor = 0;
  const matchedBoxes: Box[] = [];
  line.words.forEach((word) => {
    const wordText = normalizeOCRText(word.text).toLowerCase();
    const wordStart = normalizedLine.indexOf(wordText, cursor);
    if (wordStart < 0) return;
    cursor = wordStart + wordText.length;
    const wordEnd = wordStart + wordText.length;
    if (wordEnd > start && wordStart < end) matchedBoxes.push({ x: word.bbox.x0, y: word.bbox.y0, width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0 });
  });
  if (!matchedBoxes.length) return { x: line.bbox.x0, y: line.bbox.y0, width: line.bbox.x1 - line.bbox.x0, height: line.bbox.y1 - line.bbox.y0 };
  const left = Math.min(...matchedBoxes.map((box) => box.x));
  const top = Math.min(...matchedBoxes.map((box) => box.y));
  const right = Math.max(...matchedBoxes.map((box) => box.x + box.width));
  const bottom = Math.max(...matchedBoxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The image could not be decoded.")); };
    image.src = url;
  });
}

function drawRedaction(context: CanvasRenderingContext2D, image: HTMLImageElement, finding: Finding, mode: RedactionMode) {
  const { x, y, width, height } = finding.box;
  if (mode === "solid") {
    context.fillStyle = "#111214";
    context.fillRect(x, y, width, height);
    return;
  }
  const padding = Math.max(5, Math.round(Math.min(width, height) * .12));
  const left = Math.max(0, x - padding);
  const top = Math.max(0, y - padding);
  const right = Math.min(image.naturalWidth, x + width + padding);
  const bottom = Math.min(image.naturalHeight, y + height + padding);
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = right - left;
  blurCanvas.height = bottom - top;
  const blurContext = blurCanvas.getContext("2d");
  if (!blurContext) return;
  blurContext.filter = `blur(${Math.max(5, Math.round(Math.min(width, height) * .18))}px)`;
  blurContext.drawImage(image, left, top, right - left, bottom - top, 0, 0, right - left, bottom - top);
  context.drawImage(blurCanvas, left, top);
}

function drawPreview(canvas: HTMLCanvasElement, image: HTMLImageElement, findings: Finding[], mode: RedactionMode) {
  const context = canvas.getContext("2d");
  if (!context) return;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);
  findings.filter((finding) => finding.selected).forEach((finding) => drawRedaction(context, image, finding, mode));
}

export function ScreenshotPrivacyCleaner() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [mode, setMode] = useState<RedactionMode>("blur");
  const [status, setStatus] = useState("No image selected");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (imageRef.current && canvasRef.current) drawPreview(canvasRef.current, imageRef.current, findings, mode);
  }, [findings, mode]);

  async function handleFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setError(null);
    setFile(null);
    setFindings([]);
    setProgress(0);
    if (!ACCEPTED_TYPES.includes(nextFile.type)) { setError("Unsupported image. Choose a PNG, JPEG, or WebP file."); return; }
    if (nextFile.size > MAX_FILE_SIZE) { setError("This image is larger than the 25 MB limit."); return; }
    setFile(nextFile);
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      setStatus("Preparing image...");
      const image = await loadImage(nextFile);
      imageRef.current = image;
      if (canvasRef.current) drawPreview(canvasRef.current, image, [], mode);
      setStatus("Reading screenshot...");
      worker = await createWorker("eng", 1, { logger: (message) => {
        if (message.status === "loading language traineddata") setStatus("Loading English OCR data...");
        if (message.status === "recognizing text") { setStatus("Detecting sensitive information..."); setProgress(Math.round(message.progress * 100)); }
      } });
      setStatus("Detecting sensitive information...");
      const result = await worker.recognize(nextFile, {}, { text: true, blocks: true });
      const rawText = normalizeOCRText(result.data.text ?? "");
      const lines = lineFromBlockData(result.data);
      const ocrLines = lines.length ? lines : rawText ? [{ text: rawText, confidence: 100, bbox: { x0: 0, y0: 0, x1: image.naturalWidth, y1: image.naturalHeight }, words: [] }] : [];
      const detected: Finding[] = [];
      if (!rawText) {
        throw new Error("OCR_EMPTY");
      }
      ocrLines.forEach((line, lineIndex) => {
        if (line.confidence < 35) return;
        const lineMatches = detectLineMatches(line.text);
        lineMatches.forEach((match, matchIndex) => {
          const id = `${match.type}-${lineIndex}-${matchIndex}-${match.text}`;
          if (detected.some((finding) => finding.id === id)) return;
          detected.push({ id, text: match.text, type: match.type, selected: true, box: findingBox(line, match.text) });
        });
      });
      setStatus("Preparing results...");
      setFindings(detected);
      setProgress(100);
      setStatus(detected.length ? `${detected.length} potential privacy finding${detected.length === 1 ? "" : "s"} found` : "No potentially sensitive information was detected.");
    } catch (caughtError) {
      const message = caughtError instanceof Error && caughtError.message === "OCR_EMPTY"
        ? "Text recognition could not read this image. Try a clearer or higher-resolution screenshot."
        : "This image could not be processed. It may be corrupted or unsupported by the browser.";
      setError(message);
      setStatus("Processing failed");
      imageRef.current = null;
    } finally {
      if (worker) await worker.terminate();
    }
  }

  function reset() {
    setFile(null);
    setFindings([]);
    setError(null);
    setProgress(0);
    setStatus("No image selected");
    imageRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    if (canvasRef.current) { const context = canvasRef.current.getContext("2d"); context?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !findings.some((finding) => finding.selected)) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file?.name.replace(/\.[^.]+$/, "") ?? "cleaned-image"}-cleaned.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  const grouped = FINDING_TYPES.map((type) => ({ type, findings: findings.filter((finding) => finding.type === type) })).filter((group) => group.findings.length);
  const selectedCount = findings.filter((finding) => finding.selected).length;

  return <div className="screenshot-cleaner">
    <div className="screenshot-tool-grid">
      <section className="screenshot-upload-column">
        {!file ? <label className={`upload-area ${isDragging ? "upload-area-active" : ""}`} htmlFor="screenshot-upload" onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleFile(event.dataTransfer.files[0]); }}>
          <svg aria-hidden="true" viewBox="0 0 32 32" className="upload-symbol" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="4" y="5" width="24" height="22" rx="2" /><circle cx="11" cy="12" r="2" /><path d="m6 24 7-7 5 5 3-3 5 5" /></svg>
          <span className="upload-title">Drop an image here</span><span className="upload-or">or</span><span className="button button-light">Choose Image</span>
          <input ref={inputRef} id="screenshot-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleFile(event.target.files?.[0])} />
        </label> : <div className="image-preview-panel"><div className="preview-panel-heading"><h2>Screenshot</h2><button className="text-button" type="button" onClick={reset}>Remove</button></div><canvas ref={canvasRef} className="screenshot-canvas" aria-label="Screenshot preview with selected redactions" /></div>}
        <p className="workspace-caption">Images are processed locally in your browser and kept in memory for this session.</p>
        {file ? <p className="workspace-caption supported-types">{file.name} · {formatFileSize(file.size)}</p> : null}
        {error ? <div className="tool-error" role="alert"><strong>Image unavailable</strong><span>{error}</span></div> : null}
        {file && status !== "No image selected" ? <p className="processing-status" role="status" aria-live="polite">{status}{progress > 0 && progress < 100 ? ` ${progress}%` : ""}</p> : null}
      </section>
      <section className="screenshot-detection-panel" aria-label="Sensitive information findings">
        <div className="preview-panel-heading"><h2>Detection results</h2><span className="finding-count">{findings.length} found</span></div>
        {findings.length ? <div className="finding-list">{grouped.map((group) => <div className="screenshot-finding-group" key={group.type}><h3>{group.type}</h3>{group.findings.map((finding) => <label className="screenshot-finding" key={finding.id}><input type="checkbox" checked={finding.selected} onChange={() => setFindings((current) => current.map((item) => item.id === finding.id ? { ...item, selected: !item.selected } : item))} /><span><strong>{finding.text}</strong><small>Redact this {finding.type.toLowerCase()}</small></span></label>)}</div>)}</div> : <div className="detection-empty"><span aria-hidden="true">⌁</span><p>{file ? status : "Upload an image to detect sensitive text."}</p></div>}
      </section>
      <aside className="screenshot-options-panel">
        <h2>Redaction</h2>
        <div className="redaction-choice"><label><input type="radio" name="redaction-mode" checked={mode === "blur"} onChange={() => setMode("blur")} /> Blur selected areas</label><label><input type="radio" name="redaction-mode" checked={mode === "solid"} onChange={() => setMode("solid")} /> Solid redaction</label></div>
        <p className="muted-copy">Redactions are drawn into a separate canvas. The original image remains unchanged.</p>
        <button className="button button-light download-button" type="button" disabled={!selectedCount || !file} onClick={download}>Download Clean Image</button>
      </aside>
    </div>
  </div>;
}
