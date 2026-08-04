import { useState } from "react";
import { Download, Laugh, Loader2, Shrink } from "lucide-react";
import { compressImage } from "../lib/imageProcessor";
import type { CompressionSettings } from "../lib/imageProcessor";
import { downloadBlob } from "../lib/download";

interface Props {
  image: string;
  sourceFile: File | null;
}

interface SquishPreset {
  id: string;
  label: string;
  description: string;
  settings: CompressionSettings;
}

const SQUISH_PRESETS: SquishPreset[] = [
  { id: "tidy", label: "Tidy", description: "Same dimensions, less baggage.", settings: { format: "webp", quality: 0.82, scale: 1, effect: "none" } },
  { id: "crunchy", label: "Crunchy", description: "Smaller, with a little crunch.", settings: { format: "webp", quality: 0.58, scale: 0.82, effect: "pop" } },
  { id: "potato", label: "Potato", description: "Alarmingly compact. Deliciously pixelated.", settings: { format: "jpg", quality: 0.3, scale: 0.55, effect: "warm" } },
  { id: "deep-fried", label: "Deep fried", description: "Maximum meme energy. Minimum bytes.", settings: { format: "jpg", quality: 0.14, scale: 0.38, effect: "pop" } },
];

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
      const blob = await compressImage(image, selectedPreset.settings);
      const sourceSize = sourceFile?.size;
      const saved = sourceSize ? Math.round((1 - blob.size / sourceSize) * 100) : null;
      setResult(saved !== null && saved > 0 ? `${formatBytes(blob.size)} · ${saved}% smaller` : `${formatBytes(blob.size)} ready`);
      downloadBlob(blob, `imagefit-${selectedPreset.id}.${selectedPreset.settings.format}`);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "Could not compress this image.");
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fuchsia-600 text-white">
          <Laugh className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-700">Image squish</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Our in-house compressor</h2>
          <p className="mt-1 text-sm text-slate-600">Compress the original image directly—no resizing preset needed.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {SQUISH_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPresetId(preset.id)}
            className={`rounded-xl border p-3 text-left transition ${
              presetId === preset.id ? "border-fuchsia-400 bg-white shadow-sm" : "border-fuchsia-100 bg-white/60 hover:border-fuchsia-300"
            }`}
          >
            <span className="block text-sm font-semibold text-slate-900">{preset.label}</span>
            <span className="mt-1 block text-xs leading-4 text-slate-600">{preset.description}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={isCompressing}
        onClick={squishImage}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shrink className="h-4 w-4" />}
        {isCompressing ? "Squishing..." : `Squish it: ${selectedPreset.label}`}
        {!isCompressing && <Download className="h-4 w-4" />}
      </button>
      {result ? <p className="mt-3 text-sm font-medium text-emerald-700">{result}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
