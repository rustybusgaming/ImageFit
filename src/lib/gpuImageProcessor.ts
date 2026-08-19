/**
 * GPU and render-path reporting.
 *
 * `getRenderPath()` reports the pipeline image exports actually take, which is decided by
 * `renderPool` (worker + OffscreenCanvas) and `webglEffects` (WebGL2 colour pass) rather than
 * by anything here — this module reads that state so the UI can show it, and reports the
 * underlying GPU that makes it possible.
 */

import { areGPUEffectsActive, isWorkerRenderingActive, supportsWorkerRendering } from "./renderPool";

export function isWebGLSupported(): boolean {
  const canvas = document.createElement("canvas");
  return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}

export interface GPUCapabilities {
  supported: boolean;
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  webgl2: boolean;
}

export function getGPUCapabilities(): GPUCapabilities {
  const canvas = document.createElement("canvas");
  const gl2 = canvas.getContext("webgl2");
  const gl = gl2 ?? (canvas.getContext("webgl") as WebGLRenderingContext | null);

  if (!gl) {
    return { supported: false, vendor: "Unknown", renderer: "Unknown", maxTextureSize: 0, webgl2: false };
  }

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  return {
    supported: true,
    vendor: String(vendor),
    renderer: String(renderer),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    webgl2: gl2 !== null,
  };
}

export type RenderPathId = "gpu-worker" | "worker" | "main-thread";

export interface RenderPath {
  id: RenderPathId;
  label: string;
  detail: string;
}

export function getRenderPath(): RenderPath {
  const workers = supportsWorkerRendering() && isWorkerRenderingActive();

  if (workers && areGPUEffectsActive()) {
    return {
      id: "gpu-worker",
      label: "GPU + workers",
      detail: "Exports composite on worker threads with a WebGL2 colour pass.",
    };
  }

  if (workers) {
    return {
      id: "worker",
      label: "Worker threads",
      detail: "Exports composite off the main thread; colour treatments use canvas filters.",
    };
  }

  return {
    id: "main-thread",
    label: "Main thread",
    detail: "This browser lacks OffscreenCanvas workers, so exports run on the main thread.",
  };
}
