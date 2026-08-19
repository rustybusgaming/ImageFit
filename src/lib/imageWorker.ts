/**
 * Render worker: decodes the source once, keeps the decoded bitmap hot, and composites every
 * export off the main thread so the UI stays responsive while a preset batch runs.
 */

import { applyEffectOnGPU, isEffectPipelineAvailable } from "./webglEffects";
import { getCanvasFilter, offscreenBackend, renderCompress, renderResize } from "./imageRenderCore";
import type { RenderRequest, RenderResponse } from "./renderProtocol";

/**
 * The project compiles against the DOM lib, which does not declare the worker global scope.
 * Only the two members this worker uses are typed here rather than pulling in the WebWorker
 * lib, which conflicts with DOM.
 */
interface WorkerScope {
  postMessage(message: RenderResponse): void;
  addEventListener(type: "message", listener: (event: MessageEvent<RenderRequest>) => void): void;
}

const worker = self as unknown as WorkerScope;

/**
 * Decoding is the expensive part of a batch export, so the most recent source is cached.
 * Only one is held at a time: sources are full-resolution uploads and holding several would
 * cost more memory than the decode it saves.
 */
let cached: { key: string; bitmap: ImageBitmap } | null = null;

async function getBitmap(key: string, source: Blob): Promise<ImageBitmap> {
  if (cached?.key === key) return cached.bitmap;

  const bitmap = await createImageBitmap(source);
  cached?.bitmap.close();
  cached = { key, bitmap };
  return bitmap;
}

async function handle(request: RenderRequest): Promise<Blob> {
  const source = await getBitmap(request.sourceKey, request.source);
  const effect = request.job.settings.effect;

  // Prefer the GPU colour pass; fall back to the equivalent ctx.filter string when it is
  // unavailable so the output still matches.
  const treated = request.useGPUEffects ? await applyEffectOnGPU(source, effect) : null;
  const foreground = treated ?? source;
  const canvasFilter = treated ? "none" : getCanvasFilter(effect);

  try {
    if (request.job.kind === "resize") {
      return await renderResize(offscreenBackend, {
        source,
        foreground,
        canvasFilter,
        preset: request.job.preset,
        transform: request.job.transform,
        settings: request.job.settings,
      });
    }

    return await renderCompress(offscreenBackend, {
      foreground,
      canvasFilter,
      scale: request.job.scale,
      quality: request.job.settings.quality,
      format: request.job.settings.format,
    });
  } finally {
    if (treated) treated.close();
  }
}

worker.addEventListener("message", (event: MessageEvent<RenderRequest>) => {
  const request = event.data;

  void handle(request)
    .then((blob) => {
      const response: RenderResponse = { jobId: request.jobId, blob };
      worker.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: RenderResponse = {
        jobId: request.jobId,
        error: error instanceof Error ? error.message : "The render worker could not process this image.",
      };
      worker.postMessage(response);
    });
});

worker.postMessage({ jobId: -1, ready: true, gpuEffects: isEffectPipelineAvailable() } satisfies RenderResponse);
