/**
 * Auth gate: Google sign-in, locked to the owner email. Firestore rules
 * enforce the same lock server-side — this is just the UI half.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { googleProvider, isFirebaseConfigured, OWNER_EMAIL, requireAuth } from './firebase';

interface AuthState {
  status: 'loading' | 'signed_out' | 'unauthorized' | 'signed_in';
  user: User | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(requireAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const status: AuthState['status'] = loading
    ? 'loading'
    : user === null
      ? 'signed_out'
      : user.email === OWNER_EMAIL
        ? 'signed_in'
        : 'unauthorized';

  const value: AuthState = {
    status,
    user,
    signIn: async () => {
      await signInWithPopup(requireAuth(), googleProvider);
    },
    signOutUser: async () => {
      await signOut(requireAuth());
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
