import { z } from 'zod'

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.displayNameRequired').max(80, 'validation.displayNameMax'),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(8, 'validation.passwordMin'),
  newPassword: z.string().min(8, 'validation.passwordMin'),
})

export const deleteAccountSchema = z.object({
  password: z.string().optional().transform((value) => {
    const normalized = value?.trim()
    return normalized ? normalized : undefined
  }),
})

export type DisplayNameFormData = z.infer<typeof displayNameSchema>
export type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>
export type DeleteAccountFormData = z.input<typeof deleteAccountSchema>
