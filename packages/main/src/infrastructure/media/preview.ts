import { MediaRepositoryError } from "./media-repository";

export const MAX_ORIGINAL_IMAGE_BYTES = 25 * 1024 * 1024;
export const PREVIEW_MAX_DIMENSION = 2_000;
export const PREVIEW_JPEG_QUALITY = 0.88;

export interface GeneratedPreview {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
}

export function validateImageBlob(blob: Blob): void {
  if (!blob.type.startsWith("image/")) {
    throw new MediaRepositoryError(
      "INVALID_MEDIA",
      "Choose a supported image file.",
    );
  }
  if (blob.size <= 0) {
    throw new MediaRepositoryError(
      "INVALID_MEDIA",
      "The selected image is empty.",
    );
  }
  if (blob.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new MediaRepositoryError(
      "INVALID_MEDIA",
      "The selected image is larger than the 25 MB local limit.",
    );
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not decode the image."));
    image.src = source;
  });
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob === null
          ? reject(new Error("The browser could not create an image preview."))
          : resolve(blob),
      mimeType,
      quality,
    );
  });
}

export async function generateImagePreview(
  original: Blob,
  maxDimension = PREVIEW_MAX_DIMENSION,
): Promise<GeneratedPreview> {
  validateImageBlob(original);
  if (
    typeof document === "undefined" ||
    typeof Image === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new MediaRepositoryError(
      "STORAGE_UNAVAILABLE",
      "Image preview generation is not available in this browser.",
    );
  }
  const source = URL.createObjectURL(original);
  try {
    const image = await loadImage(source);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas image previews are not available.");
    }
    context.drawImage(image, 0, 0, width, height);
    const preservePng = original.type === "image/png";
    const mimeType = preservePng ? "image/png" : "image/jpeg";
    const blob = await canvasBlob(
      canvas,
      mimeType,
      preservePng ? undefined : PREVIEW_JPEG_QUALITY,
    );
    return { blob, width, height };
  } catch (error) {
    throw new MediaRepositoryError(
      "STORAGE_UNAVAILABLE",
      error instanceof Error
        ? error.message
        : "The browser could not create an image preview.",
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}
