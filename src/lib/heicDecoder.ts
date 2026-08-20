/**
 * HEIC/HEIF decoding.
 *
 * iPhones shoot HEIC by default, but only Safari decodes it natively and the bundled FFmpeg
 * has no libheif, so the format is unreadable everywhere else. libheif-js fills that gap.
 *
 * The decoder carries roughly 1.4 MB of embedded wasm, so it is imported lazily: someone who
 * never opens a HEIC never downloads it.
 */

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(image: ImageData, callback: (result: ImageData | null) => void): void;
}

interface HeifDecoderModule {
  HeifDecoder: new () => { decode(buffer: Uint8Array): HeifImage[] };
}

let decoderModule: Promise<HeifDecoderModule> | null = null;

function loadDecoder(): Promise<HeifDecoderModule> {
  decoderModule ??= import("libheif-js/wasm-bundle").then(
    (module) => (module.default ?? module) as unknown as HeifDecoderModule
  );
  return decoderModule;
}

export async function decodeHeic(file: File): Promise<Blob> {
  const { HeifDecoder } = await loadDecoder();
  const images = new HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));

  // A HEIC can hold a burst or a Live Photo; the primary image is the one to work with.
  const image = images[0];
  if (!image) throw new Error("This HEIC file does not contain an image.");

  const width = image.get_width();
  const height = image.get_height();
  const imageData = new ImageData(width, height);

  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (result) => {
      if (result) resolve();
      else reject(new Error("ImageFit could not decode this HEIC file."));
    });
  });

  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!context) throw new Error("Canvas 2D context not available");

  context.putImageData(imageData, 0, 0);

  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not convert this HEIC file."))),
      "image/png"
    );
  });
}
