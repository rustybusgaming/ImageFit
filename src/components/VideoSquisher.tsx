import { useState } from "react";
import { Download, FileVideo, Loader2, Shrink } from "lucide-react";
import { downloadBlob } from "../lib/download";
import { compressVideoToTarget } from "../lib/videoProcessor";
import type { VideoResolution } from "../lib/videoProcessor";

interface Props {
  sourceFile: File;
}

const DISCORD_PRESETS = [
  { id: "discord-10mb", label: "Discord 10 MB", maxBytes: 10 * 1024 * 1024 },
  { id: "discord-5mb", label: "Discord 5 MB", maxBytes: 5 * 1024 * 1024 },
] as const;

const RESOLUTION_PRESETS: Array<{ id: VideoResolution; label: string; description: string }> = [
  { id: "1080p", label: "1080p", description: "Best detail" },
  { id: "720p", label: "720p", description: "Balanced" },
  { id: "480p", label: "480p", description: "Smallest files" },
];

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoSquisher({ sourceFile }: Props) {
  const [presetId, setPresetId] = useState<(typeof DISCORD_PRESETS)[number]["id"]>("discord-10mb");
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedPreset = DISCORD_PRESETS.find((preset) => preset.id === presetId) ?? DISCORD_PRESETS[0];

  async function squishVideo() {
    setIsCompressing(true);
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      const blob = await compressVideoToTarget(sourceFile, selectedPreset.maxBytes, resolution, setProgress);
      downloadBlob(blob, `imagefit-${selectedPreset.id}.mp4`);
      setResult(`${formatBytes(blob.size)} MP4 ready for Discord.`);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "Could not compress this video.");
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <section className="border border-[#ff7448]/35 bg-[#1d1512] p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)]">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center bg-[#ff7448] text-[#21100b] shadow-[3px_3px_0_#d7ff47]">
          <FileVideo className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff9a7b]">Discord video compressor</p>
          <h2 className="mt-1 text-xl font-semibold text-[#fff5ee]">Fit your video upload</h2>
          <p className="mt-1 text-sm text-[#e8bbae]">Creates an MP4 in your browser. The first run downloads the local encoder.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {DISCORD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPresetId(preset.id)}
            className={`border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
              preset.id === presetId ? "border-[#ff7448] bg-[#2b1913] shadow-[3px_3px_0_#ff7448]" : "border-[#ff7448]/20 bg-[#211814] hover:border-[#ff7448]/60"
            }`}
          >
            <span className="block text-sm font-semibold text-[#fff5ee]">{preset.label}</span>
            <span className="mt-1 block text-xs leading-4 text-[#e8bbae]">Target limit: {formatBytes(preset.maxBytes)}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-[#fff5ee]">Output resolution</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {RESOLUTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setResolution(preset.id)}
              className={`border px-2 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                preset.id === resolution ? "border-[#ff7448] bg-[#2b1913]" : "border-[#ff7448]/20 bg-[#211814] hover:border-[#ff7448]/60"
              }`}
            >
              <span className="block text-sm font-semibold text-[#fff5ee]">{preset.label}</span>
              <span className="mt-1 block text-xs leading-4 text-[#e8bbae]">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={isCompressing}
        onClick={squishVideo}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#ff7448] px-5 py-3 text-sm font-bold text-[#21100b] transition hover:bg-[#ff9a7b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] disabled:cursor-not-allowed disabled:bg-[#6d392d] disabled:text-[#e8bbae]"
      >
        {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shrink className="h-4 w-4" />}
        {isCompressing ? `Encoding ${Math.round(progress * 100)}%` : `Make ${resolution} ${selectedPreset.label} MP4`}
        {!isCompressing && <Download className="h-4 w-4" />}
      </button>

      {result ? <p className="mt-3 text-sm font-medium text-[#d7ff47]">{result}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#ffb39d]">{error}</p> : null}
    </section>
  );
}