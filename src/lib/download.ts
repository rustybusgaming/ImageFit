export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const desktop = window.imageFitDesktop;
  if (desktop) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await desktop.saveFile(filename, bytes);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}