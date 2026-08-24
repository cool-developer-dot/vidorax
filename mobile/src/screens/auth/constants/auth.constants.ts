export const AUTH_LOGO = require('../../../../assets/logos/vidorax-logo.png');

export const SIGN_IN_COPY = {
  title: 'Welcome Back',
  subtitle:
    'Continue to your secure download workspace and access your personal offline media library.',
  emailLabel: 'Email',
  emailPlaceholder: 'Enter your email',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  rememberMe: 'Remember me',
  forgotPassword: 'Forgot Password',
  signIn: 'Sign In',
  divider: 'OR',
  noAccount: "Don't have an account?",
  createAccount: 'Create Account',
  accessibilityLabel:
    'Welcome back. Sign in to continue to your secure VidoraX download workspace.',
} as const;

export const SIGN_UP_COPY = {
  title: 'Create Your Account',
  subtitle:
    'Join VidoraX and start building your personal offline media library with a secure and seamless experience.',
  nameLabel: 'Full Name',
  namePlaceholder: 'Enter your full name',
  emailLabel: 'Email',
  emailPlaceholder: 'Enter your email',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Create a password',
  confirmLabel: 'Confirm Password',
  confirmPlaceholder: 'Confirm your password',
  createAccount: 'Create Account',
  divider: 'OR',
  hasAccount: 'Already have an account?',
  signIn: 'Sign In',
  termsPrefix: 'I agree to the ',
  termsLink: 'Terms & Conditions',
  termsMiddle: ' and ',
  privacyLink: 'Privacy Policy',
  termsSuffix: '.',
  duplicateEmail: 'An account with this email already exists.',
  signInInstead: 'Sign In Instead',
  accessibilityLabel:
    'Create your VidoraX account and unlock your secure download workspace.',
} as const;

export const FORGOT_PASSWORD_COPY = {
  title: 'Forgot Password',
  subtitle:
    'Password reset is not available yet. You can still enter your email to confirm the flow, then return to sign in.',
  emailLabel: 'Email',
  emailPlaceholder: 'Enter your email',
  sendLink: 'Send Reset Link',
  backToLogin: '← Back to Login',
  successTitle: 'Not available yet',
  successMessage:
    'Password reset is not available yet. Please sign in with your existing credentials or contact support.',
  successBack: 'Back to Login',
  accessibilityLabel:
    'Forgot password. Enter your email to recover access to your VidoraX account.',
  successAccessibilityLabel:
    'Password reset is not available yet. Return to login when you are ready.',
} as const;

export const AUTH_COLORS = {
  background: '#090B12',
  radialGlow: 'rgba(59, 130, 246, 0.11)',
  title: '#F8FAFC',
  subtitle: 'rgba(148, 163, 184, 0.78)',
  label: 'rgba(148, 163, 184, 0.9)',
  labelActive: '#93C5FD',
  inputBg: 'rgba(15, 18, 28, 0.92)',
  inputBorder: 'rgba(255, 255, 255, 0.1)',
  inputBorderFocus: '#3B82F6',
  inputBorderError: 'rgba(239, 68, 68, 0.85)',
  inputBorderSuccess: 'rgba(16, 185, 129, 0.85)',
  inputText: '#F8FAFC',
  placeholder: 'rgba(148, 163, 184, 0.45)',
  muted: 'rgba(148, 163, 184, 0.72)',
  accent: '#3B82F6',
  accentSoft: 'rgba(59, 130, 246, 0.22)',
  accentGlow: 'rgba(59, 130, 246, 0.35)',
  success: '#10B981',
  error: '#F87171',
  warning: '#F59E0B',
  buttonStart: '#2563EB',
  buttonEnd: '#3B82F6',
  buttonDisabled: 'rgba(37, 99, 235, 0.35)',
  divider: 'rgba(148, 163, 184, 0.22)',
  checkboxBorder: 'rgba(255, 255, 255, 0.18)',
  checkboxFill: '#3B82F6',
  strengthTrack: 'rgba(148, 163, 184, 0.18)',
  strengthWeak: '#F87171',
  strengthMedium: '#F59E0B',
  strengthStrong: '#10B981',
} as const;

export const AUTH_LAYOUT = {
  logoSize: 72,
  logoGlowSize: 96,
  maxContentWidth: 420,
  fieldHeight: 56,
  buttonHeight: 54,
  maxFontMultiplier: 1.3,
} as const;
