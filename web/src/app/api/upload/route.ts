import { PinataSDK } from "pinata";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/webp", "image/jpeg", "image/png"];

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return Response.json({ error: "Poster uploads aren't configured." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No image received." }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return Response.json({ error: "Posters must be WebP, JPEG or PNG." }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That poster is too large." }, { status: 413 });

  try {
    const pinata = new PinataSDK({ pinataJwt: jwt });
    const upload = await pinata.upload.public.file(file).name(`turnout-poster-${Date.now()}.webp`);
    return Response.json({ uri: `ipfs://${upload.cid}` });
  } catch {
    return Response.json({ error: "Upload failed. Try again." }, { status: 502 });
  }
}
