import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Maximize, Palette, SlidersHorizontal, Sparkles } from "lucide-react";
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
  const [useOriginalSize, setUseOriginalSize] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);

  const previewUrlRef = useRef<string | null>(null);

  // Load natural dimensions of the source image
  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = image;
  }, [image]);

const originalPreset: PlatformPreset | null = originalDimensions
    ? {
        id: "original",
        platform: "custom", // <-- Added this
        format: format,     // <-- Added this
        name: "Original Resolution",
        width: originalDimensions.width,
        height: originalDimensions.height,
        description: "Exact 1:1 original pixel dimensions",
      } as PlatformPreset
    : null;
    
  const activePlatforms = useOriginalSize && originalPreset ? [originalPreset] : platforms;
  const previewPlatform = activePlatforms[0];
  const previewKey = JSON.stringify({
    image,
    platform: previewPlatform?.id,
    width: previewPlatform?.width,
    height: previewPlatform?.height,
    transform,
    quality,
    format,
    background,
    backgroundColor,
    effect,
    useOriginalSize,
  });

  const settings: ExportSettings = {
    format,
    quality: quality / 100,
    background: format === "jpg" && background === "transparent" ? "solid" : background,
    backgroundColor,
    effect,
  };

  // Estimate file size in Megabytes
  const calculateEstimatedSizeMB = (w: number, h: number, fmt: OutputFormat, q: number) => {
    const rawBytes = w * h * 4;
    const qFactor = q / 100;
    let ratio = 0.4;

    if (fmt === "jpg") ratio = 0.15 * (0.5 + 0.5 * qFactor);
    else if (fmt === "webp") ratio = 0.1 * (0.5 + 0.5 * qFactor);
    else if (fmt === "png") ratio = 0.45;

    return (rawBytes * ratio) / (1024 * 1024);
  };

  const totalEstimatedMB = activePlatforms.reduce((sum, p) => {
    return sum + calculateEstimatedSizeMB(p.width, p.height, format, quality);
  }, 0);

  const isLargeFile = totalEstimatedMB > 15;

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
          setPreviewError({
            key: previewKey,
            message: previewFailure instanceof Error ? previewFailure.message : "Could not generate the preview.",
          });
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
    if (activePlatforms.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      if (activePlatforms.length === 1) {
        const blob = await resizeImage(image, activePlatforms[0], transform, settings);
        await downloadBlob(blob, `${activePlatforms[0].id}.${format}`);
      } else {
        const files: Array<{ blob: Blob; filename: string }> = [];

        for (const platform of activePlatforms) {
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
            {useOriginalSize
              ? "Exporting original pixel size"
              : activePlatforms.length === 0
              ? "Choose a preset"
              : `Ready to export ${activePlatforms.length} file${activePlatforms.length > 1 ? "s" : ""}`}
          </h2>
        </div>
        <div className="border border-[#d7ff47]/35 bg-[#20251a] px-3 py-1 font-mono text-xs font-semibold text-[#d7ff47]">
          {activePlatforms.length}
        </div>
      </div>

      <p className="mt-3 text-sm text-[#aeb2a5]">Files are generated locally in your browser. Nothing is uploaded.</p>

      {/* Bypass Presets / Original Resolution Toggle */}
      <div className="mt-5 border border-white/10 bg-[#1b1e1a] p-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]">
            <Maximize className="h-4 w-4 text-[#d7ff47]" /> Keep original pixel size
          </span>
          <input
            type="checkbox"
            checked={useOriginalSize}
            onChange={(e) => setUseOriginalSize(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-[#151714] accent-[#d7ff47] focus:ring-0 focus:ring-offset-0"
          />
        </label>
        <p className="mt-2 text-xs text-[#8f9389]">
          {originalDimensions
            ? `Bypasses preset dimensions and exports exact ${originalDimensions.width}×${originalDimensions.height} source resolution.`
            : "Bypasses presets to preserve your source image dimensions."}
        </p>
      </div>

      <div className="mt-4 border border-white/10 bg-[#090a09] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#d9dbd2]">Export preview</p>
          {previewPlatform ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a6aa9d]">
              {previewPlatform.width}x{previewPlatform.height}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid min-h-40 place-items-center overflow-hidden bg-[linear-gradient(45deg,#151714_25%,transparent_25%),linear-gradient(-45deg,#151714_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#151714_75%),linear-gradient(-45deg,transparent_75%,#151714_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px]">
          {preview?.key === previewKey ? (
            <img src={preview.url} alt="Current export preview" className="max-h-72 max-w-full object-contain" />
          ) : previewPlatform ? (
            <span className="text-sm text-[#aeb2a5]">Rendering preview...</span>
          ) : (
            <span className="text-sm text-[#aeb2a5]">Choose a preset or enable original size to preview.</span>
          )}
        </div>
        {previewError?.key === previewKey ? <p className="mt-3 text-sm text-[#ffb39d]">{previewError.message}</p> : null}
      </div>

      <div className="mt-4 border border-white/10 bg-[#1b1e1a] p-4">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-[#d9dbd2]">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#d7ff47]" /> Compression
          </span>
          <span>{quality}%</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Compression quality">
          {[
            { label: "Small", value: 65 },
            { label: "Balanced", value: 82 },
            { label: "Best", value: 92 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setQuality(preset.value)}
              aria-pressed={quality === preset.value}
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
        <label htmlFor="export-format" className="text-sm font-medium text-[#d9dbd2]">
          File format
        </label>
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
        <p className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]">
          <Palette className="h-4 w-4 text-[#d7ff47]" /> Space around your image
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Background mode">
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
                aria-disabled={isDisabled}
                aria-pressed={background === mode}
                title={isDisabled ? "Transparent backgrounds are not supported by JPEG format" : undefined}
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
            );
          })}
        </div>
        {background === "solid" || background === "gradient" ? (
          <label className="mt-3 flex items-center justify-between text-sm text-[#b7baaf]">
            Base colour
            <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} aria-label="Choose background colour" />
          </label>
        ) : null}
      </div>

      <div className="mt-4 border border-white/10 bg-[#1b1e1a] p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-[#d9dbd2]">
          <Sparkles className="h-4 w-4 text-[#ff9a7b]" /> Colour treatment
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Colour treatment">
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
              aria-pressed={effect === nextEffect}
              className={`border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1e1a] ${
                effect === nextEffect ? "border-[#ff7448] bg-[#2b1913] text-[#ffb39d]" : "border-white/10 bg-[#151714] text-[#b7baaf] hover:border-white/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* File Size Estimation & Warnings */}
      {activePlatforms.length > 0 ? (
        <div className="mt-4 border border-white/10 bg-[#10120f] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#aeb2a5]">Estimated total size</span>
            <span className="font-mono font-semibold text-[#f4f4ed]">~{totalEstimatedMB.toFixed(2)} MB</span>
          </div>

          {isLargeFile ? (
            <div className="mt-2 flex items-start gap-2 border border-[#ff7448]/40 bg-[#2b1913] p-2.5 text-xs text-[#ffb39d]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff7448]" />
              <span>
                <strong>Heads up:</strong> High pixel dimensions or uncompressed formats may result in a heavy file.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        aria-disabled={activePlatforms.length === 0 || isExporting}
        title={activePlatforms.length === 0 ? "Select at least one preset or enable original size to export" : isExporting ? "Export in progress..." : undefined}
        onClick={(e) => {
          if (activePlatforms.length === 0 || isExporting) {
            e.preventDefault();
            return;
          }
          void exportImages();
        }}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-[#d7ff47] px-5 py-3 text-sm font-bold text-[#141610] transition hover:bg-[#e4ff80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ff47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151714] aria-disabled:cursor-not-allowed aria-disabled:bg-[#3a4032] aria-disabled:text-[#aeb2a5]"
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {isExporting
          ? "Exporting..."
          : useOriginalSize
          ? "Export original resolution"
          : activePlatforms.length > 1
          ? `Export ${activePlatforms.length} images`
          : "Export image"}
      </button>

      {error ? <p className="mt-3 text-sm text-[#ff9a7b]">{error}</p> : null}
      {!error && activePlatforms.length === 0 ? (
        <p className="mt-3 text-sm text-[#8f9389]">Pick at least one preset or check "Keep original pixel size" to enable downloads.</p>
      ) : null}
    </div>
  );
}