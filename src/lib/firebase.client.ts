import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { browser } from '$app/environment';

export let db: Firestore;
export let app: FirebaseApp;
export let auth: Auth;

const firebaseConfig = {
	apiKey: 'AIzaSyAXsv_EdGzJw4UYCDdkLMnXEyEb_lZIz1s',
	authDomain: 'fial-the-game.firebaseapp.com',
	projectId: 'fial-the-game',
	storageBucket: 'fial-the-game.appspot.com',
	messagingSenderId: '9162154050',
	appId: '1:9162154050:web:485c1425bedcb0bc098ddb'
};

export const initializeFirebase = () => {
	if (!browser) {
		throw new Error("Can't use the Firebase client on the server.");
	}
	if (!app) {
		app = initializeApp(firebaseConfig);
		auth = getAuth(app);
	}
};

export const googleSignInWithPopup = async () => {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider);
};
