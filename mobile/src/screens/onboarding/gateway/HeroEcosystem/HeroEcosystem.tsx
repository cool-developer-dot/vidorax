import { memo, type ReactNode } from 'react';

import { HeroOrbit } from './HeroOrbit';
import { useHeroEcosystemSequence } from './useHeroEcosystemSequence';
import { useHeroOrbitLayout } from './useHeroOrbitLayout';

type HeroEcosystemProps = {
  center: ReactNode;
  enabled?: boolean;
};

/**
 * Premium capability ecosystem around the VidoraX logo.
 * Logo is supplied as `center` and is never modified here.
 */
export const HeroEcosystem = memo(function HeroEcosystem({
  center,
  enabled = true,
}: HeroEcosystemProps) {
  const layout = useHeroOrbitLayout();
  const sequence = useHeroEcosystemSequence({ enabled });

  return (
    <HeroOrbit
      size={layout.size}
      positions={layout.positions}
      icons={sequence.icons}
      focusOpacity={sequence.focusOpacity}
      center={center}
    />
  );
});
