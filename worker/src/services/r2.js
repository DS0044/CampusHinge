/**
 * R2 Upload Service — Replaces S3 presigned URLs.
 *
 * Cloudflare R2 is S3-compatible with zero egress fees.
 * For photo uploads, we generate temporary presigned PUT URLs
 * so clients upload directly to R2.
 */

/**
 * Upload a file directly to R2 and return the public URL.
 * Used for server-side uploads (e.g., from form data).
 *
 * @param {R2Bucket} r2 - The R2 binding from c.env.R2
 * @param {string} userId
 * @param {string} filename
 * @param {ArrayBuffer|ReadableStream} body
 * @param {string} contentType
 * @returns {{ key: string, url: string }}
 */
export async function uploadToR2(r2, userId, filename, body, contentType) {
  const ext = filename.split('.').pop() || 'jpg';
  const key = `uploads/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  await r2.put(key, body, {
    httpMetadata: { contentType },
  });

  return { key };
}

/**
 * Generate a public URL for an R2 object.
 * The R2 bucket needs to have a custom domain or public access configured.
 *
 * @param {string} key - The R2 object key
 * @param {string} publicDomain - e.g., 'cdn.campushinge.com'
 * @returns {string}
 */
export function getPublicUrl(key, publicDomain) {
  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }
  // Fallback: return the key, frontend will need to fetch via Worker
  return `/cdn/${key}`;
}

/**
 * Serve an R2 object directly (for the /cdn/* route).
 *
 * @param {R2Bucket} r2
 * @param {string} key
 * @returns {Response}
 */
export async function serveR2Object(r2, key) {
  const object = await r2.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}

/**
 * Delete an R2 object.
 * @param {R2Bucket} r2
 * @param {string} key
 */
export async function deleteFromR2(r2, key) {
  await r2.delete(key);
}
