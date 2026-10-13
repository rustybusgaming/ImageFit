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

  // Revoking straight after click() can abort the download in Firefox and Safari, which read
  // the URL asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
}