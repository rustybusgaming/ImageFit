import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileVideo, Loader2, RotateCcw, Shrink, Square, X } from "lucide-react";
import { downloadBlob } from "../lib/download";
import { downloadZip } from "../lib/zip";
import { cancelVideoEncoding, compressVideoToTarget, inspectVideo } from "../lib/videoProcessor";
import type { VideoAudioMode, VideoCodec, VideoCompatibility, VideoEncoderEngine, VideoOutputFormat, VideoResolution } from "../lib/videoProcessor";
import { cancelDesktopVideoEncoding, compressDesktopVideoToTarget, getAvailableVideoEncoders, isDesktopApp } from "../lib/desktopVideoProcessor";

interface Props {
  sourceFiles: File[];
}

interface QueueEntry {
  key: string;
  file: File;
}

const DISCORD_PRESETS = [
  { id: "discord-5mb", label: "5 MB", maxBytes: 5 * 1024 * 1024 },
  { id: "discord-10mb", label: "10 MB", maxBytes: 10 * 1024 * 1024 },
  { id: "discord-20mb", label: "20 MB", maxBytes: 20 * 1024 * 1024 },
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

const FORMAT_PRESETS: Array<{ id: VideoOutputFormat; label: string }> = [
  { id: "mp4", label: "MP4" },
  { id: "webm", label: "WebM" },
  { id: "mov", label: "MOV" },
  { id: "avi", label: "AVI" },
  { id: "ogv", label: "OGV" },
  { id: "gif", label: "GIF" },
];

const CODEC_PRESETS: Array<{ id: VideoCodec; format: Exclude<VideoOutputFormat, "gif">; label: string; description: string }> = [
  { id: "h264", format: "mp4", label: "H.264", description: "Best compatibility" },
  { id: "h265", format: "mp4", label: "H.265/HEVC", description: "Smaller, newer devices" },
  { id: "av1", format: "mp4", label: "AV1", description: "Smallest, slowest" },
  { id: "vp8", format: "webm", label: "VP8", description: "Legacy WebM" },
  { id: "vp9", format: "webm", label: "VP9", description: "Efficient WebM" },
  { id: "mpeg4", format: "mp4", label: "MPEG-4", description: "Legacy MP4" },
  { id: "prores", format: "mov", label: "ProRes", description: "Editing quality" },
  { id: "dnxhd", format: "mov", label: "DNxHD", description: "Editing quality" },
  { id: "mjpeg", format: "avi", label: "MJPEG", description: "Frame-based video" },
  { id: "theora", format: "ogv", label: "Theora", description: "Open OGV" },
];

const ENCODER_PRESETS: Array<{ id: VideoEncoderEngine; label: string; description: string }> = [
  { id: "software", label: "Software FFmpeg", description: "Works on every desktop" },
  { id: "nvenc", label: "NVIDIA NVENC", description: "NVIDIA GPU" },
  { id: "qsv", label: "Intel Quick Sync", description: "Intel GPU" },
  { id: "amf", label: "AMD AMF", description: "AMD GPU" },
  { id: "videotoolbox", label: "Apple VideoToolbox", description: "Apple hardware" },
  { id: "vaapi", label: "Linux VAAPI", description: "Intel or AMD on Linux" },
  { id: "mf", label: "Media Foundation", description: "Any GPU on Windows" },
];

const HARDWARE_ENCODERS: Record<Exclude<VideoEncoderEngine, "software">, Partial<Record<VideoCodec, string>>> = {
  nvenc: { h264: "h264_nvenc", h265: "hevc_nvenc", av1: "av1_nvenc" },
  qsv: { h264: "h264_qsv", h265: "hevc_qsv", av1: "av1_qsv" },
  amf: { h264: "h264_amf", h265: "hevc_amf", av1: "av1_amf" },
  videotoolbox: { h264: "h264_videotoolbox", h265: "hevc_videotoolbox" },
  vaapi: { h264: "h264_vaapi", h265: "hevc_vaapi", av1: "av1_vaapi" },
  mf: { h264: "h264_mf", h265: "hevc_mf" },
};

// Mirrors ENGINE_PREFERENCE / pickFastestEngine in desktop/video-config.cjs, which is the
// tested copy: vendor engines first, OS-level engines next, software last.
const ENGINE_PREFERENCE: VideoEncoderEngine[] = ["nvenc", "qsv", "amf", "videotoolbox", "vaapi", "mf", "software"];

function pickFastestEngine(codec: VideoCodec, availableEncoders: string[]): VideoEncoderEngine {
  for (const engine of ENGINE_PREFERENCE) {
    if (engine === "software") break;

    const encoder = HARDWARE_ENCODERS[engine as Exclude<VideoEncoderEngine, "software">][codec];
    if (encoder && availableEncoders.includes(encoder)) return engine;
  }

  return "software";
}

type QueueStatus = "waiting" | "encoding" | "ready" | "failed" | "cancelled";

function getOutputFilename(file: File, presetId: string, format: VideoOutputFormat, codec: VideoCodec): string {
  const sourceName = file.name.replace(/\.[^.]+$/, "") || "video";
  return `${sourceName}-${presetId}-${codec}.${format}`;
}

function getParentDirectory(outputPath: string): string {
  const separatorIndex = Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\"));
  return separatorIndex > 0 ? outputPath.slice(0, separatorIndex) : "the ImageFit output folder";
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
  const [codec, setCodec] = useState<VideoCodec>("h264");
  // null means "let ImageFit pick"; a value is an explicit choice from the engine picker.
  const [engineChoice, setEngineChoice] = useState<VideoEncoderEngine | null>(null);
  const [availableEncoders, setAvailableEncoders] = useState<string[]>([]);
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
  const isDesktop = isDesktopApp();
  const encoder: VideoEncoderEngine = engineChoice ?? (isDesktop ? pickFastestEngine(codec, availableEncoders) : "software");
  // Two dropped files can share a name, so the queue is tracked by position rather than by filename.
  const queue = useMemo<QueueEntry[]>(() => sourceFiles.map((file, index) => ({ key: `${index}-${file.name}`, file })), [sourceFiles]);

  useEffect(() => {
    if (!isDesktop) return;

    void getAvailableVideoEncoders().then(setAvailableEncoders).catch(() => setAvailableEncoders([]));
  }, [isDesktop]);


  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;

      setIsInspecting(true);
      setCompatibility(null);
      setQueueStatus(Object.fromEntries(queue.map((entry) => [entry.key, "waiting"])));
      setQueueProgress(Object.fromEntries(queue.map((entry) => [entry.key, 0])));
      setQueueErrors({});

      if (queue.length === 0) {
        setIsInspecting(false);
        return;
      }

      try {
        const nextCompatibility = await inspectVideo(queue[0].file);
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
  }, [queue]);

  async function squishVideos(entriesToEncode = queue) {
    setIsCompressing(true);
    setProgress(0);
    setResult(null);
    setError(null);
    cancellationRef.current = false;
    const files: Array<{ blob: Blob; filename: string }> = [];
    const nativeOutputs: string[] = [];

    try {
      for (const { key, file: sourceFile } of entriesToEncode) {
        if (cancellationRef.current) break;

        setQueueStatus((current) => ({ ...current, [key]: "encoding" }));
        setQueueProgress((current) => ({ ...current, [key]: 0 }));
        setQueueErrors((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        try {
          const settings = { maxBytes: selectedPreset.maxBytes, resolution, audio, frameRate, format, codec, encoder };
          if (isDesktop) {
            const output = await compressDesktopVideoToTarget(sourceFile, settings, selectedPreset.id, (nextProgress) => {
              setProgress(nextProgress);
              setQueueProgress((current) => ({ ...current, [key]: nextProgress }));
            });
            nativeOutputs.push(output.outputPath);
          } else {
            const output = await compressVideoToTarget(sourceFile, settings, (nextProgress) => {
                setProgress(nextProgress);
                setQueueProgress((current) => ({ ...current, [key]: nextProgress }));
            });
            files.push({ blob: output, filename: getOutputFilename(sourceFile, selectedPreset.id, format, codec) });
          }
          if (cancellationRef.current) break;
          setQueueStatus((current) => ({ ...current, [key]: "ready" }));
          setQueueProgress((current) => ({ ...current, [key]: 1 }));
        } catch (compressionError) {
          if (cancellationRef.current) break;

          const message = getCompressionErrorMessage(compressionError);
          setQueueStatus((current) => ({ ...current, [key]: "failed" }));
          setQueueErrors((current) => ({ ...current, [key]: message }));
        }
      }

      if (cancellationRef.current) {
        setQueueStatus((current) => Object.fromEntries(Object.entries(current).map(([key, status]) => [key, status === "encoding" || status === "waiting" ? "cancelled" : status])));
        setResult("Encoding cancelled. Ready files remain available from completed runs.");
      } else if (isDesktop && nativeOutputs.length > 0) {
        setResult(`${nativeOutputs.length} file${nativeOutputs.length === 1 ? "" : "s"} saved to ${getParentDirectory(nativeOutputs[0])}.`);
      } else if (files.length === 1) {
        await downloadBlob(files[0].blob, files[0].filename);
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
    if (isDesktop) {
      cancelDesktopVideoEncoding();
    } else {
      cancelVideoEncoding();
    }
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
          <p className="font-medium text-[#fff5ee]">Source: {compatibility.width}×{compatibility.height}{Number.isFinite(compatibility.duration) ? ` · ${Math.round(compatibility.duration)} sec` : ""}</p>
          {compatibility.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs leading-4">
              {compatibility.warnings.map((warning) => <li key={warning} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff9a7b]" />{warning}</li>)}
            </ul>
          ) : <p className="mt-1 text-xs text-[#d7ff47]">Compatibility check passed.</p>}
        </div>
      ) : isInspecting ? <p className="mt-4 text-sm text-[#e8bbae]">Checking source compatibility...</p> : null}

      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Upload size limit">
        {DISCORD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPresetId(preset.id)}
            aria-pressed={preset.id === presetId}
            className={`border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
              preset.id === presetId ? "border-[#ff7448] bg-[#2b1913] shadow-[3px_3px_0_#ff7448]" : "border-[#ff7448]/20 bg-[#211814] hover:border-[#ff7448]/60"
            }`}
          >
            <span className="block text-sm font-semibold text-[#fff5ee]">{preset.label}</span>
            <span className="mt-1 block text-xs leading-4 text-[#e8bbae]">Upload limit</span>
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
          <div className="mt-2 grid grid-cols-3 gap-2">
            {FORMAT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setFormat(preset.id);
                  if (preset.id === "gif") {
                    setAudio("mute");
                  } else {
                    setCodec(CODEC_PRESETS.find((codecPreset) => codecPreset.format === preset.id)?.id ?? "h264");
                    setEngineChoice(null);
                  }
                }}
                className={`border px-2 py-2 text-xs font-semibold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                  preset.id === format ? "border-[#ff7448] bg-[#2b1913] text-[#fff5ee]" : "border-[#ff7448]/20 bg-[#211814] text-[#e8bbae] hover:border-[#ff7448]/60"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {format !== "gif" ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-[#fff5ee]">Video codec</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CODEC_PRESETS.filter((preset) => preset.format === format).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setCodec(preset.id);
                  setEngineChoice(null);
                }}
                className={`border px-2 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                  preset.id === codec ? "border-[#ff7448] bg-[#2b1913] text-[#fff5ee]" : "border-[#ff7448]/20 bg-[#211814] text-[#e8bbae] hover:border-[#ff7448]/60"
                }`}
              >
                <span className="block text-sm font-semibold">{preset.label}</span>
                <span className="mt-1 block text-xs leading-4">{preset.description}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#aeb2a5]">Hardware engines are available only in ImageFit Desktop. Browser encoding uses software FFmpeg.</p>
        </div>
      ) : null}

      {isDesktop && format !== "gif" ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-[#fff5ee]">Encoding engine</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ENCODER_PRESETS.map((preset) => {
              const requiredEncoder = preset.id === "software" ? undefined : HARDWARE_ENCODERS[preset.id][codec];
              const supported = preset.id === "software" || Boolean(requiredEncoder && availableEncoders.includes(requiredEncoder));
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!supported}
                  onClick={() => setEngineChoice(preset.id)}
                  className={`border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] ${
                    encoder === preset.id ? "border-[#ff7448] bg-[#2b1913] text-[#fff5ee]" : "border-[#ff7448]/20 bg-[#211814] text-[#e8bbae] hover:border-[#ff7448]/60"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className="block">{preset.label}</span>
                  <span className="mt-1 block font-normal text-[#aeb2a5]">{preset.description}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#aeb2a5]">Unavailable engines do not support the selected codec or are not exposed by this computer's FFmpeg and graphics driver.</p>
        </div>
      ) : null}

      <button
        type="button"
        aria-disabled={isCompressing || isInspecting}
        onClick={(e) => {
          if (isCompressing || isInspecting) {
            e.preventDefault();
            return;
          }
          void squishVideos();
        }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#ff7448] px-5 py-3 text-sm font-bold text-[#21100b] transition hover:bg-[#ff9a7b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512] aria-disabled:cursor-not-allowed aria-disabled:bg-[#6d392d] aria-disabled:text-[#e8bbae]"
      >
        {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Shrink className="h-4 w-4" aria-hidden="true" />}
        {isCompressing ? `Encoding ${Math.round(progress * 100)}%` : `Make ${sourceFiles.length} ${resolution} ${format.toUpperCase()} file${sourceFiles.length === 1 ? "" : "s"}`}
        {!isCompressing && <Download className="h-4 w-4" aria-hidden="true" />}
      </button>

      {isCompressing ? (
        <button
          type="button"
          onClick={cancelEncoding}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-[#ff7448]/60 bg-[#211814] px-5 py-2.5 text-sm font-semibold text-[#ffb39d] transition hover:border-[#ff9a7b] hover:text-[#fff5ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7448] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1512]"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
          Cancel encoding
        </button>
      ) : null}

      {result ? <p className="mt-3 text-sm font-medium text-[#d7ff47]">{result}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#ffb39d]">{error}</p> : null}
      {queue.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-[#ff7448]/20 pt-3 text-xs text-[#e8bbae]">
          {queue.map((entry) => {
            const status = queueStatus[entry.key] ?? "waiting";
            const fileProgress = queueProgress[entry.key] ?? 0;

            return (
              <li key={entry.key} className="border border-[#ff7448]/20 bg-[#211814] p-2">
                <div className="flex items-center justify-between gap-3"><span className="truncate">{entry.file.name}</span><span className="shrink-0 uppercase">{status === "encoding" ? `${Math.round(fileProgress * 100)}%` : status}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden bg-[#3b251d]"><div className="h-full bg-[#ff7448] transition-[width]" style={{ width: `${fileProgress * 100}%` }} /></div>
                {queueErrors[entry.key] ? <p className="mt-2 text-[#ffb39d]">{queueErrors[entry.key]}</p> : null}
                {status === "failed" && !isCompressing ? <button type="button" onClick={() => void squishVideos([entry])} className="mt-2 inline-flex items-center gap-1 font-semibold text-[#d7ff47] hover:text-[#e4ff80]"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Retry this file</button> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {Object.keys(queueErrors).length > 0 && !isCompressing ? <button type="button" onClick={clearFailures} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#e8bbae] hover:text-[#fff5ee]"><X className="h-3.5 w-3.5" aria-hidden="true" />Clear failed items</button> : null}
    </section>
  );
}