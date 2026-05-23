"use client";

// Three-step browser dance for attaching a file to a HealerCertificate:
//   1. Ask server for a presigned PUT URL (validates ownership + limits).
//   2. PUT the file's bytes directly to S3.
//   3. Tell the server we're done, so it can HEAD-verify and link the
//      Document to the certificate.
//
// All progress and error states stay in the client; the server side is
// stateless once it's issued the presigned URL.

import { useState, useTransition } from "react";
import { Loader2, Upload, Check, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestCertUploadAction, completeCertUploadAction } from "@/app/(app)/me/profile/actions";

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg";
const MAX_BYTES = 5 * 1024 * 1024;

type State =
  | { kind: "idle" }
  | { kind: "uploading"; progress?: number }
  | { kind: "verifying" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function CertFileUploader({ certId }: { certId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setState({ kind: "error", message: "File is larger than 5 MB." });
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setState({ kind: "error", message: "Only PDF, PNG, or JPEG are accepted." });
      return;
    }

    setState({ kind: "uploading", progress: 0 });

    // 1. Ask for a presigned URL
    const intent = await requestCertUploadAction({
      certId,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!intent.ok) {
      setState({ kind: "error", message: intent.error });
      return;
    }

    // 2. PUT directly to S3. XMLHttpRequest used (not fetch) so we get
    //    upload progress events for the spinner.
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", intent.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState({ kind: "uploading", progress: e.loaded / e.total });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`S3 PUT failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Upload failed" });
      return;
    }

    // 3. Confirm with the server
    setState({ kind: "verifying" });
    const confirm = await completeCertUploadAction({ certId, documentId: intent.documentId });
    if (!confirm.ok) {
      setState({ kind: "error", message: confirm.error });
      return;
    }

    setState({ kind: "done" });
    // Refresh the server component so the new attachment renders.
    startTransition(() => router.refresh());
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20">
      {state.kind === "idle" && (
        <>
          <Upload className="h-3 w-3" />
          Attach file
        </>
      )}
      {state.kind === "uploading" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {state.progress != null ? `${Math.round(state.progress * 100)}%` : "Uploading…"}
        </>
      )}
      {state.kind === "verifying" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Verifying…
        </>
      )}
      {state.kind === "done" && (
        <>
          <Check className="h-3 w-3" />
          Attached
        </>
      )}
      {state.kind === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3 w-3" />
          {state.message}
        </span>
      )}
      <input
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        disabled={state.kind === "uploading" || state.kind === "verifying"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ""; // reset so re-picking same file fires onChange
        }}
      />
    </label>
  );
}
