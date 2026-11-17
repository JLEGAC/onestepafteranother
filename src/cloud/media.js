const bucket = 'vision-images';
const uploaded = new Set();
const imageCache = new Map();
async function mediaHash(blob) {
  const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function dataURL(blob) {
  return new Promise((resolve,reject) => { const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.readAsDataURL(blob); });
}
export async function packMedia(client, uid, state) {
  const copy = structuredClone(state);
  for (const image of copy.profile.resonanceImages || []) {
    if (!image.dataUrl?.startsWith('data:image/')) throw new Error('Image locale invalide.');
    const blob = await (await fetch(image.dataUrl)).blob();
    const hash = await mediaHash(blob);
    const path = `${uid}/${hash}`;
    if (!uploaded.has(path)) {
    const { error } = await client.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false });
    if (error && !['409','Duplicate'].includes(String(error.statusCode)) && !/already exists/i.test(error.message)) throw error;
    uploaded.add(path);
    }
    imageCache.set(path,image.dataUrl);
    image.mediaPath = path; delete image.dataUrl;
  }
  return copy;
}
export async function unpackMedia(client, uid, state, local) {
  const copy = structuredClone(state);
  for (const image of copy.profile?.resonanceImages || []) {
    if (image.dataUrl?.startsWith('data:image/')) continue;
    if (!new RegExp(`^${uid}/[a-f0-9]{64}$`).test(image.mediaPath || '')) throw new Error('Chemin image invalide.');
    if(!imageCache.has(image.mediaPath)) {
      for(const candidate of local?.profile?.resonanceImages || []) {
        if(!candidate.dataUrl?.startsWith('data:image/'))continue;
        const blob=await (await fetch(candidate.dataUrl)).blob();
        imageCache.set(`${uid}/${await mediaHash(blob)}`,candidate.dataUrl);
      }
    }
    const cached = imageCache.get(image.mediaPath);
    if (cached) image.dataUrl = cached;
    else {
      const {data,error} = await client.storage.from(bucket).download(image.mediaPath);
      if (error) throw error;
      image.dataUrl = await dataURL(data);
      imageCache.set(image.mediaPath,image.dataUrl);
    }
    // mediaPath is a transport detail; state equality uses actual image content.
    delete image.mediaPath;
  }
  return copy;
}
