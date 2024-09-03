import { initializeFirebase } from '$lib/firebase.client';
import { browser } from '$app/environment';
import { theme } from '$lib/theme.svelte';

export async function load() {
	if (browser) {
		theme.loadSavedTheme();
		try {
			initializeFirebase();
		} catch (ex) {
			console.error(ex);
		}
	}

	return {};
}
