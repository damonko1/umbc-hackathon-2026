import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 4000;

export const runtime = "nodejs";
export const maxDuration = 60;

function getExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateText(text: string): string {
  if (text.length <= MAX_EXTRACTED_TEXT) {
    return text;
  }

  return `${text.slice(0, MAX_EXTRACTED_TEXT).trimEnd()}\n\n[Truncated]`;
}

async function withTempFile<T>(
  file: File,
  run: (filePath: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "reality-fork-"));
  const filePath = join(dir, file.name || "upload");

  try {
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    return await run(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function extractPdfTextWithPdfKit(filePath: string): Promise<string> {
  const scriptPath = join(dirname(filePath), "extract-pdf-text.js");
  const script = [
    "ObjC.import('Foundation');",
    "ObjC.import('PDFKit');",
    `const url = $.NSURL.fileURLWithPath(${JSON.stringify(filePath)});`,
    "const doc = $.PDFDocument.alloc.initWithURL(url);",
    "if (!doc) {",
    "  throw new Error('Could not open the PDF.');",
    "}",
    "const text = ObjC.unwrap(doc.string) || '';",
    "console.log(text);",
  ].join("\n");

  await writeFile(scriptPath, script);
  const { stdout, stderr } = await execFileAsync(
    "/usr/bin/osascript",
    ["-l", "JavaScript", scriptPath],
    { timeout: 15000 },
  );

  return [stdout, stderr]
    .filter(Boolean)
    .join("\n")
    .replace(
      /CoreGraphics PDF has logged an error\.[^\n]*\n?/g,
      "",
    )
    .trim();
}

async function extractText(file: File): Promise<string> {
  const extension = getExtension(file.name);

  if (
    file.type.startsWith("text/") ||
    ["txt", "md", "markdown", "json", "csv"].includes(extension)
  ) {
    return await file.text();
  }

  if (["doc", "docx", "rtf"].includes(extension)) {
    return withTempFile(file, async (filePath) => {
      const { stdout } = await execFileAsync("/usr/bin/textutil", [
        "-convert",
        "txt",
        "-stdout",
        filePath,
      ]);
      return stdout;
    });
  }

  if (extension === "pdf" || file.type === "application/pdf") {
    return withTempFile(file, async (filePath) => {
      const pdfText = normalizeText(await extractPdfTextWithPdfKit(filePath));
      if (pdfText) {
        return pdfText;
      }

      const { stdout } = await execFileAsync(
        "/usr/bin/mdls",
        ["-name", "kMDItemTextContent", "-raw", filePath],
        { timeout: 5000 },
      );

      return stdout.trim() === "(null)" ? "" : stdout;
    });
  }

  throw new Error("Unsupported file type. Try PDF, DOCX, DOC, RTF, TXT, Markdown, JSON, or CSV.");
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const upload = formData.get("file");
  if (!(upload instanceof File)) {
    return Response.json({ error: "No file was provided." }, { status: 400 });
  }

  if (upload.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File is too large. Keep uploads under 6 MB." },
      { status: 400 },
    );
  }

  try {
    const extracted = truncateText(normalizeText(await extractText(upload)));
    if (!extracted) {
      const emptyFileMessage =
        getExtension(upload.name) === "pdf" || upload.type === "application/pdf"
          ? "Could not extract readable text from that PDF. If it is scanned or image-only, try a text-based PDF, DOCX, or TXT file."
          : "Could not extract readable text from that file.";
      return Response.json(
        { error: emptyFileMessage },
        { status: 400 },
      );
    }

    return Response.json({
      name: upload.name,
      size: upload.size,
      text: extracted,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process that file.";
    return Response.json({ error: message }, { status: 400 });
  }
}
