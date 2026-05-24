"use client";

// Three-step browser dance for attaching a file to a HealerCertificate:
//   1. Ask server for a presigned PUT URL (validates ownership + limits).
//   2. PUT the file's bytes directly to S3.
//   3. Tell the server we're done, so it can HEAD-verify and link the
//      Document to the certificate.
//
// All progress and error states stay in the client; the server side is
// stateless once it's issued the presigned URL.

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Upload, Check, AlertCircle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestCertUploadAction, completeCertUploadAction } from "@/app/(app)/me/profile/actions";
import { DOCUMENT_LIMITS } from "@/lib/uploads.constants";

const KIND = "HEALER_CERT" as const;
const LIMIT = DOCUMENT_LIMITS[KIND];
const ACCEPTED_TYPES = [...LIMIT.allowedContentTypes].join(",");

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
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort any in-flight upload if the user navigates away.
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

    // 1. Ask for a presigned URL
    const intent = await requestCertUploadAction({
      certId,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!intent.ok) {
      safeSet({ kind: "error", message: intent.error });
      return;
    }

    // 2. PUT directly to S3. XMLHttpRequest used (not fetch) so we get
    //    upload progress events for the spinner. XHR is stored in a ref
    //    so an unmount can abort it.
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

    // 3. Confirm with the server
    safeSet({ kind: "verifying" });
    const confirm = await completeCertUploadAction({ certId, documentId: intent.documentId });
    if (!confirm.ok) {
      safeSet({ kind: "error", message: confirm.error });
      return;
    }

    safeSet({ kind: "done" });
    startTransition(() => router.refresh());
  }

  // Show a retry button only in the error state so the user doesn't have
  // to refresh the whole page after a transient network blip.
  if (state.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive">
        <AlertCircle className="h-3 w-3" />
        {state.message}
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-destructive/20 px-1.5 py-0.5 text-[10px] font-medium hover:bg-destructive/30"
        >
          <RotateCw className="h-2.5 w-2.5" />
          Retry
        </button>
      </span>
    );
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
