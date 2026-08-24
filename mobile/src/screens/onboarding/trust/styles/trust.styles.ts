import { StyleSheet } from 'react-native';

import { TRUST_COLORS, TRUST_LAYOUT } from '../constants';

export const trustStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: TRUST_COLORS.background,
  },
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    paddingTop: 8,
  },
  copy: {
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    color: TRUST_COLORS.title,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  titleAccent: {
    color: TRUST_COLORS.titleAccent,
  },
  subtitle: {
    marginTop: 12,
    color: TRUST_COLORS.subtitle,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  workflow: {
    width: '100%',
    maxWidth: TRUST_LAYOUT.cardMaxWidth + 40,
    alignSelf: 'center',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
    maxWidth: TRUST_LAYOUT.cardMaxWidth + 24,
  },
  libraryZone: {
    width: '100%',
    maxWidth: TRUST_LAYOUT.cardMaxWidth,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    borderColor: TRUST_COLORS.libraryBorder,
    backgroundColor: TRUST_COLORS.libraryBg,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  libraryLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TRUST_COLORS.libraryLabel,
  },
});
