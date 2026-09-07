const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');

/**
 * S3 service — generates presigned PUT URLs so clients upload directly to S3.
 *
 * In development, if AWS credentials are not set, returns a mock URL.
 */

let s3Client;

function getS3Client() {
  if (s3Client) return s3Client;

  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.warn('⚠️  AWS credentials not configured — S3 will return mock URLs.');
    return null;
  }

  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

/**
 * Generate a presigned PUT URL for uploading a file to S3.
 * @param {string} userId - The user's ID (used as folder prefix)
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type (e.g. 'image/jpeg')
 * @returns {{ uploadUrl: string, key: string }}
 */
async function getPresignedUploadUrl(userId, filename, contentType) {
  const ext = filename.split('.').pop() || 'jpg';
  const key = `uploads/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const client = getS3Client();

  // Mock mode for development
  if (!client) {
    return {
      uploadUrl: `https://${env.S3_BUCKET_NAME || 'mock-bucket'}.s3.${env.AWS_REGION}.amazonaws.com/${key}?mock=true`,
      key,
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: env.S3_PRESIGNED_URL_EXPIRY,
  });

  return { uploadUrl, key };
}

/**
 * Build the public URL for an S3 key.
 */
function getPublicUrl(key) {
  return `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { getPresignedUploadUrl, getPublicUrl };
