'use client';

import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/lib/firebase-auth';
import Image from 'next/image';
import UpgradeButton from "../UpgradeButton"
import { useAuthUser } from "@/lib/hooks/useAuthUser"

interface AuthPopupProps {
  message?: string | null;
  open: boolean;
  onClose: () => void;
}

export default function AuthPopup({ message, open, onClose }: AuthPopupProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const user = useAuthUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signInWithEmail(email, password);
        if (error) throw new Error(error);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error } = await signUpWithEmail(email, password);
        if (error) throw new Error(error);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) throw new Error(error);
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!open) return null;

  if (showPlans) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-2 sm:p-4 w-full max-w-2xl mx-2 shadow-xl overflow-auto max-h-[90vh] flex flex-col items-center justify-center border-2 border-[var(--color-primary)] relative" style={{height: 'fit-content'}}>
          <button onClick={onClose} aria-label="Close" className="absolute top-2 right-2 text-[var(--color-primary)] hover:text-white hover:bg-[var(--color-primary)] rounded-full p-1 transition-colors z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex justify-center mb-3">
            <Image src="/logo.png" alt="FlacronSport Logo" width={192} height={192} className="rounded" />
          </div>
          {message && (
            <div className="mb-2 text-center text-sm font-semibold text-[var(--color-primary)]">{message}</div>
          )}
          <h2 className="text-lg font-bold mb-3 text-center">Choose Your Plan</h2>
          
          <div className="flex flex-col md:flex-row gap-3 w-full items-stretch justify-center">
            {/* Free Plan */}
            <div className="border rounded-xl p-3 hover:shadow-lg transition-shadow bg-white flex-1 min-w-0">
              <h3 className="text-base font-bold mb-2 text-center">Free Plan</h3>
              <p className="text-xl font-bold mb-2 text-center">$0<span className="text-xs text-gray-500">/month</span></p>
              <ul className="space-y-1 mb-3 text-xs">
                {/* Only show premium features as crossed out in Free plan */}
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Full access to daily AI summaries
                </li>
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Early previews and exclusive insights
                </li>
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Daily email digest with bonus content
                </li>
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Ad-free experience
                </li>
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Multilingual content access
                </li>
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Custom dashboard & push alerts
                </li>
                <li className="flex items-center opacity-60">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Regional news filters and premium-only highlights
                </li>
              </ul>
              <button
                onClick={() => {
                  setShowPlans(false);
                  setIsLogin(false);
                }}
                className="w-full bg-[var(--color-primary)] text-white py-2 px-3 rounded-lg hover:bg-white hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] border-2 border-transparent transition-colors text-xs font-semibold"
              >
                Sign Up Free
              </button>
            </div>

            {/* Premium Plan */}
            <div className="border-2 border-[var(--color-primary)] rounded-xl p-3 hover:shadow-lg transition-shadow relative bg-white flex-1 min-w-0 mt-2 md:mt-0">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full text-xs">
                Most Popular
              </div>
              <h3 className="text-base font-bold mb-2 text-center">Premium Plan</h3>
              <p className="text-xl font-bold mb-2 text-center">$19.99<span className="text-xs text-gray-500">/month</span></p>
              <ul className="space-y-1 mb-3 text-xs">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  All Free features
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Full access to daily AI summaries
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Early previews and exclusive insights
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Daily email digest with bonus content
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Ad-free experience
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Multilingual content access
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Custom dashboard & push alerts
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Regional news filters and premium-only highlights
                </li>
              </ul>
              {user ? (
                <UpgradeButton customerId={user.uid} />
              ) : (
              <button
                onClick={() => {
                  setShowPlans(false);
                    setIsLogin(true);
                }}
                className="w-full bg-[var(--color-primary)] text-white py-2 px-3 rounded-lg hover:bg-white hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] border-2 border-transparent transition-colors text-xs font-semibold"
              >
                  Sign in to Upgrade
              </button>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setShowPlans(false);
                setIsLogin(true);
              }}
              className="text-gray-600 hover:text-[var(--color-primary)] transition-colors text-xs"
            >
              Already have an account? Log in
            </button>
          </div>

          <button 
            onClick={onClose}
            className="block w-full text-gray-500 hover:text-[var(--color-primary)] text-xs mt-4 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-2 sm:p-4 w-full max-w-2xl mx-2 shadow-xl overflow-auto max-h-[90vh] flex flex-col items-center justify-center border-2 border-[var(--color-primary)] relative" style={{height: 'fit-content'}}>
        <button onClick={onClose} aria-label="Close" className="absolute top-2 right-2 text-[var(--color-primary)] hover:text-white hover:bg-[var(--color-primary)] rounded-full p-1 transition-colors z-10">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex justify-center mb-3">
          <Image src="/logo.png" alt="FlacronSport Logo" width={192} height={192} className="rounded" />
        </div>
        {message && (
          <div className="mb-2 text-center text-sm font-semibold text-[var(--color-primary)]">{message}</div>
        )}
        <h2 className="text-lg font-bold mb-3 text-center">
          {isLogin ? 'Welcome Back!' : 'Join Our Community!'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] text-white py-2 px-4 rounded hover:bg-white hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] border-2 border-transparent transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
          >
            <Image src="/google-icon.svg" alt="Google" width={18} height={18} />
            Continue with Google
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gray-600 hover:text-[var(--color-primary)] transition-colors text-xs"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => setShowPlans(true)}
            className="text-gray-600 hover:text-[var(--color-primary)] transition-colors text-xs"
          >
            View Plans
          </button>
        </div>

        <button 
          onClick={onClose}
          className="block w-full text-gray-500 hover:text-[var(--color-primary)] text-xs mt-4 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
} 