"use client";

// Client-portal medical-report uploader.
//
// Mirrors components/cert-file-uploader.tsx but talks to the
// /me/documents server actions instead of the cert-attach actions.
// The flow is identical: ask for presigned URL → PUT to S3 → confirm.
// Kept as a separate component so each surface can evolve its labels
// and validation policy independently.

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Upload, Check, AlertCircle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestMyDocUploadAction, completeMyDocUploadAction } from "@/app/me/documents/actions";
import { DOCUMENT_LIMITS } from "@/lib/uploads.constants";

const KIND = "MEDICAL_REPORT" as const;
const LIMIT = DOCUMENT_LIMITS[KIND];
const ACCEPTED_TYPES = [...LIMIT.allowedContentTypes].join(",");

type State =
  | { kind: "idle" }
  | { kind: "uploading"; progress?: number }
  | { kind: "verifying" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function MedicalReportUploader() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      xhrRef.current?.abort();
    };
  }, []);

  function safeSet(s: State) {
    if (mountedRef.current) setState(s);
  }

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > LIMIT.maxBytes) {
      safeSet({ kind: "error", message: `File is larger than ${Math.floor(LIMIT.maxBytes / 1024 / 1024)} MB.` });
      return;
    }
    if (!LIMIT.allowedContentTypes.includes(file.type)) {
      safeSet({ kind: "error", message: "Unsupported file type. Use PDF, PNG, or JPEG." });
      return;
    }

    safeSet({ kind: "uploading", progress: 0 });

    const intent = await requestMyDocUploadAction({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!intent.ok) {
      safeSet({ kind: "error", message: intent.error });
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", intent.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            safeSet({ kind: "uploading", progress: e.loaded / e.total });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`S3 PUT failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.send(file);
      });
    } catch (err) {
      xhrRef.current = null;
      safeSet({ kind: "error", message: err instanceof Error ? err.message : "Upload failed" });
      return;
    }
    xhrRef.current = null;

    safeSet({ kind: "verifying" });
    const confirm = await completeMyDocUploadAction({ documentId: intent.documentId });
    if (!confirm.ok) {
      safeSet({ kind: "error", message: confirm.error });
      return;
    }

    safeSet({ kind: "done" });
    startTransition(() => router.refresh());
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {state.message}
        </div>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/25"
        >
          <RotateCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <Check className="h-4 w-4" />
        Uploaded — it&apos;ll appear in your list below shortly.
      </div>
    );
  }

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        state.kind === "idle"
          ? "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
          : "border-primary/40 bg-primary/5"
      }`}
    >
      {state.kind === "idle" && (
        <>
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-foreground">Upload a medical report</span>
          <span className="text-xs text-muted-foreground">
            PDF, PNG, or JPEG · up to {Math.floor(LIMIT.maxBytes / 1024 / 1024)} MB
          </span>
        </>
      )}
      {state.kind === "uploading" && (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">
            {state.progress != null ? `Uploading… ${Math.round(state.progress * 100)}%` : "Uploading…"}
          </span>
        </>
      )}
      {state.kind === "verifying" && (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">Verifying…</span>
        </>
      )}
      <input
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        disabled={state.kind === "uploading" || state.kind === "verifying"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
