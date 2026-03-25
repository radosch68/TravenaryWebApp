import { z } from 'zod'

export const signUpSchema = z.object({
  email: z.string().email('validation.emailInvalid'),
  password: z.string().min(8, 'validation.passwordMin'),
  displayName: z.string().trim().optional(),
})

export const signInSchema = z.object({
  email: z.string().email('validation.emailInvalid'),
  password: z.string().min(8, 'validation.passwordMin'),
})

export type SignUpFormData = z.infer<typeof signUpSchema>
export type SignInFormData = z.infer<typeof signInSchema>
