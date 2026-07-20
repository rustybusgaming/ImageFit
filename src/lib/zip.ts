import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function downloadZip(
  files: Array<{ blob: Blob; filename: string }>,
  zipName: string
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, zipName);
}