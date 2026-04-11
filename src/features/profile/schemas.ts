import { z } from 'zod'

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.displayNameRequired').max(80, 'validation.displayNameMax'),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().optional().transform((value) => {
      const normalized = value?.trim()
      return normalized ? normalized : undefined
    }),
    newPassword: z.string().min(8, 'validation.passwordMin'),
    confirmNewPassword: z.string().min(8, 'validation.passwordMin'),
  })
  .superRefine((value, ctx) => {
    if (value.currentPassword && value.currentPassword.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPassword'],
        message: 'validation.passwordMin',
      })
    }

    if (value.newPassword !== value.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmNewPassword'],
        message: 'validation.passwordMismatch',
      })
    }
  })

export const deleteAccountSchema = z.object({
  password: z.string().optional().transform((value) => {
    const normalized = value?.trim()
    return normalized ? normalized : undefined
  }),
})

export type DisplayNameFormData = z.infer<typeof displayNameSchema>
export type PasswordChangeFormData = z.input<typeof passwordChangeSchema>
export type DeleteAccountFormData = z.input<typeof deleteAccountSchema>
