import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebaseConfig";

/**
 * Redirect, not popup: this app is used as an iOS home-screen PWA, where
 * popup-based OAuth is unreliable/blocked in standalone mode. A top-level
 * redirect navigation works there.
 */
export function signInWithGoogle(): Promise<void> {
  if (!auth) return Promise.resolve();
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

/** Signs out of the cloud account only — never touches local schedule/settings data. */
export function signOutUser(): Promise<void> {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  if (!auth) {
    // Matches Firebase's own async-callback contract so callers can safely
    // reference values (e.g. an unsubscribe function) assigned right after this call.
    queueMicrotask(() => callback(null));
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

/** Call once at boot to resolve a pending signInWithRedirect(), including surfacing its error. */
export async function resolveRedirectResult(): Promise<void> {
  if (!auth) return;
  try {
    await getRedirectResult(auth);
  } catch {
    // Swallowed: a failed sign-in redirect should not block the app from loading.
    // The user simply remains signed out and can retry from Settings.
  }
}
