import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Each variable is read as `import.meta.env.X` on purpose: aliasing the whole
// `import.meta.env` object makes Vite inline every VITE_* variable into the bundle.

/** True only when every required Firebase env var is set. Cloud sync is fully optional and must degrade gracefully when false. */
export const isSyncConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
);

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  /**
   * In production the auth helper pages must come from the app's own origin:
   * browsers block the cross-site storage that the default
   * <project>.firebaseapp.com helper needs, so signInWithRedirect would come
   * back signed out. vercel.json proxies /__/auth/* to Firebase to make this
   * work. The local dev server has no such proxy and keeps the default.
   * https://firebase.google.com/docs/auth/web/redirect-best-practices
   */
  authDomain: import.meta.env.DEV ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : window.location.host,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isSyncConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export const auth = authInstance;
export const db = dbInstance;
