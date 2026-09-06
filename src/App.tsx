import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { HistorySidebar } from './components/HistorySidebar';
import { JournalEditor } from './components/JournalEditor';
import type { Interaction, UserProfile } from './types';
import {
  subscribeToAuth,
  signOutUser,
  subscribeUserInteractions,
  deleteUserInteraction,
} from './lib/firebase';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore user interactions state
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
        setInteractions([]);
        setSelectedInteraction(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore real-time updates for authenticated user
  useEffect(() => {
    if (!user?.uid) {
      setInteractions([]);
      return;
    }

    const unsubscribe = subscribeUserInteractions(
      user.uid,
      (items) => {
        setInteractions(items);
        setSyncStatus('synced');

        // If an item is currently selected, keep its reference updated
        if (selectedInteraction) {
          const freshItem = items.find((i) => i.id === selectedInteraction.id);
          if (freshItem) {
            setSelectedInteraction(freshItem);
          }
        }
      },
      (err) => {
        console.error('Firestore sync error:', err);
        setSyncStatus('error');
      }
    );

    return () => unsubscribe();
  }, [user?.uid, selectedInteraction?.id]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleSelectInteraction = (item: Interaction) => {
    setSelectedInteraction(item);
  };

  const handleNewInteraction = () => {
    setSelectedInteraction(null);
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!user?.uid) return;
    try {
      await deleteUserInteraction(user.uid, id);
      if (selectedInteraction?.id === id) {
        setSelectedInteraction(null);
      }
    } catch (err) {
      console.error('Failed to delete interaction:', err);
      throw err;
    }
  };

  const handleSaveSuccess = (saved: Interaction) => {
    setSelectedInteraction(saved);
    setSyncStatus('synced');
  };

  // Initial authentication loading state
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-natural-bg text-natural-text">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-natural-olive text-natural-bg shadow-sm animate-pulse">
            <Sparkles className="h-6 w-6 text-[#e8dfc7]" />
          </div>
          <p className="text-xs font-medium text-natural-text-muted">Initializing ReflectAI...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated user -> Landing Page
  if (!user) {
    return <LandingPage />;
  }

  // Authenticated user -> Private Dashboard
  return (
    <div className="min-h-screen bg-natural-bg text-natural-text flex flex-col">
      <Navbar
        user={user}
        onSignOut={handleSignOut}
        syncStatus={syncStatus}
      />

      <div className="flex-1 flex overflow-hidden">
        <HistorySidebar
          interactions={interactions}
          selectedId={selectedInteraction?.id || null}
          onSelectInteraction={handleSelectInteraction}
          onNewInteraction={handleNewInteraction}
          onDeleteInteraction={handleDeleteInteraction}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <JournalEditor
          user={user}
          currentInteraction={selectedInteraction}
          onSaveSuccess={handleSaveSuccess}
          onDeleteInteraction={handleDeleteInteraction}
          onToggleSidebarMobile={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />
      </div>
    </div>
  );
}
