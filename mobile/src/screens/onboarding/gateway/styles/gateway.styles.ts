import { StyleSheet } from 'react-native';

import { GATEWAY_COLORS, GATEWAY_LAYOUT } from '../constants/gateway.constants';

export const gatewayStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GATEWAY_COLORS.background,
  },
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
  },
  hero: {
    flex: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  logoWrap: {
    width: GATEWAY_LAYOUT.logoSize,
    height: GATEWAY_LAYOUT.logoSize,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: GATEWAY_LAYOUT.logoGlowSize,
    height: GATEWAY_LAYOUT.logoGlowSize,
    borderRadius: GATEWAY_LAYOUT.logoGlowSize / 2,
    backgroundColor: GATEWAY_COLORS.logoGlow,
  },
  logo: {
    width: GATEWAY_LAYOUT.logoSize,
    height: GATEWAY_LAYOUT.logoSize,
    backgroundColor: 'transparent',
  },
  copy: {
    paddingBottom: 8,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: GATEWAY_COLORS.title,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  titleAccent: {
    color: GATEWAY_COLORS.titleAccent,
  },
  subtitle: {
    marginTop: 12,
    color: GATEWAY_COLORS.subtitle,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
});
