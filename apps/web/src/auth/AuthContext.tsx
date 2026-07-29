import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { firebaseAuth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      async signInWithGoogle() {
        if (!firebaseAuth) {
          throw new Error('Firebase não configurado');
        }
        await signInWithPopup(firebaseAuth, googleProvider);
      },
      async logout() {
        if (!firebaseAuth) return;
        await signOut(firebaseAuth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
