import { initializeFirebase } from '$lib/firebase.client';
import { browser } from '$app/environment';
// import { themeChange } from 'theme-change';

export async function load() {
	if (browser) {
		// themeChange(false);

		try {
			initializeFirebase();
		} catch (ex) {
			console.error(ex);
		}
	}

	return {};
}
