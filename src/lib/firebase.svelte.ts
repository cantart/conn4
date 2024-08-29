import type { FirebaseApp } from 'firebase/app';

let _app: FirebaseApp | null = $state(null);

export const setFireBaseApp = (app: FirebaseApp) => {
	_app = app;
};

export const firebase = () => {
	if (!_app) {
		throw new Error('Firebase app not initialized');
	}
	return _app;
};
