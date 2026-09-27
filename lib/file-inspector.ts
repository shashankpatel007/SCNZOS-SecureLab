import exifr from "exifr";
import JSZip from "jszip";

export type Severity = "high" | "medium" | "low";

export type MetadataField = {
  label: string;
  value: string;
  severity?: Severity;
};

export type PrivacyFinding = {
  label: string;
  value: string;
  severity: Severity;
  explanation: string;
};

export type InspectionResult = {
  file: {
    name: string;
    type: string;
    size: string;
  };
  metadata: MetadataField[];
  findings: PrivacyFinding[];
  note?: string;
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, "pdf", "docx"];

function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "Not available";
  if (value instanceof Date) return value.toLocaleString();
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function addField(fields: MetadataField[], label: string, value: unknown, severity?: Severity) {
  const formatted = displayValue(value);
  if (formatted !== "Not available") fields.push({ label, value: formatted, severity });
}

function findExifValue(exif: Record<string, unknown>, ...keys: string[]) {
  const key = keys.find((candidate) => exif[candidate] !== undefined && exif[candidate] !== null && exif[candidate] !== "");
  return key ? exif[key] : undefined;
}

function findSeverity(label: string): Severity | undefined {
  const normalized = label.toLowerCase();
  if (normalized.includes("gps") || normalized.includes("location") || normalized.includes("serial")) return "high";
  if (normalized.includes("author") || normalized.includes("device") || normalized.includes("camera") || normalized.includes("software") || normalized.includes("date") || normalized.includes("time") || normalized.includes("user")) return "medium";
  if (normalized.includes("size") || normalized.includes("dimension") || normalized.includes("page") || normalized.includes("type")) return "low";
  return undefined;
}

function buildFindings(fields: MetadataField[]): PrivacyFinding[] {
  return fields.flatMap((item) => {
    const severity = item.severity ?? findSeverity(item.label);
    if (!severity) return [];
    const explanation = severity === "high"
      ? "This may reveal a precise place or identifying detail."
      : severity === "medium"
        ? "This may reveal information about a person, device, or editing history."
        : "This describes the file without usually identifying a person or place.";
    return [{ label: item.label, value: item.value, severity, explanation }];
  });
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The image could not be decoded."));
    };
    image.src = objectUrl;
  });
}

async function inspectImage(file: File): Promise<InspectionResult> {
  const fields: MetadataField[] = [];
  const dimensions = await imageDimensions(file);
  addField(fields, "Dimensions", `${dimensions.width} × ${dimensions.height}`, "low");

  let exif: Record<string, unknown> = {};
  try {
    const parsed = await exifr.parse(file);
    if (parsed && typeof parsed === "object") exif = parsed as Record<string, unknown>;
  } catch {
    // Some valid PNG and WebP files have no EXIF block. Dimensions remain useful.
  }

  addField(fields, "Camera make", findExifValue(exif, "Make"), "medium");
  addField(fields, "Camera model", findExifValue(exif, "Model"), "medium");
  addField(fields, "Date/time", findExifValue(exif, "DateTimeOriginal", "CreateDate", "ModifyDate"), "medium");
  addField(fields, "GPS latitude", findExifValue(exif, "latitude", "GPSLatitude"), "high");
  addField(fields, "GPS longitude", findExifValue(exif, "longitude", "GPSLongitude"), "high");
  addField(fields, "Software", findExifValue(exif, "Software"), "medium");
  addField(fields, "Orientation", findExifValue(exif, "Orientation"), "low");
  addField(fields, "Lens", findExifValue(exif, "LensModel", "Lens"), "medium");

  return makeResult(file, fields, exif.latitude !== undefined || exif.GPSLatitude !== undefined ? undefined : "No location coordinates were found in the available image metadata.");
}

function makeResult(file: File, metadata: MetadataField[], note?: string): InspectionResult {
  return {
    file: { name: file.name, type: file.type || "Unknown", size: formatBytes(file.size) },
    metadata,
    findings: buildFindings(metadata),
    ...(note ? { note } : {}),
  };
}

function xmlValue(document: XMLDocument, localName: string) {
  const element = Array.from(document.getElementsByTagName("*"))
    .find((candidate) => candidate.localName === localName);
  return element?.textContent?.trim() || undefined;
}

async function inspectDocx(file: File): Promise<InspectionResult> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const coreEntry = archive.file("docProps/core.xml");
  const appEntry = archive.file("docProps/app.xml");
  if (!coreEntry && !appEntry) throw new Error("This DOCX file does not contain readable document properties.");
  const fields: MetadataField[] = [];
  if (coreEntry) {
    const document = new DOMParser().parseFromString(await coreEntry.async("text"), "application/xml");
    addField(fields, "Title", xmlValue(document, "title"));
    addField(fields, "Subject", xmlValue(document, "subject"));
    addField(fields, "Author", xmlValue(document, "creator"), "medium");
    addField(fields, "Last modified by", xmlValue(document, "lastModifiedBy"), "medium");
    addField(fields, "Created date", xmlValue(document, "created"), "medium");
    addField(fields, "Modified date", xmlValue(document, "modified"), "medium");
    addField(fields, "Revision", xmlValue(document, "revision"), "medium");
  }
  if (appEntry) {
    const document = new DOMParser().parseFromString(await appEntry.async("text"), "application/xml");
    addField(fields, "Application", xmlValue(document, "Application"), "medium");
    addField(fields, "App version", xmlValue(document, "AppVersion"));
  }
  return makeResult(file, fields, fields.length ? undefined : "No document properties were found in this DOCX file.");
}

async function inspectPdf(file: File): Promise<InspectionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer(), disableWorker: true, useWorkerFetch: false, isEvalSupported: false } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker?: boolean });
  const document = await loadingTask.promise;
  const fields: MetadataField[] = [];
  addField(fields, "Page count", document.numPages, "low");
  const metadata = await document.getMetadata();
  const info = metadata.info as Record<string, unknown> | undefined;
  addField(fields, "Title", info?.Title);
  addField(fields, "Author", info?.Author, "medium");
  addField(fields, "Creator", info?.Creator, "medium");
  addField(fields, "Producer", info?.Producer, "medium");
  addField(fields, "Creation date", info?.CreationDate, "medium");
  addField(fields, "Modification date", info?.ModDate, "medium");
  addField(fields, "Subject", info?.Subject);
  return makeResult(file, fields, fields.length === 1 ? "No document properties were found in this PDF." : undefined);
}

export async function inspectFile(file: File): Promise<InspectionResult> {
  if (file.size === 0) throw new Error("The selected file is empty.");
  if (file.size > MAX_FILE_SIZE) throw new Error("This file is larger than the 100 MB inspection limit.");

  const extension = extensionFor(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) throw new Error("This file type is not supported. Try JPEG, PNG, WebP, PDF, or DOCX.");

  if (IMAGE_EXTENSIONS.includes(extension)) return inspectImage(file);
  if (extension === "pdf") return inspectPdf(file);
  if (extension === "docx") return inspectDocx(file);
  throw new Error("This file type cannot be inspected in the browser.");
}

export function isSupportedFile(file: File) {
  return SUPPORTED_EXTENSIONS.includes(extensionFor(file.name));
}

export function getSupportedTypes() {
  return "JPEG, PNG, WebP, PDF, and DOCX";
}

export function countFindingsBySeverity(findings: PrivacyFinding[]) {
  return {
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    low: findings.filter((finding) => finding.severity === "low").length,
  };
}
