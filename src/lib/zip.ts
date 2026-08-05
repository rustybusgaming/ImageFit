import JSZip from "jszip";
import { downloadBlob } from "./download";

export async function downloadZip(
  files: Array<{ blob: Blob; filename: string }>,
  zipName: string
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  await downloadBlob(content, zipName);
}