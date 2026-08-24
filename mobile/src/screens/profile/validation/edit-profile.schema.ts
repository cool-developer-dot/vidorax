import { z } from 'zod';

import { normalizeFullName } from '@/screens/auth/validation/register.schema';

const NAME_MIN = 2;
const NAME_MAX = 100;

/**
 * Edit Profile form schema — name only.
 * Avatar changes go exclusively through the signed upload / remove pipeline.
 */
export const editProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Full name is required' })
    .min(NAME_MIN, { message: `Enter at least ${NAME_MIN} characters` })
    .max(NAME_MAX, { message: `Name must not exceed ${NAME_MAX} characters` })
    .refine((value) => value.replace(/\s+/g, ' ').trim().length >= NAME_MIN, {
      message: 'Enter at least 2 characters',
    }),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;

export function createEditProfileDefaultValues(input: {
  name: string;
}): EditProfileFormValues {
  return {
    name: input.name,
  };
}

export function normalizeEditProfileValues(
  values: EditProfileFormValues,
): { name: string } {
  return {
    name: normalizeFullName(values.name),
  };
}

export { normalizeFullName };
