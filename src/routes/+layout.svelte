<script lang="ts">
	import { auth, googleSignInWithPopup } from '$lib/firebase.client';
	import '../app.css';
	import { session } from '$lib/session.svelte';
	let { children } = $props();
	import { signOut, onAuthStateChanged } from 'firebase/auth';

	$effect(() => {
		onAuthStateChanged(auth, (user) => {
			session.setUser(user);
		});
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
	<div class="my-auto text-center">{@render children()}</div>
	<footer class="mb-2 space-x-4">
		{#if session.data.ready}
			{#if session.data.user}
				<button
					class="opacity-40 transition-all hover:opacity-100"
					onclick={() => {
						signOut(auth);
					}}>logout</button
				>
			{:else}
				<button class="opacity-40 transition-all hover:opacity-100" onclick={googleSignInWithPopup}
					>login</button
				>
			{/if}
		{/if}
		<a href="/" class="opacity-40 transition-all hover:opacity-100">offline</a>
		{#if import.meta.env.DEV}
			<a href="/multiplayer" class="opacity-40 transition-all hover:opacity-100">online</a>
		{/if}
	</footer>
</div>
