import { memo, type ReactNode } from 'react';
import { StatusBar, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGatewaySequence } from './animations';
import { GatewayBackground, GatewayCopy, GatewayLogo } from './components';
import { GATEWAY_COLORS } from './constants';
import { useTranslation } from '@/localization';
import { HeroEcosystem } from './HeroEcosystem';
import { gatewayStyles } from './styles';

type GatewayScreenProps = {
  footer?: ReactNode;
  enabled?: boolean;
};

/**
 * Onboarding Screen 1 — "The Gateway"
 * Capability ecosystem around the official VidoraX logo.
 */
export const GatewayScreen = memo(function GatewayScreen({
  footer,
  enabled = true,
}: GatewayScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sequence = useGatewaySequence({ enabled });

  const footerFade = useAnimatedStyle(() => ({
    opacity: sequence.footerOpacity.value,
  }));

  return (
    <View
      style={gatewayStyles.root}
      testID="onboarding-gateway"
      accessibilityLabel={t('onboarding.gatewayA11y')}>
      <StatusBar barStyle="light-content" backgroundColor={GATEWAY_COLORS.background} />

      <GatewayBackground opacity={sequence.backgroundOpacity} />

      <View style={[gatewayStyles.safe, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={gatewayStyles.body}>
          <View style={gatewayStyles.hero}>
            <HeroEcosystem
              enabled={enabled}
              center={
                <GatewayLogo
                  opacity={sequence.logoOpacity}
                  scale={sequence.logoScale}
                  translateY={sequence.logoTranslateY}
                  glow={sequence.logoGlow}
                  breath={sequence.logoBreath}
                />
              }
            />
          </View>

          <GatewayCopy opacity={sequence.copyOpacity} translateY={sequence.copyTranslateY} />
        </View>

        {footer ? <Animated.View style={footerFade}>{footer}</Animated.View> : null}
      </View>
    </View>
  );
});
