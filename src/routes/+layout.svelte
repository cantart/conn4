<script lang="ts">
	import { auth, googleSignInWithPopup } from '$lib/firebase.client';
	import '../app.css';
	import { session } from '$lib/session.svelte';
	let { children } = $props();
	import { signOut, onAuthStateChanged } from 'firebase/auth';
	import { slide } from 'svelte/transition';
	import { doc, setDoc } from 'firebase/firestore';
	import { collections, type Doc } from '$lib/firestore';
	import { page } from '$app/stores';

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

<div
	class="scrollbar-thumb-white scrollbar-track-transparent flex min-h-screen flex-col items-center justify-center gap-4"
>
	<nav class="mt-2 flex items-center justify-center gap-4">
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
		{@render navEntry({ pathname: '/', label: 'offline' })}
		{@render navEntry({ pathname: '/multiplayer', label: 'online' })}
		{@render navEntry({ pathname: '/feedback', label: 'feedback' })}
	</nav>

	<div class="my-auto text-center">{@render children()}</div>
</div>

{#snippet navEntry(data: { pathname: string; label: string })}
	<a
		href={data.pathname}
		class="opacity-40 transition-all hover:opacity-100 {$page.url.pathname === data.pathname &&
			'cursor-auto underline decoration-pink-300 opacity-100'}">{data.label}</a
	>
{/snippet}
