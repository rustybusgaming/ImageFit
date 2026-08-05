import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileVideo, Loader2, RotateCcw, Shrink, Square, X } from "lucide-react";
import { downloadBlob } from "../lib/download";
import { downloadZip } from "../lib/zip";
import { cancelVideoEncoding, compressVideoToTarget, inspectVideo } from "../lib/videoProcessor";
import type { VideoAudioMode, VideoCompatibility, VideoOutputFormat, VideoResolution } from "../lib/videoProcessor";

interface Props {
  sourceFiles: File[];
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

const AUDIO_PRESETS: Array<{ id: VideoAudioMode; label: string }> = [
  { id: "keep", label: "Keep audio" },
  { id: "reduced", label: "Reduce audio" },
  { id: "mute", label: "Mute" },
];

const FRAME_RATES: Array<30 | 24 | 15> = [30, 24, 15];

type QueueStatus = "waiting" | "encoding" | "ready" | "failed" | "cancelled";

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getOutputFilename(file: File, presetId: string, format: VideoOutputFormat): string {
  const sourceName = file.name.replace(/\.[^.]+$/, "") || "video";
  return `${sourceName}-${presetId}.${format}`;
}

function getCompressionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;

  return "Could not compress this video.";
}

export default function VideoSquisher({ sourceFiles }: Props) {
  const [presetId, setPresetId] = useState<(typeof DISCORD_PRESETS)[number]["id"]>("discord-10mb");
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [audio, setAudio] = useState<VideoAudioMode>("keep");
  const [frameRate, setFrameRate] = useState<30 | 24 | 15>(30);
  const [format, setFormat] = useState<VideoOutputFormat>("mp4");
  const [isCompressing, setIsCompressing] = useState(false);
  const [isInspecting, setIsInspecting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compatibility, setCompatibility] = useState<VideoCompatibility | null>(null);
  const [queueStatus, setQueueStatus] = useState<Record<string, QueueStatus>>({});
  const [queueProgress, setQueueProgress] = useState<Record<string, number>>({});
  const [queueErrors, setQueueErrors] = useState<Record<string, string>>({});
  const cancellationRef = useRef(false);
  const selectedPreset = DISCORD_PRESETS.find((preset) => preset.id === presetId) ?? DISCORD_PRESETS[0];

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;

      setIsInspecting(true);
      setCompatibility(null);
      setQueueStatus(Object.fromEntries(sourceFiles.map((file) => [file.name, "waiting"])));
      setQueueProgress(Object.fromEntries(sourceFiles.map((file) => [file.name, 0])));
      setQueueErrors({});

      try {
        const nextCompatibility = await inspectVideo(sourceFiles[0]);
        if (!cancelled) setCompatibility(nextCompatibility);
      } catch (inspectionError) {
        if (!cancelled) setError(inspectionError instanceof Error ? inspectionError.message : "Could not inspect this video.");
      } finally {
        if (!cancelled) setIsInspecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceFiles]);

  async function squishVideos(filesToEncode = sourceFiles) {
    setIsCompressing(true);
    setProgress(0);
    setResult(null);
    setError(null);
    cancellationRef.current = false;
    const files: Array<{ blob: Blob; filename: string }> = [];

    try {
      for (const sourceFile of filesToEncode) {
        if (cancellationRef.current) break;

        setQueueStatus((current) => ({ ...current, [sourceFile.name]: "encoding" }));
        setQueueProgress((current) => ({ ...current, [sourceFile.name]: 0 }));
        setQueueErrors((current) => {
          const next = { ...current };
          delete next[sourceFile.name];
          return next;
        });
        try {
          const blob = await compressVideoToTarget(sourceFile, { maxBytes: selectedPreset.maxBytes, resolution, audio, frameRate, format }, (nextProgress) => {
            setProgress(nextProgress);
            setQueueProgress((current) => ({ ...current, [sourceFile.name]: nextProgress }));
          });
          if (cancellationRef.current) break;
          files.push({ blob, filename: getOutputFilename(sourceFile, selectedPreset.id, format) });
          setQueueStatus((current) => ({ ...current, [sourceFile.name]: "ready" }));
          setQueueProgress((current) => ({ ...current, [sourceFile.name]: 1 }));
        } catch (compressionError) {
          if (cancellationRef.current) break;

          const message = getCompressionErrorMessage(compressionError);
          setQueueStatus((current) => ({ ...current, [sourceFile.name]: "failed" }));
          setQueueErrors((current) => ({ ...current, [sourceFile.name]: message }));
        }
      }

      if (cancellationRef.current) {
        setQueueStatus((current) => Object.fromEntries(Object.entries(current).map(([name, status]) => [name, status === "encoding" || status === "waiting" ? "cancelled" : status])));
        setResult("Encoding cancelled. Ready files remain available from completed runs.");
      } else if (files.length === 1) {
        downloadBlob(files[0].blob, files[0].filename);
        setResult(`1 ${format.toUpperCase()} file ready for Discord.`);
      } else if (files.length > 1) {
        await downloadZip(files, "imagefit-discord-videos.zip");
        setResult(`${files.length} ${format.toUpperCase()} files ready for Discord.`);
      } else {
        setError("No videos were encoded. Retry the failed files or change the export settings.");
      }
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "Could not compress this video.");
    } finally {
      setIsCompressing(false);
    }
  }

  function cancelEncoding() {
    cancellationRef.current = true;
    cancelVideoEncoding();
  }

  function clearFailures() {
    setQueueErrors({});
    setQueueStatus((current) => Object.fromEntries(Object.entries(current).map(([name, status]) => [name, status === "failed" ? "waiting" : status])));
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
          <p className="mt-1 text-sm text-[#e8bbae]">Processes {sourceFiles.length} file{sourceFiles.length === 1 ? "" : "s"} locally. The first run downloads the encoder.</p>
        </div>
      </div>

      {compatibility ? (
        <div className="mt-4 border border-white/10 bg-[#211814] p-3 text-sm text-[#e8bbae]">
          <p className="font-medium text-[#fff5ee]">Source: {compatibility.width}×{compatibility.height} · {Math.round(compatibility.duration)} sec</p>
          {compatibility.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs leading-4">
              {compatibility.warnings.map((warning) => <li key={warning} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff9a7b]" />{warning}</li>)}
            </ul>
          ) : <p className="mt-1 text-xs text-[#d7ff47]">Compatibility check passed.</p>}
        </div>
      ) : isInspecting ? <p className="mt-4 text-sm text-[#e8bbae]">Checking source compatibility...</p> : null}

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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-[#fff5ee]">Audio</p>
          <div className="mt-2 grid gap-2">
            {AUDIO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAudio(preset.id)}
                disabled={format === "gif"}
                className={`border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                  preset.id === audio ? "border-[#ff7448] bg-[#2b1913] text-[#fff5ee]" : "border-[#ff7448]/20 bg-[#211814] text-[#e8bbae] hover:border-[#ff7448]/60"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-[#fff5ee]">Frame rate</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {FRAME_RATES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFrameRate(value)}
                className={`border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                  value === frameRate ? "border-[#ff7448] bg-[#2b1913] text-[#fff5ee]" : "border-[#ff7448]/20 bg-[#211814] text-[#e8bbae] hover:border-[#ff7448]/60"
                }`}
              >
                {value} fps
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium text-[#fff5ee]">File type</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["mp4", "gif"] as VideoOutputFormat[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFormat(value);
                  if (value === "gif") setAudio("mute");
                }}
                className={`border px-2 py-2 text-xs font-semibold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                  value === format ? "border-[#ff7448] bg-[#2b1913] text-[#fff5ee]" : "border-[#ff7448]/20 bg-[#211814] text-[#e8bbae] hover:border-[#ff7448]/60"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={isCompressing || isInspecting}
        onClick={() => void squishVideos()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#ff7448] px-5 py-3 text-sm font-bold text-[#21100b] transition hover:bg-[#ff9a7b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] disabled:cursor-not-allowed disabled:bg-[#6d392d] disabled:text-[#e8bbae]"
      >
        {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shrink className="h-4 w-4" />}
        {isCompressing ? `Encoding ${Math.round(progress * 100)}%` : `Make ${sourceFiles.length} ${resolution} ${format.toUpperCase()} file${sourceFiles.length === 1 ? "" : "s"}`}
        {!isCompressing && <Download className="h-4 w-4" />}
      </button>

      {isCompressing ? (
        <button
          type="button"
          onClick={cancelEncoding}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-[#ff7448]/60 bg-[#211814] px-5 py-2.5 text-sm font-semibold text-[#ffb39d] transition hover:border-[#ff9a7b] hover:text-[#fff5ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512]"
        >
          <Square className="h-4 w-4" />
          Cancel encoding
        </button>
      ) : null}

      {result ? <p className="mt-3 text-sm font-medium text-[#d7ff47]">{result}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#ffb39d]">{error}</p> : null}
      {sourceFiles.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-[#ff7448]/20 pt-3 text-xs text-[#e8bbae]">
          {sourceFiles.map((file) => {
            const status = queueStatus[file.name] ?? "waiting";
            const fileProgress = queueProgress[file.name] ?? 0;

            return (
              <li key={file.name} className="border border-[#ff7448]/20 bg-[#211814] p-2">
                <div className="flex items-center justify-between gap-3"><span className="truncate">{file.name}</span><span className="shrink-0 uppercase">{status === "encoding" ? `${Math.round(fileProgress * 100)}%` : status}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden bg-[#3b251d]"><div className="h-full bg-[#ff7448] transition-[width]" style={{ width: `${fileProgress * 100}%` }} /></div>
                {queueErrors[file.name] ? <p className="mt-2 text-[#ffb39d]">{queueErrors[file.name]}</p> : null}
                {status === "failed" && !isCompressing ? <button type="button" onClick={() => void squishVideos([file])} className="mt-2 inline-flex items-center gap-1 font-semibold text-[#d7ff47] hover:text-[#e4ff80]"><RotateCcw className="h-3.5 w-3.5" />Retry this file</button> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {Object.keys(queueErrors).length > 0 && !isCompressing ? <button type="button" onClick={clearFailures} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#e8bbae] hover:text-[#fff5ee]"><X className="h-3.5 w-3.5" />Clear failed items</button> : null}
    </section>
  );
}