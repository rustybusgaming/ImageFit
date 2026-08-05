const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { randomUUID } = require("node:crypto");

const progressCallbacks = new Map();

ipcRenderer.on("desktop:video-progress", (_event, { jobId, progress }) => {
  progressCallbacks.get(jobId)?.(progress);
});

contextBridge.exposeInMainWorld("imageFitDesktop", {
  getFilePath: (file) => webUtils.getPathForFile(file),
  availableVideoEncoders: () => ipcRenderer.invoke("desktop:available-video-encoders"),
  encodeVideo: (payload, onProgress) => {
    const jobId = randomUUID();
    progressCallbacks.set(jobId, onProgress);
    return ipcRenderer.invoke("desktop:video-encode", { ...payload, jobId })
      .finally(() => progressCallbacks.delete(jobId));
  },
});