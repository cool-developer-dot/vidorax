import { z } from 'zod';

import { localizeAuthValidationCode } from '@/localization';

/** Client-side forgot-password schema — UI phase only. */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'EMAIL_REQUIRED' })
    .email({ message: 'EMAIL_INVALID' }),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const FORGOT_PASSWORD_DEFAULT_VALUES: ForgotPasswordFormValues = {
  email: '',
};

export function getForgotPasswordEmailError(email: string): string | undefined {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (parsed.success) {
    return undefined;
  }
  const code = parsed.error.issues[0]?.message;
  return code ? localizeAuthValidationCode(code) : undefined;
}
