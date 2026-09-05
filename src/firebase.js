import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDJJsAMUsHtIaeRc-6PF0Vmc9uiO7zXr2M",
  authDomain: "ondok-6d0f5.firebaseapp.com",
  projectId: "ondok-6d0f5",
  storageBucket: "ondok-6d0f5.firebasestorage.app",
  messagingSenderId: "692276850963",
  appId: "1:692276850963:web:7f33ff219a091fe474aae6"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
