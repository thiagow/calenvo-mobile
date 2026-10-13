import { z } from 'zod'
import { TEMPLATE_BODY_MAX, TEMPLATE_NAME_MAX, findUnknownVariables } from '@/lib/message-template'

const body = z
  .string()
  .trim()
  .min(1, 'Escreva a mensagem')
  .max(TEMPLATE_BODY_MAX, `A mensagem pode ter no máximo ${TEMPLATE_BODY_MAX} caracteres`)
  .superRefine((value, ctx) => {
    const unknown = findUnknownVariables(value)
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Variável desconhecida: ${unknown.map(v => `{{${v}}}`).join(', ')}`,
      })
    }
  })

const name = z
  .string()
  .trim()
  .min(1, 'Dê um nome ao modelo')
  .max(TEMPLATE_NAME_MAX, `O nome pode ter no máximo ${TEMPLATE_NAME_MAX} caracteres`)

export const createTemplateSchema = z.object({ name, body, isDefault: z.boolean().optional() }).strict()

export const updateTemplateSchema = z
  .object({ name: name.optional(), body: body.optional(), isDefault: z.literal(true).optional() })
  .strict()

export const TEMPLATE_SELECT = { id: true, name: true, body: true, isDefault: true, updatedAt: true } as const
