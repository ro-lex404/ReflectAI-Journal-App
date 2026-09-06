import React from 'react';
import { Sparkles, LogOut, ShieldCheck, Database } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile;
  onSignOut: () => void;
  syncStatus?: 'synced' | 'saving' | 'error';
}

export const Navbar: React.FC<NavbarProps> = ({ user, onSignOut, syncStatus = 'synced' }) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-natural-border bg-natural-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-natural-olive text-natural-bg shadow-sm">
            <Sparkles className="h-5 w-5 text-[#f4f1ea]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-semibold tracking-tight text-natural-text">
                ReflectAI
              </span>
              <span className="inline-flex items-center rounded-md bg-natural-surface border border-natural-border px-2 py-0.5 text-xs font-medium text-natural-text-muted">
                Firestore Isolated
              </span>
            </div>
            <p className="hidden text-xs text-natural-text-muted sm:block">
              Private Journal &amp; Gemini 3.6 Flash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Firestore Sync Indicator */}
          <div className="hidden items-center gap-1.5 rounded-full bg-natural-surface px-3 py-1 text-xs text-natural-text-muted sm:flex border border-natural-border">
            <Database className="h-3.5 w-3.5 text-natural-text-light" />
            <span>
              {syncStatus === 'saving' && 'Saving changes...'}
              {syncStatus === 'synced' && 'Cloud Firestore sync active'}
              {syncStatus === 'error' && 'Sync pending retry'}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                syncStatus === 'saving'
                  ? 'bg-amber-600 animate-pulse'
                  : syncStatus === 'error'
                  ? 'bg-[#a34b3c]'
                  : 'bg-[#5a7d52]'
              }`}
            />
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-3 pl-2 border-l border-natural-border">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="h-8 w-8 rounded-full border border-natural-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-natural-olive text-xs font-medium text-natural-bg">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden text-left md:block">
              <p className="text-xs font-medium text-natural-text truncate max-w-[140px]">
                {user.displayName || 'Journal User'}
              </p>
              <p className="text-[11px] text-natural-text-muted truncate max-w-[140px]">
                {user.email}
              </p>
            </div>

            <button
              id="signout-button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-natural-border bg-natural-surface px-3 py-1.5 text-xs font-medium text-natural-text hover:bg-natural-surface-alt hover:border-natural-border-strong transition-colors focus:outline-none focus:ring-2 focus:ring-natural-olive/40 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
