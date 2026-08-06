interface Window {
  imageFitDesktop?: {
    getOutputDirectory(): Promise<string>;
    chooseOutputDirectory(): Promise<string>;
    saveFile(filename: string, bytes: Uint8Array): Promise<string | null>;
    openMediaDialog(): Promise<Array<{ name: string; path: string; bytes: Uint8Array }>>;
    readMediaFiles(paths: string[]): Promise<Array<{ name: string; path: string; bytes: Uint8Array }>>;
    onOpenPaths(callback: (paths: string[]) => void): () => void;
    onUpdateStatus(callback: (status: { state: "checking" | "downloading" | "ready" | "unavailable"; version?: string }) => void): () => void;
    installUpdate(): Promise<boolean>;
    checkForUpdates(): Promise<boolean>;
    getFilePath(file: File): string;
    availableVideoEncoders(): Promise<string[]>;
    encodeVideo(
      payload: {
        inputPath: string;
        presetId: string;
        maxBytes: number;
        duration: number;
        height: number;
        audio: "keep" | "reduced" | "mute";
        frameRate: 30 | 24 | 15;
        format: "mp4" | "webm" | "mov" | "avi" | "ogv" | "gif";
        codec: "h264" | "h265" | "av1" | "vp8" | "vp9" | "mpeg4" | "prores" | "dnxhd" | "mjpeg" | "theora";
        encoder: "software" | "nvenc" | "qsv" | "amf" | "videotoolbox";
      },
      onProgress: (progress: number) => void
    ): Promise<{ outputPath: string; size: number }>;
  };
}