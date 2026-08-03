import { useEffect, useRef, useState } from "react";

export function useImage() {
  const [image, setImage] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  function revokeCurrentUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function loadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      return;
    }

    revokeCurrentUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImage(url);
  }

  function clearImage() {
    revokeCurrentUrl();
    setImage(null);
  }

  useEffect(() => {
    return () => {
      revokeCurrentUrl();
    };
  }, []);

  return {
    image,
    loadImage,
    clearImage,
  };
}