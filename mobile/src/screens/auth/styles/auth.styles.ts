import { StyleSheet } from 'react-native';

import { AUTH_COLORS, AUTH_LAYOUT } from '../constants';

export const authStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
  },
  content: {
    width: '100%',
    maxWidth: AUTH_LAYOUT.maxContentWidth,
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrap: {
    width: AUTH_LAYOUT.logoSize,
    height: AUTH_LAYOUT.logoSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logoGlow: {
    position: 'absolute',
    width: AUTH_LAYOUT.logoGlowSize,
    height: AUTH_LAYOUT.logoGlowSize,
    borderRadius: AUTH_LAYOUT.logoGlowSize / 2,
    backgroundColor: AUTH_COLORS.radialGlow,
  },
  logo: {
    width: AUTH_LAYOUT.logoSize,
    height: AUTH_LAYOUT.logoSize,
  },
  title: {
    color: AUTH_COLORS.title,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    color: AUTH_COLORS.subtitle,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  form: {
    gap: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  formError: {
    color: AUTH_COLORS.error,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
    gap: 8,
  },
  footerPrompt: {
    color: AUTH_COLORS.muted,
    fontSize: 14,
    letterSpacing: 0.15,
  },
  footerLink: {
    color: AUTH_COLORS.accent,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
