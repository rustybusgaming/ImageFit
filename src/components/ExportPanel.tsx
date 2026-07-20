import { useState } from "react";
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
    <div className="mt-6 space-y-2">
      <button
        disabled={platforms.length === 0 || isExporting}
        onClick={exportImages}
        className="rounded-xl bg-black dark:bg-white text-white dark:text-black px-6 py-3 disabled:opacity-40 transition-opacity"
      >
        {isExporting
          ? "Exporting..."
          : platforms.length === 1
          ? "Export Image"
          : `Export ${platforms.length} Images`}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}