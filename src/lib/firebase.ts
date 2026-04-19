import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/**
 * Validates the connection to Firestore as required by system instructions.
 */
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection verified.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Client is offline.");
    } else {
      console.error("Firestore connection test failed:", error);
    }
  }
}

/**
 * Ensures the user is signed in to interact with the database.
 * Switched to Google Popup for better compatibility with platform defaults.
 */
export async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInWithPopup(auth, provider);
      console.log("Signed in with Google to Firebase.");
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.warn("User closed the auth popup.");
      } else {
        console.error("Error signing in with Google:", error);
      }
    }
  }
}
