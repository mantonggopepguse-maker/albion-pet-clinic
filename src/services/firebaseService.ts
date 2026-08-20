import type { FirebaseApp } from 'firebase/app';
import type { Auth, UserCredential } from 'firebase/auth';
import type { Messaging } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const getMissingFirebaseVariables = (): string[] => {
    const required = [
        ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
        ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
        ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
        ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
    ];

    return required.filter(([, value]) => !value).map(([name]) => name);
};

let appPromise: Promise<FirebaseApp> | undefined;
let authPromise: Promise<Auth> | undefined;

/** Loads the large Firebase SDK only when a Firebase feature is actually used. */
const getFirebaseApp = (): Promise<FirebaseApp> => {
    if (!appPromise) {
        appPromise = (async () => {
            const missing = getMissingFirebaseVariables();
            if (missing.length > 0) {
                throw new Error(`Firebase is not configured. Missing: ${missing.join(', ')}`);
            }

            const { getApps, initializeApp } = await import('firebase/app');
            return getApps()[0] || initializeApp(firebaseConfig);
        })();
    }

    return appPromise;
};

const getFirebaseAuth = (): Promise<Auth> => {
    if (!authPromise) {
        authPromise = (async () => {
            const [{ getAuth }, app] = await Promise.all([
                import('firebase/auth'),
                getFirebaseApp(),
            ]);
            return getAuth(app);
        })();
    }

    return authPromise;
};

export const signInWithFirebaseEmail = async (
    email: string,
    password: string,
): Promise<UserCredential> => {
    const [{ signInWithEmailAndPassword }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
    ]);
    return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
};

export const createFirebaseEmailAccount = async (
    email: string,
    password: string,
): Promise<UserCredential> => {
    const [{ createUserWithEmailAndPassword }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
    ]);
    return createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
};

export const signInWithGoogle = async (): Promise<UserCredential> => {
    const [{ GoogleAuthProvider, signInWithPopup }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
    ]);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider);
};

export const getFirebaseIdToken = (credential: UserCredential): Promise<string> =>
    credential.user.getIdToken();

let messagingInstance: Messaging | null | undefined;

const getFirebaseMessaging = async (): Promise<Messaging | null> => {
    if (messagingInstance !== undefined) return messagingInstance;
    if (!('Notification' in window)) {
        messagingInstance = null;
        return null;
    }

    const [{ getMessaging, isSupported }, app] = await Promise.all([
        import('firebase/messaging'),
        getFirebaseApp(),
    ]);
    const supported = await isSupported().catch(() => false);
    messagingInstance = supported ? getMessaging(app) : null;
    return messagingInstance;
};

export const requestFcmToken = async (): Promise<string | null> => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const serviceWorkerRegistration = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined)
        : undefined;
    const { getToken } = await import('firebase/messaging');

    return getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
    }).catch((err) => {
        console.error('FCM token request failed:', err);
        return null;
    });
};
