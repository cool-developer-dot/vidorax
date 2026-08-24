/**
 * Yield until after NavigationContainerInner has committed.
 *
 * expo-router's useLinking calls setLastUnhandledLink inside the
 * getInitialURL Promise chain during the container's first render.
 * If that Promise settles before commit, React 19 / Fabric warns:
 * "Can't perform a React state update on a component that hasn't mounted yet"
 * (useLinking.native.js → onUnhandledLinking).
 *
 * requestAnimationFrame runs after paint (post-commit). Nested rAF +
 * setTimeout covers Hermes / Fabric where a single rAF can still land
 * inside the mount window. Avoid InteractionManager/setImmediate —
 * they can flush in the pre-commit microtask window on Hermes.
 */
export function afterNavigationContainerReady(): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      setTimeout(resolve, 0);
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(finish);
      });
      return;
    }

    // Extremely defensive fallback (tests / unusual runtimes).
    setTimeout(() => {
      setTimeout(resolve, 0);
    }, 0);
  });
}
