import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ImagePlus, UploadCloud } from "lucide-react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      setPreview(null);
      setSelectedFileName(null);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("This file is larger than 20MB. Please pick a smaller image.");
      setPreview(null);
      setSelectedFileName(null);
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextPreview;
    });
    setSelectedFileName(file.name);
    setError(null);
    onUpload(file);
  }

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFile(file);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-[28px] border-2 border-dashed p-10 text-center transition sm:p-12 ${
          isDragActive
            ? "border-sky-500 bg-sky-50"
            : "border-slate-300 bg-white/80 hover:border-sky-400 hover:bg-slate-50"
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload image drop zone"
      >
        <input {...getInputProps()} />

        <UploadCloud className="mx-auto mb-4 h-12 w-12 text-sky-600" aria-hidden="true" />

        <p className="text-lg font-semibold text-slate-900">
          {isDragActive ? "Drop your image here" : "Drop an image here"}
        </p>
        <p className="mt-2 text-sm text-slate-600">or click to browse from your device</p>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
          PNG · JPG · WEBP · SVG
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      {preview ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <ImagePlus className="h-4 w-4 text-sky-600" />
            <span>{selectedFileName ?? "Uploaded image"}</span>
          </div>
          <img
            src={preview}
            alt="Uploaded preview"
            className="mt-4 max-h-80 w-full rounded-2xl object-contain shadow-lg"
          />
        </div>
      ) : null}
    </div>
  );
}