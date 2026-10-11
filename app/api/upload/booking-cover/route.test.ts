import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import sharp from 'sharp'

let mockRole = 'MASTER'
const { uploadFileMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(async (_buf: Buffer, _name: string) => 'covers/key.webp'),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({ user: { id: 'tenant-a', role: mockRole } })),
}))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/s3', () => ({ uploadFile: uploadFileMock, deleteFile: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    businessConfig: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
  },
}))

import { POST } from './route'

/** 4000×1000 (mais larga que a capa, sobra no eixo X): metade esquerda vermelha, metade direita azul. */
async function twoToneImage(): Promise<Buffer> {
  const half = (color: string) =>
    sharp({ create: { width: 2000, height: 1000, channels: 3, background: color } }).png().toBuffer()
  return sharp({ create: { width: 4000, height: 1000, channels: 3, background: '#000' } })
    .composite([
      { input: await half('#ff0000'), left: 0, top: 0 },
      { input: await half('#0000ff'), left: 2000, top: 0 },
    ])
    .png()
    .toBuffer()
}

function post(file: Buffer, fields: Record<string, string> = {}, name = 'capa.png', type = 'image/png') {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(file)], name, { type }))
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  return POST(new NextRequest('http://localhost/api/upload/booking-cover', { method: 'POST', body: form }))
}

/** Cor média (r,b) da saída gravada no storage. */
async function averageRedBlue() {
  const out = uploadFileMock.mock.calls[0][0]
  const { channels } = await sharp(out).stats()
  return { red: channels[0].mean, blue: channels[2].mean }
}

beforeEach(() => {
  mockRole = 'MASTER'
  uploadFileMock.mockClear()
})

describe('POST /api/upload/booking-cover — enquadramento', () => {
  it('foco à esquerda grava a parte vermelha; à direita, a azul; sempre 1600×700 WebP', async () => {
    const image = await twoToneImage()

    expect((await post(image, { focalX: '0', focalY: '0.5' })).status).toBe(200)
    const left = await averageRedBlue()
    const meta = await sharp(uploadFileMock.mock.calls[0][0]).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([1600, 700, 'webp'])
    expect(left.red).toBeGreaterThan(200)
    expect(left.blue).toBeLessThan(50)

    uploadFileMock.mockClear()
    expect((await post(image, { focalX: '1', focalY: '0.5' })).status).toBe(200)
    const right = await averageRedBlue()
    expect(right.blue).toBeGreaterThan(200)
    expect(right.red).toBeLessThan(50)
  })

  it('sem foco: centraliza (metade vermelha, metade azul)', async () => {
    expect((await post(await twoToneImage())).status).toBe(200)
    const { red, blue } = await averageRedBlue()
    expect(Math.abs(red - blue)).toBeLessThan(30)
  })

  it('foco inválido não derruba o envio', async () => {
    expect((await post(await twoToneImage(), { focalX: 'abc', focalY: '99' })).status).toBe(200)
  })
})

describe('POST /api/upload/booking-cover — validações', () => {
  it('arquivo que não é imagem: 400 e nada enviado', async () => {
    const res = await post(Buffer.from('não sou uma imagem'), {}, 'x.png')
    expect(res.status).toBe(400)
    expect(uploadFileMock).not.toHaveBeenCalled()
  })

  it('só MASTER envia capa: 403', async () => {
    mockRole = 'PROFESSIONAL'
    const res = await post(await twoToneImage())
    expect(res.status).toBe(403)
    expect(uploadFileMock).not.toHaveBeenCalled()
  })
})
