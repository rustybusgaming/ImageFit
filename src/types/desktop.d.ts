interface Window {
  imageFitDesktop?: {
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