import { useState } from "react";
import { Download, Laugh, Loader2, Shrink } from "lucide-react";
import { compressImage, compressImageToTarget } from "../lib/imageProcessor";
import type { CompressionSettings, TargetCompressionSettings } from "../lib/imageProcessor";
import { downloadBlob } from "../lib/download";
import { readImageFormat } from "../lib/imageFormats";
import { compressAnimatedImage } from "../lib/animatedProcessor";

interface Props {
  image: string;
  sourceFile: File | null;
}

interface SquishPreset {
  id: string;
  label: string;
  description: string;
  settings: CompressionSettings | TargetCompressionSettings;
}

const SQUISH_PRESETS: SquishPreset[] = [
  { id: "tidy", label: "Tidy", description: "Same dimensions, less baggage.", settings: { format: "webp", quality: 0.82, scale: 1, effect: "none" } },
  { id: "crunchy", label: "Crunchy", description: "Smaller, with a little crunch.", settings: { format: "webp", quality: 0.58, scale: 0.82, effect: "pop" } },
  { id: "potato", label: "Potato", description: "Alarmingly compact. Deliciously pixelated.", settings: { format: "jpg", quality: 0.3, scale: 0.55, effect: "warm" } },
  { id: "deep-fried", label: "Deep fried", description: "Maximum meme energy. Minimum bytes.", settings: { format: "jpg", quality: 0.14, scale: 0.38, effect: "pop" } },
  { id: "discord-10mb", label: "Discord 10 MB", description: "WebP tuned to fit Discord's 10 MB upload limit.", settings: { format: "webp", quality: 0.9, scale: 1, effect: "none", maxBytes: 10 * 1024 * 1024 } },
  { id: "discord-5mb", label: "Discord 5 MB", description: "WebP tuned to fit Discord's 5 MB upload limit.", settings: { format: "webp", quality: 0.9, scale: 1, effect: "none", maxBytes: 5 * 1024 * 1024 } },
];

function isTargetCompression(settings: CompressionSettings | TargetCompressionSettings): settings is TargetCompressionSettings {
  return "maxBytes" in settings;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageSquisher({ image, sourceFile }: Props) {
  const [presetId, setPresetId] = useState("tidy");
  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedPreset = SQUISH_PRESETS.find((preset) => preset.id === presetId) ?? SQUISH_PRESETS[0];

  async function squishImage() {
    setIsCompressing(true);
    setError(null);
    setResult(null);

    try {
      const settings = selectedPreset.settings;
      const maxBytes = isTargetCompression(settings) ? settings.maxBytes : undefined;
      const format = sourceFile ? await readImageFormat(sourceFile) : null;

      // Animated sources go through FFmpeg: the canvas pipeline would flatten them to one frame.
      if (sourceFile && format?.isAnimated) {
        if (!format.isFFmpegDecodable) {
          throw new Error(
            "Animated WebP files cannot be re-encoded without losing their animation, so ImageFit leaves them alone."
          );
        }

        const animated = await compressAnimatedImage(sourceFile, {
          quality: settings.quality,
          scale: settings.scale,
          effect: settings.effect,
          maxBytes,
        });
        const savedShare = Math.round((1 - animated.blob.size / sourceFile.size) * 100);
        setResult(
          savedShare > 0
            ? `${formatBytes(animated.blob.size)} · ${savedShare}% smaller · animation kept`
            : `${formatBytes(animated.blob.size)} ready · animation kept`
        );
        await downloadBlob(animated.blob, `imagefit-${selectedPreset.id}.${animated.extension}`);
        return;
      }

      // Anything not natively renderable was already converted when the file was loaded.
      const blob = isTargetCompression(settings)
        ? await compressImageToTarget(image, settings)
        : await compressImage(image, settings);
      const sourceSize = sourceFile?.size;
      const saved = sourceSize ? Math.round((1 - blob.size / sourceSize) * 100) : null;
      setResult(saved !== null && saved > 0 ? `${formatBytes(blob.size)} · ${saved}% smaller` : `${formatBytes(blob.size)} ready`);
      await downloadBlob(blob, `imagefit-${selectedPreset.id}.${settings.format}`);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "Could not compress this image.");
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <section className="border border-[#ff7448]/35 bg-[#1d1512] p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center bg-[#ff7448] text-[#21100b] shadow-[3px_3px_0_#d7ff47]">
          <Laugh className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff9a7b]">Compression bench</p>
          <h2 className="mt-1 text-xl font-semibold text-[#fff5ee]">Original image squisher</h2>
          <p className="mt-1 text-sm text-[#e8bbae]">Compress the original image directly—no resizing preset needed.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {SQUISH_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPresetId(preset.id)}
            className={`border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
              presetId === preset.id ? "border-[#ff7448] bg-[#2b1913] shadow-[3px_3px_0_#ff7448]" : "border-[#ff7448]/20 bg-[#211814] hover:border-[#ff7448]/60"
            }`}
          >
            <span className="block text-sm font-semibold text-[#fff5ee]">{preset.label}</span>
            <span className="mt-1 block text-xs leading-4 text-[#e8bbae]">{preset.description}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={isCompressing}
        onClick={squishImage}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#ff7448] px-5 py-3 text-sm font-bold text-[#21100b] transition hover:bg-[#ff9a7b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] disabled:cursor-not-allowed disabled:bg-[#6d392d] disabled:text-[#e8bbae]"
      >
        {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shrink className="h-4 w-4" />}
        {isCompressing ? "Squishing..." : `Squish it: ${selectedPreset.label}`}
        {!isCompressing && <Download className="h-4 w-4" />}
      </button>
      {result ? <p className="mt-3 text-sm font-medium text-[#d7ff47]">{result}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#ffb39d]">{error}</p> : null}
    </section>
  );
}
