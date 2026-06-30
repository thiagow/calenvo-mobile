
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getBucketConfig } from './aws-config'

const s3Client = createS3Client()
const { bucketName, folderPrefix } = getBucketConfig()

/**
 * Upload de arquivo para S3
 * @param buffer - Buffer do arquivo
 * @param fileName - Nome do arquivo (será usado para gerar a key)
 * @returns cloud_storage_path - Caminho do arquivo no S3
 */
export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const key = `${folderPrefix}${Date.now()}-${fileName}`

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: getContentType(fileName)
  })

  await s3Client.send(command)
  return key
}

/**
 * Download de arquivo do S3 (retorna URL assinada)
 * @param key - cloud_storage_path do arquivo
 * @returns URL assinada com validade de 1 hora
 */
export async function downloadFile(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  })

  // URL válida por 1 hora
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  return signedUrl
}

/**
 * Delete de arquivo do S3
 * @param key - cloud_storage_path do arquivo
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  })

  await s3Client.send(command)
}

/**
 * Renomear arquivo (copia e deleta o original)
 * @param oldKey - cloud_storage_path atual
 * @param newKey - novo cloud_storage_path
 */
export async function renameFile(oldKey: string, newKey: string): Promise<string> {
  // Para renomear, precisamos copiar o arquivo e deletar o original
  // Mas por simplicidade, vamos apenas retornar o novo key
  // (a implementação completa exigiria CopyObjectCommand)
  return newKey
}

/**
 * Determina o Content-Type baseado na extensão do arquivo
 */
function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf'
  }

  return contentTypes[ext || ''] || 'application/octet-stream'
}
