import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpeg: FFmpeg | null = null;

export type VideoResolution = "1080p" | "720p" | "480p";

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

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video's duration."));
    };
    video.src = url;
  });
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
  maxBytes: number,
  resolution: VideoResolution,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const duration = await getVideoDuration(file);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("This video does not have a usable duration.");
  }

  const encoder = await getFFmpeg();
  const inputName = `input-${Date.now()}.${file.name.split(".").pop() ?? "video"}`;
  const watermarkName = `watermark-${Date.now()}.png`;
  const outputName = `imagefit-discord-${Date.now()}.mp4`;
  const usableBytes = Math.floor(maxBytes * 0.96);
  const totalBitrate = Math.floor((usableBytes * 8) / duration);
  const audioBitrate = Math.min(96_000, Math.floor(totalBitrate * 0.2));
  const videoBitrate = Math.max(100_000, totalBitrate - audioBitrate);

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
      "-filter_complex", `[0:v]scale=-2:min(${VIDEO_HEIGHTS[resolution]}\\,ih)[scaled];[scaled][1:v]overlay=W-w-24:H-h-24[video]`,
      "-map", "[video]",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", `${Math.floor(videoBitrate / 1000)}k`,
      "-maxrate", `${Math.floor(videoBitrate / 1000)}k`,
      "-bufsize", `${Math.floor((videoBitrate * 2) / 1000)}k`,
      "-c:a", "aac",
      "-b:a", `${Math.floor(audioBitrate / 1000)}k`,
      "-movflags", "+faststart",
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
    const result = new Blob([videoData.buffer], { type: "video/mp4" });
    if (result.size > maxBytes) {
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