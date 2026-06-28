// Images stored as base64 inside ACL-owned GenosDB nodes (no blob server). Files
// are compressed client-side with a canvas (resize + JPEG) so nodes stay small —
// no external dependency.
import { db } from "../db/gdb.js";
import { TYPE, newId } from "../db/schema.js";

const MAX_DIM = 1280;
const QUALITY = 0.82;

/** Compress a File to a base64 data URL via an offscreen canvas. */
function compress(file, maxDim = MAX_DIM, quality = QUALITY) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

/** Upload an image: compress to base64, store as an ACL-owned `image` node. Returns its id. */
export async function uploadImage(file, opts = {}) {
  if (!file?.type?.startsWith("image/")) throw new Error("Not an image file.");
  const data = await compress(file, opts.maxDim ?? MAX_DIM, opts.quality ?? QUALITY);
  const id = newId("img");
  await db.sm.acls.set({ type: TYPE.image, id, data, size: data.length, createdAt: Date.now() }, id);
  return id;
}

/** Fetch an image's base64 data URL by id, or null. */
export async function getImage(id) {
  if (!id) return null;
  const { result } = await db.get(id);
  return result?.value?.data || null;
}
