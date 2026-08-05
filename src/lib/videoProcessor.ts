import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpeg: FFmpeg | null = null;

export type VideoResolution = "1080p" | "720p" | "480p";
export type VideoAudioMode = "keep" | "reduced" | "mute";
export type VideoOutputFormat = "mp4" | "gif";

export interface VideoExportSettings {
  maxBytes: number;
  resolution: VideoResolution;
  audio: VideoAudioMode;
  frameRate: 30 | 24 | 15;
  format: VideoOutputFormat;
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

function getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video's duration."));
    };
    video.src = url;
  });
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

  const encoder = await getFFmpeg();
  const inputName = `inspect-${Date.now()}.${file.name.split(".").pop() ?? "video"}`;
  const reportName = `inspect-${Date.now()}.json`;

  try {
    await encoder.writeFile(inputName, await fetchFile(file));
    const exitCode = await encoder.ffprobe([
      "-v", "error",
      "-show_entries", "stream=codec_name,codec_type,color_transfer,pix_fmt",
      "-of", "json",
      inputName,
      "-o", reportName,
    ]);

    if (exitCode !== 0) {
      warnings.push("The local encoder could not inspect this file's streams. Try an MP4 with H.264 video.");
      return { ...metadata, warnings };
    }

    const report = await encoder.readFile(reportName, "utf8");
    if (typeof report !== "string") {
      return { ...metadata, warnings };
    }

    const streams = JSON.parse(report).streams as Array<{ codec_name?: string; codec_type?: string; color_transfer?: string }>;
    const videoStream = streams.find((stream) => stream.codec_type === "video");
    const commonCodecs = ["h264", "hevc", "vp8", "vp9", "av1"];

    if (videoStream?.codec_name && !commonCodecs.includes(videoStream.codec_name)) {
      warnings.push(`Uncommon video codec detected: ${videoStream.codec_name}. Conversion may fail or take longer.`);
    }

    if (["smpte2084", "arib-std-b67"].includes(videoStream?.color_transfer ?? "")) {
      warnings.push("HDR video detected. The export may appear less vibrant because it is encoded for standard displays.");
    }

    if (!streams.some((stream) => stream.codec_type === "audio")) {
      warnings.push("This video has no audio stream.");
    }

    return { ...metadata, warnings };
  } catch {
    warnings.push("The local encoder could not inspect this file. Try an MP4 with H.264 video.");
    return { ...metadata, warnings };
  } finally {
    await encoder.deleteFile(inputName).catch(() => undefined);
    await encoder.deleteFile(reportName).catch(() => undefined);
  }
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
  const inputName = `input-${Date.now()}.${file.name.split(".").pop() ?? "video"}`;
  const watermarkName = `watermark-${Date.now()}.png`;
  const outputName = `imagefit-discord-${Date.now()}.${settings.format}`;
  const usableBytes = Math.floor(settings.maxBytes * 0.96);
  const totalBitrate = Math.floor((usableBytes * 8) / duration);
  const audioBitrate = settings.audio === "keep" ? Math.min(96_000, Math.floor(totalBitrate * 0.2)) : settings.audio === "reduced" ? 48_000 : 0;
  const videoBitrate = Math.max(100_000, totalBitrate - audioBitrate);
  const filter = `[0:v]fps=${settings.frameRate},scale=-2:min(${VIDEO_HEIGHTS[settings.resolution]}\\,ih)[scaled];[scaled][1:v]overlay=W-w-24:H-h-24[video]`;
  const encodingArgs = settings.format === "gif"
    ? ["-loop", "0"]
    : [
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-b:v", `${Math.floor(videoBitrate / 1000)}k`,
        "-maxrate", `${Math.floor(videoBitrate / 1000)}k`,
        "-bufsize", `${Math.floor((videoBitrate * 2) / 1000)}k`,
        ...(settings.audio === "mute" ? ["-an"] : ["-c:a", "aac", "-b:a", `${Math.floor(audioBitrate / 1000)}k`]),
        "-movflags", "+faststart",
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
    await encoder.writeFile(inputName, await fetchFile(file));
    await encoder.writeFile(watermarkName, await createWatermark());
    const exitCode = await encoder.exec([
      "-i", inputName,
      "-i", watermarkName,
      "-filter_complex", filter,
      "-map", "[video]",
      ...(settings.format === "mp4" && settings.audio !== "mute" ? ["-map", "0:a?"] : []),
      ...encodingArgs,
      outputName,
    ]);

    if (exitCode !== 0) {
      const diagnostic = encoderLogs.findLast((message) => message.trim().length > 0);
      throw new Error(diagnostic ? `Could not encode this video: ${diagnostic}` : "Could not encode this video. Try a smaller file or a different video format.");
    }

    const output = await encoder.readFile(outputName);
    if (typeof output === "string") {
      throw new Error("Video encoder returned an invalid output.");
    }

    const videoData = new Uint8Array(output.byteLength);
    videoData.set(output);
    const result = new Blob([videoData.buffer], { type: settings.format === "gif" ? "image/gif" : "video/mp4" });
    if (result.size > settings.maxBytes) {
      throw new Error("This video could not be reduced to the selected file-size limit.");
    }

    return result;
  } finally {
    encoder.off("progress", progressHandler);
    encoder.off("log", logHandler);
    await encoder.deleteFile(inputName).catch(() => undefined);
    await encoder.deleteFile(watermarkName).catch(() => undefined);
    await encoder.deleteFile(outputName).catch(() => undefined);
  }
}