export const SPLASH_LOGO = require('../../../../assets/logos/vidorax-logo.png');

export const SPLASH_BRAND_LETTERS = ['V', 'i', 'd', 'o', 'r', 'a', 'X'] as const;

export const SPLASH_COPY = {
  brandName: 'VidoraX',
  taglineWords: ['Fast', 'Reliable', 'Secure'] as const,
} as const;

/** Cinematic near-black — Apple keynote / Linear editorial. */
export const SPLASH_COLORS = {
  background: '#050505',
  brandText: '#F5F5F5',
  taglineText: '#93C5FD',
  taglineDot: 'rgba(255, 255, 255, 0.28)',
  loaderTrack: 'rgba(255, 255, 255, 0.12)',
  loaderFill: '#F5F5F5',
} as const;

export const SPLASH_LAYOUT = {
  logoSize: 120,
  brandFontSize: 34,
  brandLetterSpacing: 1.2,
  taglineFontSize: 13,
  taglineLetterSpacing: 3.2,
  loaderWidth: 200,
  loaderHeight: 2,
  letterGap: 1,
} as const;
