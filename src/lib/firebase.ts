import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Interaction } from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore targeting the configured database ID
export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Strict undefined-stripping utility (Zero-Crash Payload Hygiene)
 * Eliminates undefined values before saving to Firestore to prevent driver rejections.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

/**
 * Trigger secure Google Sign-In popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign out the currently authenticated user
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Listen to Authentication state changes
 */
export function subscribeToAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

/**
 * Saves or updates a user-isolated interaction record under /users/{userId}/interactions/{interactionId}
 */
export async function saveUserInteraction(
  userId: string,
  interactionData: Omit<Interaction, 'id' | 'userId'> & { id?: string; userId?: string },
  existingId?: string
): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required to save an interaction.');
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const targetDocRef = existingId
    ? doc(interactionsRef, existingId)
    : (interactionData.id ? doc(interactionsRef, interactionData.id) : doc(interactionsRef));

  const finalId = targetDocRef.id;

  const payload: Interaction = {
    ...interactionData,
    id: finalId,
    userId,
    updatedAt: Date.now(),
  };

  const cleanPayload = stripUndefined(payload);
  await setDoc(targetDocRef, cleanPayload, { merge: true });
  return finalId;
}

/**
 * Subscribes to real-time updates for a user's isolated interactions
 */
export function subscribeUserInteractions(
  userId: string,
  onData: (interactions: Interaction[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Interaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Interaction;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      console.error('Firestore snapshot subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Deletes a user interaction record
 */
export async function deleteUserInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) {
    throw new Error('Both userId and interactionId are required to delete an interaction.');
  }
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(docRef);
}
