import React, { useState } from 'react';
import { Sparkles, Shield, Lock, BrainCircuit, ArrowRight, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface LandingPageProps {
  onSignInSuccess?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignInSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      await signInWithGoogle();
      if (onSignInSuccess) onSignInSuccess();
    } catch (err: any) {
      console.error('Sign in error:', err);
      // Don't show cryptic error if user closed the popup window
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign in was cancelled. Please try again.');
      } else {
        setAuthError(err?.message || 'Failed to authenticate with Google. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg flex flex-col justify-between text-natural-text">
      {/* Top Header */}
      <header className="border-b border-natural-border bg-natural-bg/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-natural-olive text-natural-bg">
              <Sparkles className="h-4 w-4 text-[#f4f1ea]" />
            </div>
            <span className="font-serif text-lg font-semibold text-natural-text">
              ReflectAI
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-natural-text-muted">
            <Shield className="h-4 w-4 text-natural-olive" />
            <span>Encrypted Firestore Isolation</span>
          </div>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-natural-border bg-natural-surface p-8 sm:p-10 shadow-xs">
            {/* Header / Intro */}
            <div className="text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-natural-border bg-natural-bg px-3.5 py-1 text-xs font-medium text-natural-text-muted">
                <BrainCircuit className="h-3.5 w-3.5 text-natural-olive" />
                <span>Powered by Gemini 3.6 Flash</span>
              </div>

              <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight text-natural-text sm:text-4xl">
                Personal Reflection &amp; AI Journaling
              </h1>

              <p className="mt-4 text-base leading-relaxed text-natural-text-muted">
                Write freely, explore thoughts through multi-turn dialogue, and receive thoughtful syntheses from Gemini. Your entries are isolated strictly to your account in Cloud Firestore.
              </p>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="mt-6 rounded-xl border border-[#e8c2ba] bg-[#faf2f0] p-4 text-xs text-[#8a3324] flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-[#b84a37] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Authentication Error</p>
                  <p className="mt-0.5 text-[#8a3324]">{authError}</p>
                </div>
              </div>
            )}

            {/* Google Sign In Action */}
            <div className="mt-8 flex flex-col items-center">
              <button
                id="google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-natural-border-strong bg-natural-card px-6 py-3.5 text-sm font-medium text-natural-text hover:bg-natural-bg hover:border-natural-olive transition-all focus:outline-none focus:ring-2 focus:ring-natural-olive/40 disabled:opacity-60 shadow-xs cursor-pointer"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-natural-border border-t-natural-olive" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{isLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              <p className="mt-3 text-center text-xs text-natural-text-muted">
                Passwordless federated authentication. We never handle or store raw credentials.
              </p>
            </div>

            {/* Security Guarantee Box */}
            <div className="mt-8 border-t border-natural-border pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-natural-text-muted">
                Security &amp; Data Integrity Guarantees
              </h2>
              <ul className="mt-3 space-y-2.5 text-xs text-natural-text">
                <li className="flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-natural-olive shrink-0 mt-0.5" />
                  <span>
                    <strong>Owner-Bound Isolation:</strong> Firestore rules enforce{' '}
                    <code className="bg-natural-bg border border-natural-border px-1 py-0.5 rounded text-[11px] font-mono text-natural-olive">
                      request.auth.uid == userId
                    </code>
                    . Other users cannot query or access your records.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <BrainCircuit className="h-3.5 w-3.5 text-natural-olive shrink-0 mt-0.5" />
                  <span>
                    <strong>Server-Side Secret Management:</strong> Gemini API keys stay securely on the backend server, never exposed in client bundles.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-natural-olive shrink-0 mt-0.5" />
                  <span>
                    <strong>Resilient Fallback Ladder:</strong> Continuous availability with automated Gemini 3.6 Flash fallback chains.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-natural-border bg-natural-bg py-4 text-center text-xs text-natural-text-muted">
        ReflectAI &bull; Cloud Run Ready &bull; Firestore Document Isolation
      </footer>
    </div>
  );
};
