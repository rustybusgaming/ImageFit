import { useEffect, useRef, useState } from "react";

export function useImage() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  function revokeCurrentUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function loadImage(file: File) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return;
    }

    revokeCurrentUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImage(url);
    setImageFile(file);
  }

  function clearImage() {
    revokeCurrentUrl();
    setImage(null);
    setImageFile(null);
  }

  useEffect(() => {
    return () => {
      revokeCurrentUrl();
    };
  }, []);

  return {
    image,
    imageFile,
    isVideo: imageFile?.type.startsWith("video/") ?? false,
    loadImage,
    clearImage,
  };
}