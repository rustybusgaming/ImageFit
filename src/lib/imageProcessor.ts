import type { PlatformPreset } from "../data/platforms";

export async function resizeImage(
  imageSrc: string,
  preset: PlatformPreset
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = preset.width;
        canvas.height = preset.height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Canvas 2D context not available"));
          return;
        }

        const scale = Math.max(
          preset.width / img.width,
          preset.height / img.height
        );

        const width = img.width * scale;
        const height = img.height * scale;

        const x = (preset.width - width) / 2;
        const y = (preset.height - height) / 2;

        ctx.drawImage(img, x, y, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(`Failed to create ${preset.format} blob`));
            }
          },
          `image/${preset.format}`,
          0.95
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Unknown error during image processing"));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageSrc;
  });
}