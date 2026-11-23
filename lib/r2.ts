import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

export const uploadToR2 = async (file: File | Buffer, path: string, contentType?: string): Promise<string> => {
  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());

  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: path,
    Body: buffer,
    ContentType: contentType ?? (file as File).type,
  }));

  return `${R2_PUBLIC_URL}/${path}`;
};

export const deleteFromR2 = async (path: string): Promise<void> => {
  await r2Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: path,
  }));
};
