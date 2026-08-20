import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpeg: FFmpeg | null = null;

export type VideoResolution = "1080p" | "720p" | "480p";
export type VideoAudioMode = "keep" | "reduced" | "mute";
export type VideoOutputFormat = "mp4" | "webm" | "mov" | "avi" | "ogv" | "gif";
export type VideoCodec = "h264" | "h265" | "av1" | "vp8" | "vp9" | "mpeg4" | "prores" | "dnxhd" | "mjpeg" | "theora";
export type VideoEncoderEngine = "software" | "nvenc" | "qsv" | "amf" | "videotoolbox" | "vaapi" | "mf";

export interface VideoExportSettings {
  maxBytes: number;
  resolution: VideoResolution;
  audio: VideoAudioMode;
  frameRate: 30 | 24 | 15;
  format: VideoOutputFormat;
  codec: VideoCodec;
  encoder: VideoEncoderEngine;
}

export interface VideoCompatibility {
  duration: number;
  width: number;
  height: number;
  warnings: string[];
}

const VIDEO_HEIGHTS: Record<VideoResolution, number> = {
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
};

const VIDEO_ENCODERS: Record<VideoCodec, { name: string; args: string[] }> = {
  h264: { name: "H.264", args: ["-c:v", "libx264", "-preset", "veryfast"] },
  h265: { name: "H.265/HEVC", args: ["-c:v", "libx265", "-preset", "ultrafast", "-tag:v", "hvc1"] },
  av1: { name: "AV1", args: ["-c:v", "libaom-av1", "-cpu-used", "8", "-row-mt", "1"] },
  vp8: { name: "VP8", args: ["-c:v", "libvpx", "-deadline", "good", "-cpu-used", "4"] },
  vp9: { name: "VP9", args: ["-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "4"] },
  mpeg4: { name: "MPEG-4 Part 2", args: ["-c:v", "mpeg4", "-q:v", "4"] },
  prores: { name: "ProRes", args: ["-c:v", "prores_ks", "-profile:v", "3"] },
  dnxhd: { name: "DNxHD", args: ["-c:v", "dnxhd", "-profile:v", "dnxhr_hq"] },
  mjpeg: { name: "MJPEG", args: ["-c:v", "mjpeg", "-q:v", "3"] },
  theora: { name: "Theora", args: ["-c:v", "libtheora", "-q:v", "7"] },
};

function getAudioArgs(format: VideoOutputFormat, audio: VideoAudioMode, audioBitrate: number): string[] {
  if (audio === "mute" || format === "gif") return ["-an"];

  const bitrate = `${Math.floor(audioBitrate / 1000)}k`;
  if (format === "webm") return ["-c:a", "libopus", "-b:a", bitrate];
  if (format === "ogv") return ["-c:a", "libvorbis", "-b:a", bitrate];
  if (format === "avi") return ["-c:a", "libmp3lame", "-b:a", bitrate];
  return ["-c:a", "aac", "-b:a", bitrate];
}

// The comma inside min() has to be escaped or FFmpeg reads it as a filter separator.
function getVideoFilter(settings: VideoExportSettings): string {
  const watermarked = `[0:v]fps=${settings.frameRate},scale=-2:min(${VIDEO_HEIGHTS[settings.resolution]}\\,ih)[scaled];[scaled][1:v]overlay=W-w-24:H-h-24`;
  if (settings.format !== "gif") return `${watermarked}[video]`;

  return `${watermarked}[overlaid];[overlaid]split[palettesource][frames];[palettesource]palettegen=stats_mode=diff[palette];[frames][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[video]`;
}

function getVideoMimeType(format: VideoOutputFormat): string {
  return {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    ogv: "video/ogg",
    gif: "image/gif",
  }[format];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "The local video encoder could not start. Reload the page and try again.";
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  const instance = new FFmpeg();

  try {
    await instance.load({
      coreURL,
      wasmURL,
    });
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }

  ffmpeg = instance;
  return instance;
}

export function cancelVideoEncoding(): void {
  ffmpeg?.terminate();
  ffmpeg = null;
}

function getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    function release() {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }

    video.onloadedmetadata = () => {
      const metadata = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      release();
      resolve(metadata);
    };
    video.onerror = () => {
      release();
      reject(new Error("Could not read this video's duration. The browser may not support this container format."));
    };
    video.preload = "metadata";
    video.src = url;
  });
}

async function readVideoFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new Error("The browser could not load this video into local memory. Try a smaller source file.", { cause: error });
  }
}

export async function inspectVideo(file: File): Promise<VideoCompatibility> {
  const metadata = await getVideoMetadata(file);
  const warnings: string[] = [];

  if (file.size > 1024 * 1024 * 1024) {
    warnings.push("Files over 1 GB may exceed browser memory during local encoding.");
  }

  if (metadata.width === 0 || metadata.height === 0) {
    warnings.push("The browser could not determine this video's dimensions.");
  }

  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) {
    warnings.push("The browser could not determine this video's duration, so it cannot be encoded to a size target.");
  }

  return { ...metadata, warnings };
}

async function createWatermark(): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create the video watermark.");
  }

  context.font = '600 24px "Space Grotesk", "Aptos", sans-serif';
  const padding = 18;
  canvas.width = Math.ceil(context.measureText("ImageFit").width + padding * 2);
  canvas.height = 56;
  context.font = '600 24px "Space Grotesk", "Aptos", sans-serif';
  context.fillStyle = "rgba(255, 255, 255, 0.38)";
  context.shadowColor = "rgba(0, 0, 0, 0.42)";
  context.shadowBlur = 4;
  context.fillText("ImageFit", padding, 36);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Could not create the video watermark."));
      }
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

export async function compressVideoToTarget(
  file: File,
  settings: VideoExportSettings,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const { duration } = await getVideoMetadata(file);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("This video does not have a usable duration.");
  }

  const encoder = await getFFmpeg();
  const inputMountPoint = `/input-${Date.now()}`;
  let inputName = `${inputMountPoint}/${file.name}`;
  const watermarkName = `watermark-${Date.now()}.png`;
  const outputName = `imagefit-discord-${Date.now()}.${settings.format}`;
  let inputMounted = false;
  let inputWritten = false;
  let inputDirectoryCreated = false;
  const usableBytes = Math.floor(settings.maxBytes * 0.96);
  const totalBitrate = Math.floor((usableBytes * 8) / duration);
  const audioBitrate = settings.audio === "keep" ? Math.min(96_000, Math.floor(totalBitrate * 0.2)) : settings.audio === "reduced" ? 48_000 : 0;
  const videoBitrate = Math.max(100_000, totalBitrate - audioBitrate);
  const filter = getVideoFilter(settings);
  const codec = VIDEO_ENCODERS[settings.codec];
  const encodingArgs = settings.format === "gif"
    ? ["-loop", "0"]
    : [
        ...codec.args,
        "-b:v", `${Math.floor(videoBitrate / 1000)}k`,
        "-maxrate", `${Math.floor(videoBitrate / 1000)}k`,
        "-bufsize", `${Math.floor((videoBitrate * 2) / 1000)}k`,
        ...getAudioArgs(settings.format, settings.audio, audioBitrate),
        ...(settings.format === "mp4" ? ["-movflags", "+faststart"] : []),
      ];

  const progressHandler = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
  const encoderLogs: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    encoderLogs.push(message);
    if (encoderLogs.length > 12) {
      encoderLogs.shift();
    }
  };
  encoder.on("progress", progressHandler);
  encoder.on("log", logHandler);

  try {
    await encoder.createDir(inputMountPoint);
    inputDirectoryCreated = true;
    const mounted = await encoder.mount(FFFSType.WORKERFS, { files: [file] }, inputMountPoint);
    if (mounted) {
      inputMounted = true;
    } else {
      inputName = `input-${Date.now()}.${file.name.split(".").pop() ?? "video"}`;
      await encoder.writeFile(inputName, await readVideoFile(file));
      inputWritten = true;
    }
    await encoder.writeFile(watermarkName, await createWatermark());
    const exitCode = await encoder.exec([
      "-i", inputName,
      "-i", watermarkName,
      "-filter_complex", filter,
      "-map", "[video]",
      ...(settings.format !== "gif" && settings.audio !== "mute" ? ["-map", "0:a?"] : []),
      ...encodingArgs,
      outputName,
    ]);

    if (exitCode !== 0) {
      const diagnostic = encoderLogs.findLast((message) => /unknown encoder|encoder .* not found|invalid encoder/i.test(message))
        ?? encoderLogs.findLast((message) => message.trim().length > 0);
      throw new Error(diagnostic ? `Could not encode with ${codec.name}: ${diagnostic}` : `Could not encode with ${codec.name}. Try H.264 or a smaller file.`);
    }

    const output = await encoder.readFile(outputName);
    if (typeof output === "string") {
      throw new Error("Video encoder returned an invalid output.");
    }

    const videoData = new Uint8Array(output.byteLength);
    videoData.set(output);
    const result = new Blob([videoData.buffer], { type: getVideoMimeType(settings.format) });
    if (result.size > settings.maxBytes) {
      throw new Error("This video could not be reduced to the selected file-size limit.");
    }

    return result;
  } finally {
    encoder.off("progress", progressHandler);
    encoder.off("log", logHandler);
    if (inputMounted) await encoder.unmount(inputMountPoint).catch(() => undefined);
    if (inputWritten) await encoder.deleteFile(inputName).catch(() => undefined);
    if (inputDirectoryCreated) await encoder.deleteDir(inputMountPoint).catch(() => undefined);
    await encoder.deleteFile(watermarkName).catch(() => undefined);
    await encoder.deleteFile(outputName).catch(() => undefined);
  }
}