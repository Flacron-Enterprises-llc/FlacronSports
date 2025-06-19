'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, getAuth, onAuthStateChanged } from 'firebase/auth';
import dynamic from 'next/dynamic';

// Dynamically import AuthPopup to avoid hydration issues
const AuthPopup = dynamic(() => import('@/components/auth/AuthPopup'), { ssr: false });

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        setShowPopup(true);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  if (!user) {
    return showPopup ? <AuthPopup key="protected-route-popup" /> : null;
  }

  return <>{children}</>;
} 