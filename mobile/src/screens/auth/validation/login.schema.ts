import { z } from 'zod';

import { localizeAuthValidationCode } from '@/localization';

/** Client-side login schema aligned with backend `loginValidator`. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'EMAIL_REQUIRED' })
    .email({ message: 'EMAIL_INVALID' }),
  password: z.string().min(1, { message: 'PASSWORD_REQUIRED' }),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const LOGIN_DEFAULT_VALUES: LoginFormValues = {
  email: '',
  password: '',
  rememberMe: true,
};

function localizeAuthIssue(message?: string): string | undefined {
  if (!message) {
    return undefined;
  }
  return localizeAuthValidationCode(
    message,
    message === 'PASSWORD_MIN' ? { count: 8 } : undefined,
  );
}

export function getLoginFieldError(
  field: 'email' | 'password',
  value: string,
): string | undefined {
  if (field === 'email') {
    const parsed = loginSchema.pick({ email: true }).safeParse({ email: value });
    return parsed.success ? undefined : localizeAuthIssue(parsed.error.issues[0]?.message);
  }

  const parsed = loginSchema.pick({ password: true }).safeParse({ password: value });
  return parsed.success ? undefined : localizeAuthIssue(parsed.error.issues[0]?.message);
}
