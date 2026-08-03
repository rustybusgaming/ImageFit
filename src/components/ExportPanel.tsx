import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { resizeImage } from "../lib/imageProcessor";
import { downloadBlob } from "../lib/download";
import { downloadZip } from "../lib/zip";
import type { PlatformPreset } from "../data/platforms";

interface Props {
  image: string;
  platforms: PlatformPreset[];
}

export default function ExportPanel({ image, platforms }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportImages() {
    if (platforms.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      if (platforms.length === 1) {
        const blob = await resizeImage(image, platforms[0]);
        downloadBlob(blob, `${platforms[0].id}.${platforms[0].format}`);
      } else {
        const files: Array<{ blob: Blob; filename: string }> = [];

        for (const platform of platforms) {
          try {
            const blob = await resizeImage(image, platform);
            files.push({
              blob,
              filename: `${platform.id}.${platform.format}`,
            });
          } catch (err) {
            console.error(`Failed to resize for ${platform.id}:`, err);
          }
        }

        if (files.length > 0) {
          await downloadZip(files, "imagefit-export.zip");
        } else {
          setError("Failed to export any images");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Export</p>
          <h2 className="text-xl font-semibold text-slate-900">
            {platforms.length === 0 ? "Choose a preset" : `Ready to export ${platforms.length} file${platforms.length > 1 ? "s" : ""}`}
          </h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
          {platforms.length}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Download the resized image directly or bundle your selection into a zip archive.
      </p>

      <button
        disabled={platforms.length === 0 || isExporting}
        onClick={exportImages}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {isExporting
          ? "Exporting..."
          : platforms.length === 1
          ? "Export image"
          : `Export ${platforms.length} images`}
      </button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {!error && platforms.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Pick at least one preset to enable downloads.</p>
      ) : null}
    </div>
  );
}