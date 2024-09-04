import { initializeFirebase } from '$lib/firebase.client';
import { browser } from '$app/environment';

export async function load() {
	if (browser) {
		try {
			initializeFirebase();
		} catch (ex) {
			console.error(ex);
		}
	}

	return {};
}
