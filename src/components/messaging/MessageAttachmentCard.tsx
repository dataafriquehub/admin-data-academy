"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  downloadMessagingAttachmentBlob,
  type MessageAttachment,
} from "@/services/messagingService";

type Props = {
  attachment: MessageAttachment;
  isMine?: boolean;
};

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

function inferKind(contentType: string | undefined, name: string | undefined) {
  const ct = (contentType || "").toLowerCase();
  const ext = (name || "").toLowerCase().split(".").pop() || "";
  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext)) {
    return "image" as const;
  }
  if (ct.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) {
    return "video" as const;
  }
  if (ct === "application/pdf" || ext === "pdf") {
    return "pdf" as const;
  }
  if (ct.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) {
    return "audio" as const;
  }
  return "file" as const;
}

export default function MessageAttachmentCard({ attachment, isMine }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);
  const [pdfExpanded, setPdfExpanded] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const filename =
    attachment.filename || attachment.name || `Pièce jointe #${attachment.id}`;
  const size = attachment.size ?? attachment.byte_size;
  const kind = inferKind(
    attachment.content_type || attachment.mime_type,
    filename,
  );

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  async function ensurePreview() {
    if (previewUrl || previewLoading) return previewUrl;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { blob } = await downloadMessagingAttachmentBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      return url;
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Aperçu indisponible.",
      );
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- déclenche le download + setState pour aperçu */
    if (kind === "image" || kind === "video" || kind === "audio") {
      void ensurePreview();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id]);

  async function handleDownload() {
    if (downloadPending) return;
    setDownloadPending(true);
    try {
      const { blob, filename: fromHeader } =
        await downloadMessagingAttachmentBlob(attachment.id);
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fromHeader || filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Téléchargement impossible.",
      );
    } finally {
      setDownloadPending(false);
    }
  }

  const baseChrome = isMine
    ? "bg-white/15 border-white/30 text-white"
    : "bg-neutral-1 border-neutral-4 text-neutral-8";
  const subText = isMine ? "text-white/80" : "text-neutral-6";

  if (kind === "image") {
    return (
      <div
        className={`overflow-hidden rounded-xl border ${baseChrome.replace(
          "bg-white/15",
          "bg-transparent",
        )}`}
      >
        {previewLoading ? (
          <div className="flex h-40 items-center justify-center bg-neutral-2 text-neutral-5">
            <Icon icon="svg-spinners:90-ring-with-bg" width={20} />
          </div>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={filename}
            className="max-h-72 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-neutral-2 text-xs text-neutral-6">
            {previewError || "Aperçu indisponible"}
          </div>
        )}
        <div
          className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
            isMine ? "bg-white/10" : "bg-neutral-2"
          }`}
        >
          <span className={`truncate ${isMine ? "text-white" : "text-neutral-7"}`}>
            {filename}
          </span>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadPending}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
              isMine
                ? "bg-white/20 text-white hover:bg-white/30"
                : "bg-primary-5 text-primary-1 hover:bg-primary-4/40"
            }`}
            title="Télécharger"
          >
            <Icon icon="solar:download-bold" width={12} />
            {downloadPending ? "…" : "DL"}
          </button>
        </div>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className={`overflow-hidden rounded-xl border ${baseChrome}`}>
        {previewUrl ? (
          <video
            src={previewUrl}
            controls
            className="max-h-72 w-full bg-black"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-neutral-2 text-xs text-neutral-6">
            {previewLoading ? (
              <Icon icon="svg-spinners:90-ring-with-bg" width={20} />
            ) : (
              previewError || "Aperçu vidéo indisponible"
            )}
          </div>
        )}
        <div
          className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
            isMine ? "bg-white/10" : "bg-neutral-2"
          }`}
        >
          <span className="truncate">{filename}</span>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadPending}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
              isMine
                ? "bg-white/20 text-white hover:bg-white/30"
                : "bg-primary-5 text-primary-1 hover:bg-primary-4/40"
            }`}
          >
            <Icon icon="solar:download-bold" width={12} />
            {downloadPending ? "…" : "Télécharger"}
          </button>
        </div>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className={`flex flex-col gap-2 rounded-xl border p-3 ${baseChrome}`}>
        <div className="flex items-center gap-2 text-small">
          <Icon icon="solar:music-note-bold" width={18} />
          <span className="truncate">{filename}</span>
          {size ? <span className={`text-xs ${subText}`}>{formatBytes(size)}</span> : null}
        </div>
        {previewUrl ? (
          <audio src={previewUrl} controls className="w-full" />
        ) : (
          <p className={`text-xs ${subText}`}>
            {previewLoading
              ? "Chargement…"
              : previewError || "Lecteur audio indisponible"}
          </p>
        )}
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className={`overflow-hidden rounded-xl border ${baseChrome}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <Icon
            icon="solar:document-text-bold"
            width={18}
            className={isMine ? "text-white" : "text-primary-1"}
          />
          <span className="min-w-0 flex-1 truncate text-small">
            {filename}
          </span>
          {size ? (
            <span className={`text-xs ${subText}`}>{formatBytes(size)}</span>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await ensurePreview();
              setPdfExpanded((v) => !v);
            }}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
              isMine
                ? "bg-white/20 text-white hover:bg-white/30"
                : "bg-primary-5 text-primary-1 hover:bg-primary-4/40"
            }`}
          >
            <Icon
              icon={pdfExpanded ? "solar:eye-closed-bold" : "solar:eye-bold"}
              width={12}
            />
            {pdfExpanded ? "Réduire" : "Aperçu"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadPending}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
              isMine
                ? "bg-white/20 text-white hover:bg-white/30"
                : "bg-primary-5 text-primary-1 hover:bg-primary-4/40"
            }`}
          >
            <Icon icon="solar:download-bold" width={12} />
            {downloadPending ? "…" : "DL"}
          </button>
        </div>
        {pdfExpanded ? (
          previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-96 w-full border-t border-neutral-4"
              title={filename}
            />
          ) : (
            <div className="flex h-32 items-center justify-center border-t border-neutral-4 bg-neutral-2 text-xs text-neutral-6">
              {previewLoading ? "Chargement…" : previewError || ""}
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 text-small ${baseChrome}`}
    >
      <Icon
        icon="solar:paperclip-bold"
        width={18}
        className={isMine ? "text-white" : "text-primary-1"}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate">{filename}</p>
        {size ? (
          <p className={`text-xs ${subText}`}>{formatBytes(size)}</p>
        ) : null}
        {previewError ? (
          <p className="mt-1 text-xs text-red-400">{previewError}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloadPending}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
          isMine
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-primary-5 text-primary-1 hover:bg-primary-4/40"
        }`}
      >
        <Icon icon="solar:download-bold" width={12} />
        {downloadPending ? "…" : "Télécharger"}
      </button>
    </div>
  );
}
