import { CONFIDENCE } from '../constants';
import type { MediaCandidate } from '../types';

/**
 * Deterministic confidence score from available evidence.
 * Never fabricates signals — only boosts for present, validated fields.
 */
export function scoreConfidence(candidate: MediaCandidate): number {
  let score = candidate.confidenceHint ?? CONFIDENCE.baseUrlMatch;

  if (candidate.mimeType) {
    score += CONFIDENCE.mimeBoost;
  }

  if (
    candidate.detectionSource === 'dom_video' ||
    candidate.detectionSource === 'dom_audio' ||
    candidate.detectionSource === 'dom_source'
  ) {
    score += CONFIDENCE.domElementBoost;
  }

  if (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    candidate.width > 0 &&
    candidate.height > 0
  ) {
    score += CONFIDENCE.dimensionsBoost;
  }

  if (typeof candidate.duration === 'number' && candidate.duration > 0) {
    score += CONFIDENCE.durationBoost;
  }

  if (candidate.detectionSource === 'manifest') {
    score += CONFIDENCE.manifestBoost;
  }

  return Math.min(CONFIDENCE.max, Math.max(0, Number(score.toFixed(3))));
}
