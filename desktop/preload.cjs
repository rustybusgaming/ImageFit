const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Sandboxed preload scripts cannot require Node built-ins like node:crypto; use the Web Crypto API instead.
const randomUUID = () => crypto.randomUUID();

const progressCallbacks = new Map();
const openFileCallbacks = new Set();
const updateCallbacks = new Set();

ipcRenderer.on("desktop:video-progress", (_event, { jobId, progress }) => {
  progressCallbacks.get(jobId)?.(progress);
});

// Paths can arrive before React has subscribed (a file that launched the app, or one opened
// while the window is still loading), so they are held until the first subscriber appears.
let pendingOpenPaths = [];

ipcRenderer.on("desktop:open-paths", (_event, paths) => {
  if (openFileCallbacks.size === 0) {
    pendingOpenPaths.push(...paths);
    return;
  }
  for (const callback of openFileCallbacks) callback(paths);
});

ipcRenderer.on("desktop:update-status", (_event, status) => {
  for (const callback of updateCallbacks) callback(status);
});

contextBridge.exposeInMainWorld("imageFitDesktop", {
  getFilePath: (file) => webUtils.getPathForFile(file),
  availableVideoEncoders: () => ipcRenderer.invoke("desktop:available-video-encoders"),
  getOutputDirectory: () => ipcRenderer.invoke("desktop:get-output-directory"),
  chooseOutputDirectory: () => ipcRenderer.invoke("desktop:choose-output-directory"),
  saveFile: (filename, bytes) => ipcRenderer.invoke("desktop:save-file", { filename, bytes }),
  openMediaDialog: () => ipcRenderer.invoke("desktop:open-media-dialog"),
  readMediaFiles: (paths) => ipcRenderer.invoke("desktop:read-media-files", paths),
  onOpenPaths: (callback) => {
    openFileCallbacks.add(callback);
    if (pendingOpenPaths.length > 0) {
      const paths = pendingOpenPaths;
      pendingOpenPaths = [];
      callback(paths);
    }
    return () => openFileCallbacks.delete(callback);
  },
  onUpdateStatus: (callback) => {
    updateCallbacks.add(callback);
    return () => updateCallbacks.delete(callback);
  },
  installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  openReleasePage: () => ipcRenderer.invoke("desktop:open-release-page"),
  encodeVideo: (payload, onProgress) => {
    const jobId = randomUUID();
    progressCallbacks.set(jobId, onProgress);
    return ipcRenderer.invoke("desktop:video-encode", { ...payload, jobId })
      .finally(() => progressCallbacks.delete(jobId));
  },
  cancelVideoEncode: () => ipcRenderer.invoke("desktop:video-cancel", [...progressCallbacks.keys()]),
});