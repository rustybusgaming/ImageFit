const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { randomUUID } = require("node:crypto");

const progressCallbacks = new Map();
const openFileCallbacks = new Set();
const updateCallbacks = new Set();

ipcRenderer.on("desktop:video-progress", (_event, { jobId, progress }) => {
  progressCallbacks.get(jobId)?.(progress);
});

ipcRenderer.on("desktop:open-paths", (_event, paths) => {
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
    return () => openFileCallbacks.delete(callback);
  },
  onUpdateStatus: (callback) => {
    updateCallbacks.add(callback);
    return () => updateCallbacks.delete(callback);
  },
  encodeVideo: (payload, onProgress) => {
    const jobId = randomUUID();
    progressCallbacks.set(jobId, onProgress);
    return ipcRenderer.invoke("desktop:video-encode", { ...payload, jobId })
      .finally(() => progressCallbacks.delete(jobId));
  },
});