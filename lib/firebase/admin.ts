import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY || "";
  return key.replace(/\\n/g, "\n");
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: getPrivateKey(),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp).bucket();
