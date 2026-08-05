import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  const instance = new FFmpeg();
  const baseUrl = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

  await instance.load({
    coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, "application/wasm"),
  });

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

export async function compressVideoToTarget(
  file: File,
  maxBytes: number,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const duration = await getVideoDuration(file);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("This video does not have a usable duration.");
  }

  const encoder = await getFFmpeg();
  const inputName = `input-${Date.now()}.${file.name.split(".").pop() ?? "video"}`;
  const outputName = `imagefit-discord-${Date.now()}.mp4`;
  const usableBytes = Math.floor(maxBytes * 0.96);
  const totalBitrate = Math.floor((usableBytes * 8) / duration);
  const audioBitrate = Math.min(96_000, Math.floor(totalBitrate * 0.2));
  const videoBitrate = Math.max(100_000, totalBitrate - audioBitrate);

  const progressHandler = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
  encoder.on("progress", progressHandler);

  try {
    await encoder.writeFile(inputName, await fetchFile(file));
    await encoder.exec([
      "-i", inputName,
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
    await encoder.deleteFile(inputName).catch(() => undefined);
    await encoder.deleteFile(outputName).catch(() => undefined);
  }
}