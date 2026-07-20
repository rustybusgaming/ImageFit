import { useState, useEffect } from "react";

export function useImage() {
  const [image, setImage] = useState<string | null>(null);

  function loadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      return;
    }

    const url = URL.createObjectURL(file);
    setImage(url);
  }

  function clearImage() {
    setImage(null);
  }

  useEffect(() => {
    return () => {
      if (image) {
        URL.revokeObjectURL(image);
      }
    };
  }, [image]);

  return {
    image,
    loadImage,
    clearImage,
  };
}