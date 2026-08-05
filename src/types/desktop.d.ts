interface Window {
  imageFitDesktop?: {
    getFilePath(file: File): string;
    nvencSupported(): Promise<boolean>;
    encodeVideo(
      payload: {
        inputPath: string;
        presetId: string;
        maxBytes: number;
        duration: number;
        height: number;
        audio: "keep" | "reduced" | "mute";
        frameRate: 30 | 24 | 15;
        format: "mp4" | "gif";
        codec: "h264" | "h265" | "av1";
        useNvenc: boolean;
      },
      onProgress: (progress: number) => void
    ): Promise<{ outputPath: string; size: number }>;
  };
}