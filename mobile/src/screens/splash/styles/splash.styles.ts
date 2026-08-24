import { StyleSheet } from 'react-native';

import { SPLASH_COLORS, SPLASH_LAYOUT } from '../constants/splash.constants';

export const splashStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  brandLetter: {
    color: SPLASH_COLORS.brandText,
    fontSize: SPLASH_LAYOUT.brandFontSize,
    lineHeight: SPLASH_LAYOUT.brandFontSize + 8,
    letterSpacing: SPLASH_LAYOUT.brandLetterSpacing,
    fontWeight: '600',
    marginHorizontal: SPLASH_LAYOUT.letterGap,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 10,
  },
  taglineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taglineWord: {
    color: SPLASH_COLORS.taglineText,
    fontSize: SPLASH_LAYOUT.taglineFontSize,
    lineHeight: SPLASH_LAYOUT.taglineFontSize + 4,
    letterSpacing: SPLASH_LAYOUT.taglineLetterSpacing,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  taglineDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: SPLASH_COLORS.taglineDot,
  },
});
