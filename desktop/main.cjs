const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function getFfmpegPath() {
  if (app.isPackaged) {
    const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const bundledPath = path.join(process.resourcesPath, "ffmpeg", binaryName);
    if (fs.existsSync(bundledPath)) {
      fs.chmodSync(bundledPath, 0o755);
      return bundledPath;
    }
    return null;
  }

  return require("ffmpeg-static");
}

function parseTimestamp(value) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

const SOFTWARE_CODEC_ARGS = {
  h264: ["-c:v", "libx264", "-preset", "veryfast"],
  h265: ["-c:v", "libx265", "-preset", "ultrafast", "-tag:v", "hvc1"],
  av1: ["-c:v", "libaom-av1", "-cpu-used", "8", "-row-mt", "1"],
  vp8: ["-c:v", "libvpx", "-deadline", "good", "-cpu-used", "4"],
  vp9: ["-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "4"],
  mpeg4: ["-c:v", "mpeg4", "-q:v", "4"],
  prores: ["-c:v", "prores_ks", "-profile:v", "3"],
  dnxhd: ["-c:v", "dnxhd", "-profile:v", "dnxhr_hq"],
  mjpeg: ["-c:v", "mjpeg", "-q:v", "3"],
  theora: ["-c:v", "libtheora", "-q:v", "7"],
};

const HARDWARE_ENCODERS = {
  nvenc: { h264: "h264_nvenc", h265: "hevc_nvenc", av1: "av1_nvenc" },
  qsv: { h264: "h264_qsv", h265: "hevc_qsv", av1: "av1_qsv" },
  amf: { h264: "h264_amf", h265: "hevc_amf", av1: "av1_amf" },
  videotoolbox: { h264: "h264_videotoolbox", h265: "hevc_videotoolbox" },
};

function getCodecArgs(codec, engine) {
  if (engine === "software") {
    const args = SOFTWARE_CODEC_ARGS[codec];
    if (!args) throw new Error("Unsupported video codec.");
    return args;
  }

  const encoder = HARDWARE_ENCODERS[engine]?.[codec];
  if (!encoder) throw new Error("The selected hardware engine does not support this codec.");
  return ["-c:v", encoder, ...(engine === "nvenc" ? ["-preset", "p4"] : [])];
}

function getAudioArgs(format, audio, audioBitrate) {
  if (audio === "mute" || format === "gif") return ["-an"];

  const bitrate = `${Math.floor(audioBitrate / 1000)}k`;
  if (format === "webm") return ["-c:a", "libopus", "-b:a", bitrate];
  if (format === "ogv") return ["-c:a", "libvorbis", "-b:a", bitrate];
  if (format === "avi") return ["-c:a", "libmp3lame", "-b:a", bitrate];
  return ["-c:a", "aac", "-b:a", bitrate];
}

function getAvailableVideoEncoders() {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) return [];

  const result = spawnSync(ffmpegPath, ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true });
  const output = `${result.stdout}\n${result.stderr}`;
  return Object.values(HARDWARE_ENCODERS)
    .flatMap((encoders) => Object.values(encoders))
    .filter((encoder, index, encoders) => encoders.indexOf(encoder) === index && output.includes(encoder));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("desktop:video-encode", async (event, payload) => {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      throw new Error("Bundled FFmpeg was not found. Reinstall ImageFit Desktop.");
    }

    const outputDirectory = path.join(app.getPath("downloads"), "ImageFit");
    fs.mkdirSync(outputDirectory, { recursive: true });
    const extension = payload.format;
    const sourceName = path.basename(payload.inputPath, path.extname(payload.inputPath));
    const outputPath = path.join(outputDirectory, `${sourceName}-${payload.presetId}-${payload.codec}${payload.encoder === "software" ? "" : `-${payload.encoder}`}.${extension}`);
    const usableBytes = Math.floor(payload.maxBytes * 0.96);
    const totalBitrate = Math.floor((usableBytes * 8) / payload.duration);
    const audioBitrate = payload.audio === "keep" ? Math.min(96_000, Math.floor(totalBitrate * 0.2)) : payload.audio === "reduced" ? 48_000 : 0;
    const videoBitrate = Math.max(100_000, totalBitrate - audioBitrate);
    const filter = `fps=${payload.frameRate},scale=-2:min(${payload.height},ih)`;
    const encodingArgs = payload.format === "gif"
      ? ["-loop", "0"]
      : [
          ...getCodecArgs(payload.codec, payload.encoder),
          "-b:v", `${Math.floor(videoBitrate / 1000)}k`,
          "-maxrate", `${Math.floor(videoBitrate / 1000)}k`,
          "-bufsize", `${Math.floor((videoBitrate * 2) / 1000)}k`,
          ...getAudioArgs(payload.format, payload.audio, audioBitrate),
          ...(payload.format === "mp4" ? ["-movflags", "+faststart"] : []),
        ];
    const args = ["-y", "-i", payload.inputPath, "-vf", filter, ...encodingArgs, outputPath];

    await new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, args, { windowsHide: true });
      let diagnostic = "";
      process.stderr.on("data", (chunk) => {
        const message = chunk.toString();
        diagnostic = `${diagnostic}${message}`.slice(-6000);
        const match = /time=(\d{2}:\d{2}:\d{2}\.\d+)/.exec(message);
        if (match) event.sender.send("desktop:video-progress", { jobId: payload.jobId, progress: Math.min(1, parseTimestamp(match[1]) / payload.duration) });
      });
      process.on("error", (error) => reject(error));
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(diagnostic || `FFmpeg exited with code ${code}.`)));
    });

    const size = fs.statSync(outputPath).size;
    if (size > payload.maxBytes) throw new Error("This video could not be reduced to the selected file-size limit.");
    return { outputPath, size };
  });

  ipcMain.handle("desktop:available-video-encoders", () => getAvailableVideoEncoders());

  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});