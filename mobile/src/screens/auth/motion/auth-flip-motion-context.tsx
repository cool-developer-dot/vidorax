import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { AuthCredentialFace } from '../constants/auth-flip.constants';

export type AuthFlipMotionValue = {
  /** 0 = sign-in face, 1 = sign-up face. */
  progress: SharedValue<number>;
  /** Which face role this subtree belongs to. */
  role: 'front' | 'back';
};

const AuthFlipMotionContext = createContext<AuthFlipMotionValue | null>(null);

export function AuthFlipMotionProvider({
  value,
  children,
}: {
  value: AuthFlipMotionValue;
  children: React.ReactNode;
}) {
  return (
    <AuthFlipMotionContext.Provider value={value}>
      {children}
    </AuthFlipMotionContext.Provider>
  );
}

export function useAuthFlipMotion(): AuthFlipMotionValue | null {
  return useContext(AuthFlipMotionContext);
}

export type AuthFaceRevealValue = {
  /** Increments each time this face should play its settle reveal. */
  revealKey: number;
  active: boolean;
  reduceMotion: boolean;
  face: AuthCredentialFace;
};

const AuthFaceRevealContext = createContext<AuthFaceRevealValue | null>(null);

export function AuthFaceRevealProvider({
  value,
  children,
}: {
  value: AuthFaceRevealValue;
  children: React.ReactNode;
}) {
  return (
    <AuthFaceRevealContext.Provider value={value}>
      {children}
    </AuthFaceRevealContext.Provider>
  );
}

export function useAuthFaceReveal(): AuthFaceRevealValue | null {
  return useContext(AuthFaceRevealContext);
}
