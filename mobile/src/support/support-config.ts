/**
 * Phase 4B.1 — Support submission capability gating.
 *
 * Priority order (per product spec):
 *   1. Existing backend ticket API → would be 'backend'
 *   2. Configured production support email → 'email'
 *   3. Neither configured → 'unavailable'
 *
 * The backend has no support/ticket route. Email is null in legalConfig.
 * This module centralises the capability check so UI never branches inline.
 */

import { legalConfig } from '@/legal';

export type SupportSubmissionMode = 'backend' | 'email' | 'unavailable';

/**
 * Returns the active submission mode for this build.
 * Backend ticket API does not exist yet, so this evaluates email only.
 */
export function getSupportSubmissionMode(): SupportSubmissionMode {
  const email = legalConfig.contact.supportEmail?.trim() ?? '';
  if (email.length > 0) {
    return 'email';
  }
  return 'unavailable';
}

/**
 * True when any submission path is available.
 * Use this to gate send actions without branching on the mode.
 */
export function canSubmitSupportReport(): boolean {
  return getSupportSubmissionMode() !== 'unavailable';
}

/**
 * Returns the configured support email, or null if not set.
 * Prefer the support-specific mailbox; fall back to privacy if that is the
 * only configured address (matches existing legalConfig semantics).
 */
export function getSupportEmail(): string | null {
  const support = legalConfig.contact.supportEmail?.trim() ?? '';
  if (support.length > 0) {
    return support;
  }
  const privacy = legalConfig.contact.privacyEmail?.trim() ?? '';
  return privacy.length > 0 ? privacy : null;
}
