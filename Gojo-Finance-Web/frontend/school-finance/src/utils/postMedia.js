export const formatFileSize = (bytes) => {
  const numericBytes = Number(bytes || 0);
  if (!numericBytes) return "0 KB";
  if (numericBytes >= 1024 * 1024) {
    return `${(numericBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(numericBytes / 1024))} KB`;
};

export const optimizePostMedia = async (file) => {
  if (!file || !String(file.type || "").startsWith("image/") || file.type === "image/svg+xml") {
    return {
      file,
      originalSize: Number(file?.size || 0),
      finalSize: Number(file?.size || 0),
      wasCompressed: false,
      wasConvertedToJpeg: false,
    };
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const imageElement = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to process selected image."));
      image.src = imageUrl;
    });

    const maxDimension = 1600;
    const originalWidth = imageElement.naturalWidth || imageElement.width;
    const originalHeight = imageElement.naturalHeight || imageElement.height;
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    let targetWidth = Math.max(1, Math.round(originalWidth * scale));
    let targetHeight = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      return {
        file,
        originalSize: Number(file.size || 0),
        finalSize: Number(file.size || 0),
        wasCompressed: false,
        wasConvertedToJpeg: false,
      };
    }

    const renderImage = () => {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    };

    const canvasToBlob = (quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Unable to optimize selected image."));
      }, "image/jpeg", quality);
    });

    renderImage();

    const qualitySteps = [0.82, 0.74, 0.66, 0.58, 0.5];
    const maxBytes = 900 * 1024;
    let bestBlob = null;

    for (const quality of qualitySteps) {
      const candidateBlob = await canvasToBlob(quality);
      bestBlob = candidateBlob;
      if (candidateBlob.size <= maxBytes) {
        break;
      }
    }

    if (bestBlob && bestBlob.size > maxBytes) {
      targetWidth = Math.max(960, Math.round(targetWidth * 0.82));
      targetHeight = Math.max(960, Math.round(targetHeight * 0.82 * (originalHeight / Math.max(originalWidth, 1))));
      renderImage();
      bestBlob = await canvasToBlob(0.5);
    }

    if (!bestBlob || bestBlob.size >= file.size) {
      return {
        file,
        originalSize: Number(file.size || 0),
        finalSize: Number(file.size || 0),
        wasCompressed: false,
        wasConvertedToJpeg: false,
      };
    }

    const jpegFile = new File(
      [bestBlob],
      `${file.name.replace(/\.[^.]+$/, "") || "post-image"}.jpg`,
      { type: "image/jpeg", lastModified: Date.now() },
    );

    return {
      file: jpegFile,
      originalSize: Number(file.size || 0),
      finalSize: Number(jpegFile.size || 0),
      wasCompressed: jpegFile.size < file.size,
      wasConvertedToJpeg: file.type !== "image/jpeg",
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};