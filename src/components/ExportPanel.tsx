import { useEffect, useRef, useState } from "react";
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
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(null);
  const [previewError, setPreviewError] = useState<{ key: string; message: string } | null>(null);
  const [quality, setQuality] = useState(92);
  const [format, setFormat] = useState<OutputFormat>("jpg");
  const [background, setBackground] = useState<BackgroundMode>("cover");
  const [backgroundColor, setBackgroundColor] = useState("#101828");
  const [effect, setEffect] = useState<ImageEffect>("none");
  const previewUrlRef = useRef<string | null>(null);
  const previewPlatform = platforms[0];
  const previewKey = JSON.stringify({ image, platform: previewPlatform?.id, transform, quality, format, background, backgroundColor, effect });

  const settings: ExportSettings = {
    format,
    quality: quality / 100,
    background: format === "jpg" && background === "transparent" ? "solid" : background,
    backgroundColor,
    effect,
  };

  useEffect(() => {
    let cancelled = false;

    if (!previewPlatform) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      return;
    }

    const previewSettings: ExportSettings = {
      format,
      quality: quality / 100,
      background: format === "jpg" && background === "transparent" ? "solid" : background,
      backgroundColor,
      effect,
    };

    void resizeImage(image, previewPlatform, transform, previewSettings)
      .then((blob) => {
        if (cancelled) return;

        const nextUrl = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = nextUrl;
        setPreviewError(null);
        setPreview({ key: previewKey, url: nextUrl });
      })
      .catch((previewFailure) => {
        if (!cancelled) {
          setPreviewError({ key: previewKey, message: previewFailure instanceof Error ? previewFailure.message : "Could not generate the preview." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [background, backgroundColor, effect, format, image, previewKey, previewPlatform, quality, transform]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function exportImages() {
    if (platforms.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      if (platforms.length === 1) {
        const blob = await resizeImage(image, platforms[0], transform, settings);
        await downloadBlob(blob, `${platforms[0].id}.${format}`);
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
    <div className="border border-white/10 bg-[#151714] p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a6aa9d]">Render settings</p>
          <h2 className="mt-1 text-xl font-semibold text-[#f4f4ed]">
            {platforms.length === 0 ? "Choose a preset" : `Ready to export ${platforms.length} file${platforms.length > 1 ? "s" : ""}`}
          </h2>
        </div>
        <div className="border border-[#d7ff47]/35 bg-[#20251a] px-3 py-1 font-mono text-xs font-semibold text-[#d7ff47]">
          {platforms.length}
        </div>
      </div>

      <p className="mt-3 text-sm text-[#aeb2a5]">Files are generated locally in your browser. Nothing is uploaded.</p>

      <div className="mt-5 border border-white/10 bg-[#090a09] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#d9dbd2]">Export preview</p>
          {previewPlatform ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a6aa9d]">{previewPlatform.width}x{previewPlatform.height}</span> : null}
        </div>
        <div className="mt-3 grid min-h-40 place-items-center overflow-hidden bg-[linear-gradient(45deg,#151714_25%,transparent_25%),linear-gradient(-45deg,#151714_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#151714_75%),linear-gradient(-45deg,transparent_75%,#151714_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px]">
          {preview?.key === previewKey ? <img src={preview.url} alt="Current export preview" className="max-h-72 max-w-full object-contain" /> : previewPlatform ? <span className="text-sm text-[#aeb2a5]">Rendering preview...</span> : <span className="text-sm text-[#aeb2a5]">Choose a preset to preview it.</span>}
        </div>
        {previewError?.key === previewKey ? <p className="mt-3 text-sm text-[#ffb39d]">{previewError.message}</p> : null}
      </div>

      <div className="mt-5 border border-white/10 bg-[#1b1e1a] p-4">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-[#d9dbd2]">
          <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#d7ff47]" /> Compression</span>
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
              aria-pressed={quality === preset.value}
              onClick={() => setQuality(preset.value)}
              className={`border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1e1a] ${
                quality === preset.value ? "border-[#d7ff47] bg-[#242a1c] text-[#d7ff47]" : "border-white/10 bg-[#151714] text-[#b7baaf] hover:border-white/30"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          className="mt-3 w-full accent-[#d7ff47]"
          type="range"
          min="60"
          max="100"
          value={quality}
          onChange={(event) => setQuality(Number(event.target.value))}
          aria-label="Set JPEG and WebP compression quality"
        />
        <p className="mt-2 text-xs text-[#8f9389]">WebP at 65–82% is usually the smallest option. PNG preserves detail but is not compressed by this slider.</p>
      </div>

      <div className="mt-4 border border-white/10 bg-[#1b1e1a] p-4">
        <label htmlFor="export-format" className="text-sm font-medium text-[#d9dbd2]">File format</label>
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
          className="mt-2 w-full border border-white/10 bg-[#151714] px-3 py-2 text-sm text-[#f4f4ed] outline-none focus:border-[#d7ff47]"
        >
          <option value="jpg">JPEG — compatible and compact</option>
          <option value="webp">WebP — smallest modern files</option>
          <option value="png">PNG — crisp and lossless</option>
        </select>
      </div>

      <div className="mt-4 border border-white/10 bg-[#1b1e1a] p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]"><Palette className="h-4 w-4 text-[#d7ff47]" /> Space around your image</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ["cover", "Fill crop"],
            ["blur", "Blurry backdrop"],
            ["solid", "Solid colour"],
            ["gradient", "Gradient"],
            ["transparent", "Transparent"],
          ] as Array<[BackgroundMode, string]>).map(([mode, label]) => {
            const isDisabled = mode === "transparent" && format === "jpg";
            return (
            <button
              key={mode}
              type="button"
              aria-pressed={background === mode}
              aria-disabled={isDisabled}
              title={isDisabled ? "JPEG does not support transparency" : undefined}
              onClick={(e) => {
                if (isDisabled) {
                  e.preventDefault();
                  return;
                }
                setBackground(mode);
              }}
              className={`border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1e1a] ${
                background === mode ? "border-[#d7ff47] bg-[#242a1c] text-[#d7ff47]" : "border-white/10 bg-[#151714] text-[#b7baaf] hover:border-white/30"
              } aria-disabled:cursor-not-allowed aria-disabled:opacity-40`}
            >
              {label}
            </button>
          )})}
        </div>
        {background === "solid" || background === "gradient" ? (
          <label className="mt-3 flex items-center justify-between text-sm text-[#b7baaf]">
            Base colour
            <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} aria-label="Choose background colour" />
          </label>
        ) : null}
      </div>

      <div className="mt-4 border border-white/10 bg-[#1b1e1a] p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]"><Sparkles className="h-4 w-4 text-[#ff9a7b]" /> Colour treatment</p>
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
              aria-pressed={effect === nextEffect}
              onClick={() => setEffect(nextEffect)}
              className={`border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1e1a] ${
                effect === nextEffect ? "border-[#ff7448] bg-[#2b1913] text-[#ffb39d]" : "border-white/10 bg-[#151714] text-[#b7baaf] hover:border-white/30"
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
        className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-[#d7ff47] px-5 py-3 text-sm font-bold text-[#141610] transition hover:bg-[#e4ff80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714] disabled:cursor-not-allowed disabled:bg-[#3a4032] disabled:text-[#aeb2a5]"
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

      {error ? <p className="mt-3 text-sm text-[#ff9a7b]">{error}</p> : null}
      {!error && platforms.length === 0 ? (
        <p className="mt-3 text-sm text-[#8f9389]">Pick at least one preset to enable downloads.</p>
      ) : null}
    </div>
  );
}