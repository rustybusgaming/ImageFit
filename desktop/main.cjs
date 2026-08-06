const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { assertVideoPayload, getOutputFilename } = require("./video-config.cjs");

// Enable GPU rasterization and zero-copy for hardware-accelerated UI rendering
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

const MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"]);
let mainWindow = null;
let pendingOpenPaths = [];
let updateReady = false;

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function getOutputDirectory() {
  return readSettings().outputDirectory ?? path.join(app.getPath("downloads"), "ImageFit");
}

function isMediaPath(filePath) {
  return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function sendOpenPaths(paths) {
  const mediaPaths = paths.filter(isMediaPath);
  if (mediaPaths.length === 0) return;

  if (mainWindow?.webContents) {
    mainWindow.webContents.send("desktop:open-paths", mediaPaths);
  } else {
    pendingOpenPaths.push(...mediaPaths);
  }
}

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
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    if (pendingOpenPaths.length > 0) {
      sendOpenPaths(pendingOpenPaths);
      pendingOpenPaths = [];
    }
  });
}

app.whenReady().then(() => {
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    sendOpenPaths([filePath]);
  });

  ipcMain.handle("desktop:video-encode", async (event, payload) => {
    assertVideoPayload(payload);
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      throw new Error("Bundled FFmpeg was not found. Reinstall ImageFit Desktop.");
    }

    const outputDirectory = getOutputDirectory();
    fs.mkdirSync(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, getOutputFilename(payload.inputPath, payload));
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
  ipcMain.handle("desktop:get-output-directory", () => getOutputDirectory());
  ipcMain.handle("desktop:choose-output-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose ImageFit output folder",
      defaultPath: getOutputDirectory(),
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return getOutputDirectory();

    const settings = readSettings();
    settings.outputDirectory = result.filePaths[0];
    writeSettings(settings);
    return settings.outputDirectory;
  });
  ipcMain.handle("desktop:save-file", async (_event, { filename, bytes }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save ImageFit export",
      defaultPath: path.join(getOutputDirectory(), path.basename(filename)),
    });
    if (result.canceled || !result.filePath) return null;

    fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
    fs.writeFileSync(result.filePath, Buffer.from(bytes));
    return result.filePath;
  });
  ipcMain.handle("desktop:open-media-dialog", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Open image or video",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Media", extensions: [...MEDIA_EXTENSIONS].map((extension) => extension.slice(1)) }],
    });
    return result.canceled ? [] : readMediaFiles(result.filePaths);
  });
  ipcMain.handle("desktop:read-media-files", (_event, filePaths) => readMediaFiles(filePaths));
  ipcMain.handle("desktop:install-update", () => {
    if (!app.isPackaged || !updateReady) return false;
    autoUpdater.quitAndInstall();
    return true;
  });
  ipcMain.handle("desktop:check-for-updates", () => {
    if (!app.isPackaged) {
      mainWindow?.webContents.send("desktop:update-status", { state: "unavailable" });
      return false;
    }
    void autoUpdater.checkForUpdatesAndNotify();
    return true;
  });

  createWindow();
  if (app.isPackaged) {
    autoUpdater.on("checking-for-update", () => mainWindow?.webContents.send("desktop:update-status", { state: "checking" }));
    autoUpdater.on("update-available", (info) => mainWindow?.webContents.send("desktop:update-status", { state: "downloading", version: info.version }));
    autoUpdater.on("update-downloaded", (info) => {
      updateReady = true;
      mainWindow?.webContents.send("desktop:update-status", { state: "ready", version: info.version });
    });
    autoUpdater.on("error", () => mainWindow?.webContents.send("desktop:update-status", { state: "unavailable" }));
    void autoUpdater.checkForUpdatesAndNotify();
  }
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

function readMediaFiles(filePaths) {
  return filePaths.filter(isMediaPath).map((filePath) => ({
    name: path.basename(filePath),
    path: filePath,
    bytes: fs.readFileSync(filePath),
  }));
}

if (process.platform === "win32") {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on("second-instance", (_event, commandLine) => {
      const paths = commandLine.filter(isMediaPath);
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      sendOpenPaths(paths);
    });
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});