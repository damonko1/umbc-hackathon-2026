"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, Plus, Sparkles, Upload, X } from "lucide-react";
import { DecisionInputSchema, type DecisionInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FieldErrors = {
  question?: string;
  options?: (string | undefined)[];
  context?: string;
  goals?: string;
  uploads?: string;
  _form?: string;
};

type UploadedContextFile = {
  id: string;
  name: string;
  size: number;
  text?: string;
  status: "processing" | "ready" | "error";
  error?: string;
};

type ExtractionResponse = {
  error?: string;
  name?: string;
  size?: number;
  text?: string;
};

type ExtractedFile = Pick<UploadedContextFile, "name" | "size" | "text">;

const ACCEPTED_CONTEXT_FILES =
  ".pdf,.doc,.docx,.rtf,.txt,.md,.markdown,.json,.csv";
const ACCEPTED_CONTEXT_FILES_LABEL =
  "Accepted: PDF, DOC, DOCX, RTF, TXT, MD, Markdown, JSON, CSV.";
const MAX_CONTEXT_LENGTH = 12000;

function newUploadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `upload_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function buildContextValue(
  typedContext: string,
  uploads: UploadedContextFile[],
): string | undefined {
  const sections: string[] = [];
  const readyUploads = uploads.filter(
    (file) => file.status === "ready" && typeof file.text === "string",
  );

  if (typedContext.trim()) {
    sections.push(typedContext.trim());
  }

  if (readyUploads.length > 0) {
    sections.push(
      readyUploads
        .map(
          (file) =>
            `Supporting file: ${file.name}\n${file.text}`,
        )
        .join("\n\n"),
    );
  }

  const combined = sections.join("\n\n");
  if (!combined) {
    return undefined;
  }

  if (combined.length <= MAX_CONTEXT_LENGTH) {
    return combined;
  }

  return `${combined.slice(0, MAX_CONTEXT_LENGTH - 14).trimEnd()}\n\n[Truncated]`;
}

export interface DecisionFormProps {
  initial?: DecisionInput;
}

export function DecisionForm({ initial }: DecisionFormProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [question, setQuestion] = React.useState(initial?.question ?? "");
  const [options, setOptions] = React.useState<string[]>(
    initial?.options ?? ["", ""],
  );
  const [context, setContext] = React.useState(initial?.context ?? "");
  const [goals, setGoals] = React.useState(initial?.goals ?? "");
  const [uploads, setUploads] = React.useState<UploadedContextFile[]>([]);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    if (options.length >= 3) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeUpload(id: string) {
    setUploads((prev) => prev.filter((file) => file.id !== id));
  }

  async function extractFile(file: File): Promise<ExtractedFile> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/context/extract", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as ExtractionResponse;

    if (!response.ok || !payload.text) {
      throw new Error(payload.error || `Could not read ${file.name}.`);
    }

    return {
      name: payload.name || file.name,
      size: payload.size ?? file.size,
      text: payload.text,
    };
  }

  async function handleFileSelection(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    const pendingFiles = files.map((file) => ({
      id: newUploadId(),
      name: file.name,
      size: file.size,
      status: "processing" as const,
    }));
    const failures: string[] = [];

    setUploads((prev) => [...prev, ...pendingFiles]);

    for (const [idx, file] of files.entries()) {
      const pendingFile = pendingFiles[idx];
      try {
        const extracted = await extractFile(file);
        setUploads((prev) =>
          prev.map((existing) =>
            existing.id === pendingFile.id
              ? {
                  ...existing,
                  name: extracted.name,
                  size: extracted.size,
                  text: extracted.text,
                  status: "ready",
                  error: undefined,
                }
              : existing,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Could not read ${file.name}.`;
        failures.push(message);
        setUploads((prev) =>
          prev.map((existing) =>
            existing.id === pendingFile.id
              ? {
                  ...existing,
                  status: "error",
                  error: message,
                }
              : existing,
          ),
        );
      }
    }

    setUploadError(
      failures.length > 0
        ? "Some files could not be processed. You can remove them or try another format."
        : null,
    );
    setUploading(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    const mergedContext = buildContextValue(context, uploads);
    const candidate: Record<string, unknown> = {
      question: question.trim(),
    };

    if (trimmedOptions.length > 0) {
      candidate.options = trimmedOptions;
    }
    if (mergedContext) {
      candidate.context = mergedContext;
    }
    if (goals.trim()) {
      candidate.goals = goals.trim();
    }

    const parsed = DecisionInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const [head, sub] = issue.path;
        if (head === "question") next.question = issue.message;
        else if (head === "context") next.context = issue.message;
        else if (head === "goals") next.goals = issue.message;
        else if (head === "options") {
          if (typeof sub === "number") {
            const arr = next.options ?? [];
            arr[sub] = issue.message;
            next.options = arr;
          } else {
            next._form = issue.message;
          }
        } else {
          next._form = issue.message;
        }
      }
      setErrors(next);
      setSubmitting(false);
      return;
    }

    setErrors({});
    try {
      sessionStorage.setItem(
        "realityfork:input",
        JSON.stringify(parsed.data),
      );
    } catch {
      // ignore storage errors
    }
    router.push("/simulate");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="rf-question">The decision you&apos;re weighing</Label>
        <Input
          id="rf-question"
          placeholder="Should I take the startup offer or stay at BigCo?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={cn(errors.question && "border-red-500/70")}
        />
        {errors.question && (
          <p className="text-xs text-red-400">{errors.question}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>
            Options <span className="text-[var(--muted)]">(optional)</span>
          </Label>
          {options.length < 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addOption}
            >
              <Plus className="h-3.5 w-3.5" />
              Add option
            </Button>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          Leave these blank if you want Reality Fork to infer the likely paths for you.
        </p>
        <div className="flex flex-col gap-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className={cn(
                    errors.options?.[idx] && "border-red-500/70",
                  )}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(idx)}
                    aria-label="Remove option"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {errors.options?.[idx] && (
                <p className="text-xs text-red-400">
                  {errors.options[idx]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rf-context">
          Context <span className="text-[var(--muted)]">(optional)</span>
        </Label>
        <Textarea
          id="rf-context"
          placeholder="Age, situation, current state, constraints..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className={cn(errors.context && "border-red-500/70")}
        />
        <p className="text-xs text-[var(--muted)]">
          You can also upload files below to give the model more context.
        </p>
        {errors.context && (
          <p className="text-xs text-red-400">{errors.context}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="rf-context-files">
            Context files <span className="text-[var(--muted)]">(optional)</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload file
          </Button>
        </div>
        <input
          id="rf-context-files"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_CONTEXT_FILES}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.currentTarget.value = "";
            void handleFileSelection(files);
          }}
        />
        <p className="text-xs text-[var(--muted)]">
          Useful for resumes, job descriptions, notes, or other supporting documents.
        </p>
        <p className="text-xs text-[var(--muted)]">
          {ACCEPTED_CONTEXT_FILES_LABEL}
        </p>
        {uploading && (
          <p className="text-xs text-[var(--muted)]">
            Adding file...
          </p>
        )}
        {(uploadError || errors.uploads) && (
          <p className="text-xs text-red-400">
            {uploadError || errors.uploads}
          </p>
        )}
        {uploads.length > 0 && (
          <div className="rounded-lg border px-3 py-3">
            <p className="text-xs font-medium text-foreground/90">
              Added files ({uploads.length})
            </p>
            <div className="mt-2 flex flex-col gap-2">
            {uploads.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex items-start gap-2 text-sm">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                  <div className="min-w-0">
                    <p className="truncate">{file.name}</p>
                    <p
                      className={cn(
                        "text-xs",
                        file.status === "error"
                          ? "text-red-400"
                          : "text-[var(--muted)]",
                      )}
                    >
                      {file.status === "processing"
                        ? "Processing..."
                        : file.status === "error"
                          ? file.error ?? "Could not process file."
                          : "Ready"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeUpload(file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rf-goals">
          Goals <span className="text-[var(--muted)]">(optional)</span>
        </Label>
        <Textarea
          id="rf-goals"
          placeholder="What do you want to optimize for?"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          className={cn(errors.goals && "border-red-500/70")}
        />
        {errors.goals && (
          <p className="text-xs text-red-400">{errors.goals}</p>
        )}
      </div>

      {errors._form && (
        <p className="text-sm text-red-400">{errors._form}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="lg" disabled={submitting || uploading}>
          <Sparkles className="h-4 w-4" />
          {submitting ? "Forking reality..." : "Simulate futures"}
        </Button>
        <span className="text-xs text-[var(--muted)]">
          Takes ~15 seconds.
        </span>
      </div>
    </form>
  );
}

export default DecisionForm;
