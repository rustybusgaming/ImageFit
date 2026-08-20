const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const {
  ENGINE_REQUIREMENTS,
  MAX_SIZE_ATTEMPTS,
  assertVideoPayload,
  getOutputFilename,
  getVaapiDevice,
  isEngineSupportedHere,
  planVideoBitrate,
  retargetVideoBitrate,
} = require("./video-config.cjs");

const GITHUB_REPO = "rustybusgaming/ImageFit";
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

// Enable GPU rasterization and zero-copy for hardware-accelerated UI rendering
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

const MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"]);
let mainWindow = null;
let pendingOpenPaths = [];
let updateReady = false;
const activeEncodingJobs = new Map();

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

function isNewerVersion(latest, current) {
  const latestParts = latest.split(".").map(Number);
  const currentParts = current.split(".").map(Number);
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i += 1) {
    const latestPart = latestParts[i] ?? 0;
    const currentPart = currentParts[i] ?? 0;
    if (latestPart !== currentPart) return latestPart > currentPart;
  }
  return false;
}

function fetchLatestGithubRelease() {
  return new Promise((resolve, reject) => {
    const request = https.get(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { "User-Agent": "ImageFit", Accept: "application/vnd.github+json" } },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`GitHub API returned status ${response.statusCode}.`));
          return;
        }

        let body = "";
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => {
          try {
            const release = JSON.parse(body);
            resolve(typeof release.tag_name === "string" ? release.tag_name.replace(/^v/, "") : null);
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    request.setTimeout(10_000, () => request.destroy(new Error("GitHub update check timed out.")));
  });
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
  vaapi: { h264: "h264_vaapi", h265: "hevc_vaapi", av1: "av1_vaapi" },
  mf: { h264: "h264_mf", h265: "hevc_mf" },
};

function getCodecArgs(codec, engine) {
  if (engine === "software") {
    const args = SOFTWARE_CODEC_ARGS[codec];
    if (!args) throw new Error("Unsupported video codec.");
    return args;
  }

  if (!isEngineSupportedHere(engine)) {
    throw new Error(ENGINE_REQUIREMENTS[engine].message);
  }

  const encoder = HARDWARE_ENCODERS[engine]?.[codec];
  if (!encoder) throw new Error("The selected hardware engine does not support this codec.");
  return ["-c:v", encoder, ...(engine === "nvenc" ? ["-preset", "p4"] : [])];
}

// The comma inside min() has to be escaped or FFmpeg reads it as a filter separator.
function getVideoFilter(frameRate, height, format, engine) {
  const scale = `fps=${frameRate},scale=-2:min(${height}\\,ih)`;

  if (format === "gif") {
    return `${scale},split[palettesource][frames];[palettesource]palettegen=stats_mode=diff[palette];[frames][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  }

  // VAAPI encoders read GPU surfaces, so scaled frames are converted and uploaded to the device.
  if (engine === "vaapi") return `${scale},format=nv12,hwupload`;

  return scale;
}

function removeFile(filePath) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // A leftover partial file is not worth failing the encode over.
  }
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
  return Object.entries(HARDWARE_ENCODERS)
    .filter(([engine]) => isEngineSupportedHere(engine))
    .flatMap(([, encoders]) => Object.values(encoders))
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
  mainWindow.on("closed", () => {
    mainWindow = null;
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
    const plan = planVideoBitrate(payload.maxBytes, payload.duration, payload.audio);

    if (!plan.isReachable && payload.format !== "gif") {
      throw new Error(
        `A ${Math.round(payload.duration)}-second video cannot fit ${Math.round(payload.maxBytes / (1024 * 1024))} MB. ` +
        "Trim the clip, lower the frame rate, or pick a larger size limit."
      );
    }

    const filter = getVideoFilter(payload.frameRate, payload.height, payload.format, payload.encoder);
    const vaapiDevice = payload.encoder === "vaapi" && payload.format !== "gif" ? getVaapiDevice() : null;

    function buildArgs(videoBitrate) {
      const encodingArgs = payload.format === "gif"
        ? ["-loop", "0"]
        : [
            ...getCodecArgs(payload.codec, payload.encoder),
            "-b:v", `${Math.floor(videoBitrate / 1000)}k`,
            "-maxrate", `${Math.floor(videoBitrate / 1000)}k`,
            "-bufsize", `${Math.floor((videoBitrate * 2) / 1000)}k`,
            ...getAudioArgs(payload.format, payload.audio, plan.audioBitrate),
            ...(payload.format === "mp4" ? ["-movflags", "+faststart"] : []),
          ];

      return [
        "-y",
        // Decode on the GPU where a supported device exists. FFmpeg silently falls back to
        // software when it cannot initialise, and outputs software frames either way, so the
        // filter chain below is unaffected.
        ...(vaapiDevice ? ["-vaapi_device", vaapiDevice] : ["-hwaccel", "auto"]),
        "-i", payload.inputPath,
        "-vf", filter,
        ...encodingArgs,
        outputPath,
      ];
    }

    function runFfmpeg(args) {
      return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpegPath, args, { windowsHide: true });
        activeEncodingJobs.set(payload.jobId, ffmpegProcess);
        let diagnostic = "";
        ffmpegProcess.stderr.on("data", (chunk) => {
          const message = chunk.toString();
          diagnostic = `${diagnostic}${message}`.slice(-6000);
          const match = /time=(\d{2}:\d{2}:\d{2}\.\d+)/.exec(message);
          if (match && !event.sender.isDestroyed()) {
            event.sender.send("desktop:video-progress", { jobId: payload.jobId, progress: Math.min(1, parseTimestamp(match[1]) / payload.duration) });
          }
        });
        ffmpegProcess.on("error", (error) => reject(error));
        ffmpegProcess.on("close", (code, signal) => {
          if (signal || ffmpegProcess.killed) {
            reject(new Error("Encoding cancelled."));
          } else if (code === 0) {
            resolve();
          } else {
            reject(new Error(diagnostic || `FFmpeg exited with code ${code}.`));
          }
        });
      });
    }

    // The encoder only approximates the requested bitrate, so an overshoot is retried at a
    // bitrate corrected from the size actually produced rather than being thrown away.
    let videoBitrate = plan.videoBitrate;

    for (let attempt = 0; attempt < MAX_SIZE_ATTEMPTS; attempt += 1) {
      try {
        await runFfmpeg(buildArgs(videoBitrate));
      } catch (error) {
        removeFile(outputPath);
        throw error;
      } finally {
        activeEncodingJobs.delete(payload.jobId);
      }

      const size = fs.statSync(outputPath).size;
      if (size <= payload.maxBytes) return { outputPath, size };

      const nextBitrate = payload.format === "gif" ? null : retargetVideoBitrate(videoBitrate, size, payload.maxBytes);
      if (nextBitrate === null) break;
      videoBitrate = nextBitrate;
    }

    removeFile(outputPath);
    throw new Error("This video could not be reduced to the selected file-size limit.");
  });

  ipcMain.handle("desktop:video-cancel", (_event, jobIds) => {
    const targets = Array.isArray(jobIds) && jobIds.length > 0 ? jobIds : [...activeEncodingJobs.keys()];
    for (const jobId of targets) {
      activeEncodingJobs.get(jobId)?.kill();
    }
    return true;
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
  ipcMain.handle("desktop:check-for-updates", async () => {
    mainWindow?.webContents.send("desktop:update-status", { state: "checking" });

    try {
      const latestVersion = await fetchLatestGithubRelease();
      if (latestVersion && isNewerVersion(latestVersion, app.getVersion())) {
        mainWindow?.webContents.send("desktop:update-status", { state: "available", version: latestVersion });
      } else {
        mainWindow?.webContents.send("desktop:update-status", { state: "unavailable" });
      }
    } catch {
      mainWindow?.webContents.send("desktop:update-status", { state: "unavailable" });
    }

    if (app.isPackaged) void autoUpdater.checkForUpdatesAndNotify();
    return true;
  });
  ipcMain.handle("desktop:open-release-page", () => {
    void shell.openExternal(GITHUB_RELEASES_URL);
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