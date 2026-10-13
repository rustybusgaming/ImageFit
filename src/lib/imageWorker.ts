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
 *
 * The decode promise is cached rather than the bitmap, so jobs that arrive while it is still
 * running share it instead of each decoding again. A bitmap that has been replaced is closed
 * only once the jobs still drawing from it have finished.
 */
interface CachedSource {
  key: string;
  bitmap: Promise<ImageBitmap>;
  users: number;
  retired: boolean;
}

let cached: CachedSource | null = null;

function release(entry: CachedSource): void {
  void entry.bitmap.then((bitmap) => bitmap.close(), () => undefined);
}

function acquire(key: string, source: Blob): CachedSource {
  if (cached?.key === key) {
    cached.users += 1;
    return cached;
  }

  if (cached) {
    cached.retired = true;
    if (cached.users === 0) release(cached);
  }

  const entry: CachedSource = { key, bitmap: createImageBitmap(source), users: 1, retired: false };
  // A failed decode must not stay cached, or every later job for this source would fail too.
  entry.bitmap.catch(() => {
    if (cached === entry) cached = null;
  });
  cached = entry;
  return entry;
}

function relinquish(entry: CachedSource): void {
  entry.users -= 1;
  if (entry.retired && entry.users === 0) release(entry);
}

async function handle(request: RenderRequest): Promise<Blob> {
  const entry = acquire(request.sourceKey, request.source);

  try {
    return await render(request, await entry.bitmap);
  } finally {
    relinquish(entry);
  }
}

async function render(request: RenderRequest, source: ImageBitmap): Promise<Blob> {
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
