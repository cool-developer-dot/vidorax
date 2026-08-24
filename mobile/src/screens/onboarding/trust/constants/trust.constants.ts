export const TRUST_COPY = {
  titleLead: 'Fast.',
  titleAccent: 'Reliable.',
  titleTrail: 'Always in Control.',
  subtitle:
    'Pause, resume, queue and manage your downloads effortlessly while VidoraX keeps everything running in the background.',
  accessibilityLabel:
    'Fast. Reliable. Always in Control. VidoraX manages every download from start to finish while keeping you in control.',
} as const;

export const TRUST_COLORS = {
  background: '#090B12',
  radialGlow: 'rgba(59, 130, 246, 0.11)',
  title: '#F8FAFC',
  titleAccent: '#3B82F6',
  subtitle: 'rgba(148, 163, 184, 0.78)',
  glassBg: 'rgba(15, 18, 28, 0.92)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBorderActive: 'rgba(96, 165, 250, 0.32)',
  chipBg: 'rgba(15, 18, 28, 0.72)',
  chipBorder: 'rgba(255, 255, 255, 0.08)',
  chipText: 'rgba(226, 232, 240, 0.82)',
  chipIcon: 'rgba(148, 163, 184, 0.9)',
  muted: 'rgba(148, 163, 184, 0.62)',
  softWhite: 'rgba(248, 250, 252, 0.92)',
  accent: '#3B82F6',
  accentSoft: 'rgba(59, 130, 246, 0.22)',
  accentGlow: 'rgba(96, 165, 250, 0.35)',
  progressTrack: 'rgba(148, 163, 184, 0.16)',
  libraryBorder: 'rgba(255, 255, 255, 0.08)',
  libraryBg: 'rgba(15, 18, 28, 0.55)',
  libraryLabel: 'rgba(148, 163, 184, 0.55)',
  libraryLabelActive: 'rgba(148, 163, 184, 0.88)',
} as const;

export const TRUST_WORKFLOW = {
  urlDisplay: 'youtube.com/watch?v=••••••',
  detectedLabel: 'Video Detected',
  cardTitle: 'Movie Trailer',
  quality: '1080P',
  format: 'MP4',
  size: '42 MB',
  completedLabel: 'Completed',
  libraryLabel: 'Offline Library',
} as const;

export type TrustCapabilityId =
  | 'pause'
  | 'resume'
  | 'queue'
  | 'notifications'
  | 'retry'
  | 'background';

export type TrustCapability = {
  id: TrustCapabilityId;
  label: string;
};

export const TRUST_CAPABILITIES: readonly TrustCapability[] = [
  { id: 'pause', label: 'Pause' },
  { id: 'resume', label: 'Resume' },
  { id: 'queue', label: 'Queue' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'retry', label: 'Retry' },
  { id: 'background', label: 'Background' },
] as const;

export const TRUST_LAYOUT = {
  chipHeight: 44,
  progressHeight: 2.5,
  cardMaxWidth: 340,
  glowSize: 280,
  maxFontMultiplier: 1.25,
} as const;
