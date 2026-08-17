import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDsFcG_OVJn-cvrZGwx1eZLkbjTmtZsCJE",
  authDomain: "kia-shop-2c14d.firebaseapp.com",
  projectId: "kia-shop-2c14d",
  storageBucket: "kia-shop-2c14d.firebasestorage.app",
  messagingSenderId: "968189012895",
  appId: "1:968189012895:web:266cebe0718188b529ebaa",
  measurementId: "G-CVYP18GCJH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const analytics =
  typeof window !== "undefined"
    ? getAnalytics(app)
    : null;