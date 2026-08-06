/**
 * GPU detection helpers used to report hardware-accelerated canvas rendering support.
 * Browsers already GPU-accelerate 2D canvas operations automatically when a WebGL-capable
 * GPU is present, so these helpers are used for capability reporting rather than manual rendering.
 */

export function isWebGLSupported(): boolean {
  const canvas = document.createElement("canvas");
  return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
}

export interface GPUCapabilities {
  supported: boolean;
  vendor: string;
  renderer: string;
  maxTextureSize: number;
}

export function getGPUCapabilities(): GPUCapabilities {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;

  if (!gl) {
    return { supported: false, vendor: "Unknown", renderer: "Unknown", maxTextureSize: 0 };
  }

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  return {
    supported: true,
    vendor: String(vendor),
    renderer: String(renderer),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
}

