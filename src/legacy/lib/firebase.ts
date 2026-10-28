import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, setDoc, updateDoc, DocumentReference } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
  authDomain: "andrade-agro.firebaseapp.com",
  projectId: "andrade-agro",
  storageBucket: "andrade-agro.firebasestorage.app",
  messagingSenderId: "271695349839",
  appId: "1:271695349839:web:4428ed928e6423b9adc23a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Log technical diagnostic information (ETAPA 6)
function logTechnicalDiagnostics() {
  console.groupCollapsed("[Andrade Agro - Diagnóstico Firebase]");
  console.log("Firebase Project ID:", firebaseConfig.projectId);
  console.log("Firebase App ID:", firebaseConfig.appId);
  console.log("Firestore Database ID:", "(default)");
  console.log("Firestore Region:", "southamerica-east1");
  console.log("Firebase Auth currentUser:", auth.currentUser ? auth.currentUser.uid : null);
  console.log("Firebase Auth UID:", auth.currentUser?.uid || "Não autenticado");
  console.groupEnd();
}

logTechnicalDiagnostics();

// Listen to auth state changes to keep diagnostics updated
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`[Firebase Auth] Sessão ativa: UID=${user.uid}`);
  } else {
    console.log("[Firebase Auth] Nenhuma sessão ativa no momento");
  }
});

let pendingAuthPromise: Promise<FirebaseUser | null> | null = null;

/**
 * Ensures a valid Firebase Authentication session is established.
 * Attempts anonymous sign-in if no currentUser exists, avoiding duplicate in-flight requests.
 */
export async function ensureFirebaseAuth(): Promise<FirebaseUser | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = (async () => {
    try {
      const cred = await signInAnonymously(auth);
      console.log(`[Firebase Auth] Autenticado com sucesso: UID=${cred.user.uid}`);
      return cred.user;
    } catch (error: any) {
      if (error?.code === 'auth/configuration-not-found') {
        console.info("[Firebase Auth] Provedor anônimo aguardando ativação no console.");
      } else {
        console.warn("[Firebase Auth] Aviso ao verificar sessão:", error?.message || error);
      }
      return null;
    } finally {
      pendingAuthPromise = null;
    }
  })();

  return pendingAuthPromise;
}

// Helper to remove any undefined properties before writing to Firestore
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function safeSetDoc(docRef: DocumentReference, data: any) {
  return setDoc(docRef, sanitizeForFirestore(data));
}

export function safeUpdateDoc(docRef: DocumentReference, data: any) {
  return updateDoc(docRef, sanitizeForFirestore(data));
}



