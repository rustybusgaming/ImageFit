import { useEffect, useRef, useState } from "react";
import { classifyMedia } from "../lib/imageFormats";
import { prepareImage } from "../lib/imageSource";

export function useImage() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Guards against an earlier, slower conversion overwriting a newer selection.
  const loadTokenRef = useRef(0);

  function revokeCurrentUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function show(source: Blob, file: File) {
    revokeCurrentUrl();
    const url = URL.createObjectURL(source);
    objectUrlRef.current = url;
    setImage(url);
    setImageFile(file);
  }

  async function loadImage(file: File) {
    const kind = classifyMedia(file);
    if (kind === "unsupported") {
      setLoadError("ImageFit cannot read this file.");
      return;
    }

    const token = ++loadTokenRef.current;
    setLoadError(null);

    if (kind === "video") {
      show(file, file);
      return;
    }

    setIsPreparing(true);

    try {
      // Formats a browser cannot render are converted once here, so the editor, the export
      // preview and the platform exports all receive something displayable.
      const prepared = await prepareImage(file);
      if (token !== loadTokenRef.current) return;

      show(prepared.blob, file);
    } catch (error) {
      if (token !== loadTokenRef.current) return;
      setLoadError(error instanceof Error ? error.message : "ImageFit could not open this image.");
    } finally {
      if (token === loadTokenRef.current) setIsPreparing(false);
    }
  }

  function clearImage() {
    loadTokenRef.current += 1;
    revokeCurrentUrl();
    setImage(null);
    setImageFile(null);
    setLoadError(null);
    setIsPreparing(false);
  }

  useEffect(() => {
    return () => {
      revokeCurrentUrl();
    };
  }, []);

  return {
    image,
    imageFile,
    isPreparing,
    loadError,
    isVideo: imageFile ? classifyMedia(imageFile) === "video" : false,
    loadImage,
    clearImage,
  };
}
