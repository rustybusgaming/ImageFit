const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function getFfmpegPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
    : require("ffmpeg-static");
}

function parseTimestamp(value) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function getCodecArgs(codec, useNvenc) {
  const encoder = useNvenc
    ? { h264: "h264_nvenc", h265: "hevc_nvenc", av1: "av1_nvenc" }[codec]
    : { h264: "libx264", h265: "libx265", av1: "libaom-av1" }[codec];

  if (!encoder) throw new Error("Unsupported video codec.");

  return useNvenc
    ? ["-c:v", encoder, "-preset", "p4"]
    : codec === "h264"
      ? ["-c:v", encoder, "-preset", "veryfast"]
      : codec === "h265"
        ? ["-c:v", encoder, "-preset", "ultrafast", "-tag:v", "hvc1"]
        : ["-c:v", encoder, "-cpu-used", "8", "-row-mt", "1"];
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
    const extension = payload.format === "gif" ? "gif" : "mp4";
    const sourceName = path.basename(payload.inputPath, path.extname(payload.inputPath));
    const outputPath = path.join(outputDirectory, `${sourceName}-${payload.presetId}-${payload.codec}${payload.useNvenc ? "-nvenc" : ""}.${extension}`);
    const usableBytes = Math.floor(payload.maxBytes * 0.96);
    const totalBitrate = Math.floor((usableBytes * 8) / payload.duration);
    const audioBitrate = payload.audio === "keep" ? Math.min(96_000, Math.floor(totalBitrate * 0.2)) : payload.audio === "reduced" ? 48_000 : 0;
    const videoBitrate = Math.max(100_000, totalBitrate - audioBitrate);
    const filter = `fps=${payload.frameRate},scale=-2:min(${payload.height},ih)`;
    const encodingArgs = payload.format === "gif"
      ? ["-loop", "0"]
      : [
          ...getCodecArgs(payload.codec, payload.useNvenc),
          "-b:v", `${Math.floor(videoBitrate / 1000)}k`,
          "-maxrate", `${Math.floor(videoBitrate / 1000)}k`,
          "-bufsize", `${Math.floor((videoBitrate * 2) / 1000)}k`,
          ...(payload.audio === "mute" ? ["-an"] : ["-c:a", "aac", "-b:a", `${Math.floor(audioBitrate / 1000)}k`]),
          "-movflags", "+faststart",
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

  ipcMain.handle("desktop:nvenc-supported", () => {
    const result = spawnSync(getFfmpegPath(), ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true });
    return /h264_nvenc|hevc_nvenc|av1_nvenc/.test(`${result.stdout}\n${result.stderr}`);
  });

  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});