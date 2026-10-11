export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import sharp from 'sharp'
import { authOptions } from '@/lib/auth-options'
import { computeCoverCrop, parseFocal } from '@/lib/cover-crop'
import { uploadFile, deleteFile } from '@/lib/s3'
import { prisma } from '@/lib/db'

const MAX_BYTES = 5 * 1024 * 1024
const COVER_WIDTH = 1600
const COVER_HEIGHT = 700
// Proteção contra "decompression bomb": imagem pequena em bytes, gigante em pixels.
const MAX_INPUT_PIXELS = 40_000_000

/** Confere os bytes iniciais: o `file.type` vem do cliente e não é confiável. */
function isSupportedImage(buf: Buffer): boolean {
  const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  const isPng =
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp =
    buf.length > 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  return isJpeg || isPng || isWebp
}

async function requireMasterId(): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  const { id, role } = (session?.user ?? {}) as { id?: string; role?: string }
  if (!id) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (role !== 'MASTER') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }
  return { userId: id }
}

/** Apaga a capa anterior sem deixar uma falha de storage derrubar a requisição. */
async function removeStoredCover(key: string | null | undefined) {
  if (!key) return
  try {
    await deleteFile(key)
  } catch (error) {
    console.error('Falha ao remover capa antiga do storage:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterId()
    if ('error' in auth) return auth.error

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5MB' }, { status: 400 })
    }

    const input = Buffer.from(await file.arrayBuffer())
    if (!isSupportedImage(input)) {
      return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WebP' }, { status: 400 })
    }

    const focalX = parseFocal(formData.get('focalX'))
    const focalY = parseFocal(formData.get('focalY'))

    let output: Buffer
    try {
      // `rotate()` respeita a orientação EXIF de fotos de celular; materializa
      // antes para medir a imagem já orientada.
      const { data: oriented, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
        .rotate()
        .toBuffer({ resolveWithObject: true })

      // Recorte pelo foco que o dono escolheu arrastando a foto (mesma conta do
      // preview em CSS `object-position`).
      const crop = computeCoverCrop({
        srcWidth: info.width,
        srcHeight: info.height,
        targetWidth: COVER_WIDTH,
        targetHeight: COVER_HEIGHT,
        focalX,
        focalY,
      })
      output = await sharp(oriented)
        .resize(crop.resizeWidth, crop.resizeHeight)
        .extract({ left: crop.left, top: crop.top, width: COVER_WIDTH, height: COVER_HEIGHT })
        .webp({ quality: 82 })
        .toBuffer()
    } catch {
      return NextResponse.json({ error: 'Não foi possível processar a imagem' }, { status: 400 })
    }

    const previous = await prisma.businessConfig.findUnique({
      where: { userId: auth.userId },
      select: { bookingCoverImage: true },
    })

    const key = await uploadFile(output, 'booking-cover.webp')

    await prisma.businessConfig.upsert({
      where: { userId: auth.userId },
      update: { bookingCoverImage: key },
      create: {
        userId: auth.userId,
        bookingCoverImage: key,
        workingDays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '18:00',
        defaultDuration: 30,
      },
    })

    await removeStoredCover(previous?.bookingCoverImage)

    return NextResponse.json({ success: true, coverImage: key })
  } catch (error) {
    console.error('Erro no upload da capa:', error)
    return NextResponse.json({ error: 'Erro ao enviar a capa' }, { status: 500 })
  }
}

/** Remove a capa enviada; com a capa ligada, a página volta a usar o preset do template. */
export async function DELETE() {
  try {
    const auth = await requireMasterId()
    if ('error' in auth) return auth.error

    const config = await prisma.businessConfig.findUnique({
      where: { userId: auth.userId },
      select: { bookingCoverImage: true },
    })
    if (!config?.bookingCoverImage) {
      return NextResponse.json({ success: true, coverImage: null })
    }

    await prisma.businessConfig.update({
      where: { userId: auth.userId },
      data: { bookingCoverImage: null },
    })
    await removeStoredCover(config.bookingCoverImage)

    return NextResponse.json({ success: true, coverImage: null })
  } catch (error) {
    console.error('Erro ao remover a capa:', error)
    return NextResponse.json({ error: 'Erro ao remover a capa' }, { status: 500 })
  }
}
