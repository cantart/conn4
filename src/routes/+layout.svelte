<script lang="ts">
	// import { onGoogleScriptLoad } from '$lib/google';
	import '../app.css';
	let { children, data } = $props();
	import { initializeApp } from 'firebase/app';
	import { setFireBaseApp } from '$lib/firebase.svelte';

	// Import the functions you need from the SDKs you need
	// TODO: Add SDKs for Firebase products that you want to use
	// https://firebase.google.com/docs/web/setup#available-libraries

	const firebaseConfig = {
		apiKey: 'AIzaSyAXsv_EdGzJw4UYCDdkLMnXEyEb_lZIz1s',
		authDomain: 'fial-the-game.firebaseapp.com',
		projectId: 'fial-the-game',
		storageBucket: 'fial-the-game.appspot.com',
		messagingSenderId: '9162154050',
		appId: '1:9162154050:web:485c1425bedcb0bc098ddb'
	};

	// Initialize Firebase
	const app = initializeApp(firebaseConfig);
	setFireBaseApp(app);
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
	<div class="my-auto text-center">{@render children()}</div>
	<footer class="mb-2 space-x-4">
		{#if import.meta.env.DEV}
			{#if data.user}
				<form method="post" action="/login?/logout" class="inline">
					<button type="submit" class="opacity-40 transition-all hover:opacity-100">logout</button>
				</form>
			{:else}
				<a href="/login" class="opacity-40 transition-all hover:opacity-100">login</a>
			{/if}
		{/if}
		<a href="/" class="opacity-40 transition-all hover:opacity-100">offline</a>
		{#if import.meta.env.DEV}
			<a href="/multiplayer" class="opacity-40 transition-all hover:opacity-100">online</a>
		{/if}
	</footer>
</div>
