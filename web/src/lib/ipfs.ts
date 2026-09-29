import { ipfsGateway } from "./config";

export function imageUrl(uri?: string) {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) return `${ipfsGateway}/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("https://")) return uri;
  return undefined;
}

// Posters are downscaled in the browser before upload so they stay small and load fast on phones.
export async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))), "image/webp", quality),
  );
}

export async function uploadPoster(file: File): Promise<string> {
  const blob = await compressImage(file);
  const body = new FormData();
  body.append("file", blob, "poster.webp");

  const res = await fetch("/api/upload", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed.");
  return data.uri as string;
}
