import { z } from 'zod';

import { localizeAuthValidationCode } from '@/localization';

const PASSWORD_MIN = 8;

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `Minimum ${PASSWORD_MIN} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN,
  },
  {
    id: 'upper',
    label: 'Uppercase letter',
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: 'lower',
    label: 'Lowercase letter',
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: 'number',
    label: 'Number',
    test: (value: string) => /\d/.test(value),
  },
  {
    id: 'special',
    label: 'Special character',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]['id'];

export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong';

export function evaluatePassword(password: string) {
  const checks = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));
  const metCount = checks.filter((item) => item.met).length;
  const score = password.length === 0 ? 0 : metCount;

  let level: PasswordStrengthLevel = 'empty';
  if (score <= 0) {
    level = 'empty';
  } else if (score <= 2) {
    level = 'weak';
  } else if (score <= 4) {
    level = 'medium';
  } else {
    level = 'strong';
  }

  return { checks, metCount, score, level, isStrong: metCount === PASSWORD_RULES.length };
}

const strongPasswordSchema = z
  .string()
  .min(1, { message: 'PASSWORD_REQUIRED' })
  .min(PASSWORD_MIN, { message: 'PASSWORD_MIN' })
  .refine((value) => /[A-Z]/.test(value), {
    message: 'PASSWORD_UPPER',
  })
  .refine((value) => /[a-z]/.test(value), {
    message: 'PASSWORD_LOWER',
  })
  .refine((value) => /\d/.test(value), {
    message: 'PASSWORD_NUMBER',
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: 'PASSWORD_SPECIAL',
  });

/** Client-side register schema aligned with backend + stronger UX rules. */
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'NAME_REQUIRED' })
      .min(2, { message: 'NAME_MIN' })
      .max(100, { message: 'NAME_MAX' }),
    email: z
      .string()
      .trim()
      .min(1, { message: 'EMAIL_REQUIRED' })
      .email({ message: 'EMAIL_INVALID' }),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, { message: 'CONFIRM_REQUIRED' }),
    acceptedTerms: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'PASSWORD_MISMATCH',
      });
    }

    if (!values.acceptedTerms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['acceptedTerms'],
        message: 'TERMS_REQUIRED',
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const REGISTER_DEFAULT_VALUES: RegisterFormValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

export function getRegisterFieldError(
  field: 'name' | 'email' | 'password' | 'confirmPassword' | 'acceptedTerms',
  values: Partial<RegisterFormValues>,
): string | undefined {
  const parsed = registerSchema.safeParse({
    ...REGISTER_DEFAULT_VALUES,
    ...values,
  });

  if (parsed.success) {
    return undefined;
  }

  const code = parsed.error.issues.find((issue) => issue.path[0] === field)?.message;
  if (!code) {
    return undefined;
  }
  return localizeAuthValidationCode(
    code,
    code === 'PASSWORD_MIN' ? { count: PASSWORD_MIN } : undefined,
  );
}

export function normalizeFullName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
