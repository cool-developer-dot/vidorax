export const GATEWAY_LOGO = require('../../../../../assets/logos/vidorax-logo.png');

export const GATEWAY_COPY = {
  titleLead: 'Download',
  titleAccent: 'Without Limits',
  subtitle:
    'Browse your favorite websites or paste a link.\nVidoraX intelligently detects compatible downloadable videos.',
} as const;

export const GATEWAY_COLORS = {
  background: '#090B12',
  logoGlow: 'rgba(96, 165, 250, 0.14)',
  title: '#F8FAFC',
  titleAccent: '#3B82F6',
  subtitle: 'rgba(148, 163, 184, 0.78)',
  footerMuted: 'rgba(148, 163, 184, 0.72)',
  footerActive: '#F8FAFC',
  dotInactive: 'rgba(148, 163, 184, 0.28)',
  dotActive: '#3B82F6',
} as const;

export const GATEWAY_LAYOUT = {
  logoSize: 96,
  /** Small soft radial only — not a giant disk behind the orbit */
  logoGlowSize: 118,
} as const;
