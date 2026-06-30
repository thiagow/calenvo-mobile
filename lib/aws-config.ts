
import { S3Client } from '@aws-sdk/client-s3'

// Usa R2_ como prioridade para evitar conflito com credenciais AWS
// injetadas automaticamente pela Netlify (extensão AWS).
// Fallback para AWS_ para compatibilidade com .env local.

export function getBucketConfig() {
  return {
    bucketName: process.env.R2_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '',
    folderPrefix: process.env.R2_FOLDER_PREFIX || process.env.AWS_FOLDER_PREFIX || ''
  }
}

export function createS3Client() {
  return new S3Client({
    region: process.env.R2_REGION || process.env.AWS_REGION || 'auto',
    endpoint: process.env.R2_ENDPOINT || process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    }
  })
}
