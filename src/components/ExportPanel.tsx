import { useState } from "react";
import { Download, Loader2, Palette, SlidersHorizontal, Sparkles } from "lucide-react";
import { resizeImage } from "../lib/imageProcessor";
import type { BackgroundMode, ExportSettings, ImageEffect, ImageTransform, OutputFormat } from "../lib/imageProcessor";
import { downloadBlob } from "../lib/download";
import { downloadZip } from "../lib/zip";
import type { PlatformPreset } from "../data/platforms";

interface Props {
  image: string;
  platforms: PlatformPreset[];
  transform?: ImageTransform;
}

export default function ExportPanel({ image, platforms, transform }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState(92);
  const [format, setFormat] = useState<OutputFormat>("jpg");
  const [background, setBackground] = useState<BackgroundMode>("cover");
  const [backgroundColor, setBackgroundColor] = useState("#101828");
  const [effect, setEffect] = useState<ImageEffect>("none");

  const settings: ExportSettings = {
    format,
    quality: quality / 100,
    background: format === "jpg" && background === "transparent" ? "solid" : background,
    backgroundColor,
    effect,
  };

  async function exportImages() {
    if (platforms.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      if (platforms.length === 1) {
        const blob = await resizeImage(image, platforms[0], transform, settings);
        downloadBlob(blob, `${platforms[0].id}.${format}`);
      } else {
        const files: Array<{ blob: Blob; filename: string }> = [];

        for (const platform of platforms) {
          try {
            const blob = await resizeImage(image, platform, transform, settings);
            files.push({
              blob,
              filename: `${platform.id}.${format}`,
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

      <p className="mt-3 text-sm text-slate-600">Files are generated locally in your browser. Nothing is uploaded.</p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-sky-600" /> Compression</span>
          <span>{quality}%</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Small", value: 65 },
            { label: "Balanced", value: 82 },
            { label: "Best", value: 92 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setQuality(preset.value)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                quality === preset.value ? "border-sky-400 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          className="mt-3 w-full accent-sky-600"
          type="range"
          min="60"
          max="100"
          value={quality}
          onChange={(event) => setQuality(Number(event.target.value))}
          aria-label="Set JPEG and WebP compression quality"
        />
        <p className="mt-2 text-xs text-slate-500">WebP at 65–82% is usually the smallest option. PNG preserves detail but is not compressed by this slider.</p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label htmlFor="export-format" className="text-sm font-medium text-slate-700">File format</label>
        <select
          id="export-format"
          value={format}
          onChange={(event) => {
            const nextFormat = event.target.value as OutputFormat;
            setFormat(nextFormat);
            if (nextFormat === "jpg" && background === "transparent") {
              setBackground("solid");
            }
          }}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
        >
          <option value="jpg">JPEG — compatible and compact</option>
          <option value="webp">WebP — smallest modern files</option>
          <option value="png">PNG — crisp and lossless</option>
        </select>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700"><Palette className="h-4 w-4 text-sky-600" /> Space around your image</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ["cover", "Fill crop"],
            ["blur", "Blurry backdrop"],
            ["solid", "Solid colour"],
            ["gradient", "Gradient"],
            ["transparent", "Transparent"],
          ] as Array<[BackgroundMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={mode === "transparent" && format === "jpg"}
              onClick={() => setBackground(mode)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                background === mode ? "border-sky-400 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {label}
            </button>
          ))}
        </div>
        {background === "solid" || background === "gradient" ? (
          <label className="mt-3 flex items-center justify-between text-sm text-slate-600">
            Base colour
            <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} aria-label="Choose background colour" />
          </label>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700"><Sparkles className="h-4 w-4 text-sky-600" /> Make it fun</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ["none", "Original"],
            ["mono", "Film noir"],
            ["warm", "Golden hour"],
            ["pop", "Colour pop"],
          ] as Array<[ImageEffect, string]>).map(([nextEffect, label]) => (
            <button
              key={nextEffect}
              type="button"
              onClick={() => setEffect(nextEffect)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                effect === nextEffect ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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