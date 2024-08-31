<script lang="ts">
	import { auth, googleSignInWithPopup } from '$lib/firebase.client';
	import '../app.css';
	import { session } from '$lib/session.svelte';
	let { children } = $props();
	import { signOut, onAuthStateChanged } from 'firebase/auth';
	import { slide } from 'svelte/transition';
	import { doc, setDoc } from 'firebase/firestore';
	import { collections, type Doc } from '$lib/firestore';

	$effect(() => {
		onAuthStateChanged(auth, (user) => {
			session.setUser(user);
			// update user to db
			if (user) {
				const data: Doc['users'] = {
					displayName: user.displayName,
					photoURL: user.photoURL,
				};
				const docRef = doc(collections.userInfos(), user.uid);
				setDoc(docRef, data);
			}
		});
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
	<nav class="mb-2 flex items-center justify-center gap-4">
		{#if session.data.ready}
			{#if session.data.user}
				<span class="flex items-center gap-2">
					<img
						class="h-5 w-5 rounded-full"
						in:slide={{
							delay: 100,
						}}
						src={session.data.user.photoURL}
						alt=""
					/>
					<button
						class="opacity-40 transition-all hover:opacity-100"
						onclick={() => {
							signOut(auth);
						}}>logout</button
					>
				</span>
			{:else}
				<button class="opacity-40 transition-all hover:opacity-100" onclick={googleSignInWithPopup}
					>login</button
				>
			{/if}
		{/if}
		<a href="/" class="opacity-40 transition-all hover:opacity-100">offline</a>
		<!-- {#if import.meta.env.DEV} -->
		<a href="/multiplayer" class="opacity-40 transition-all hover:opacity-100">online</a>
		<!-- {/if} -->
	</nav>

	<div class="my-auto text-center">{@render children()}</div>
</div>
