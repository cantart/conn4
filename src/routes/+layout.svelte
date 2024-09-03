<script lang="ts">
	import { auth } from '$lib/firebase.client';
	import '../app.css';
	import { session } from '$lib/session.svelte';
	let { children } = $props();
	import { onAuthStateChanged } from 'firebase/auth';
	import { doc, setDoc } from 'firebase/firestore';
	import { collections, type Doc } from '$lib/firestore';
	import { page } from '$app/stores';
	import AuthButton from '$lib/AuthButton.svelte';
	import { theme } from '$lib/theme.svelte';

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
	class="flex min-h-screen flex-col items-center justify-center gap-2 scrollbar-track-transparent scrollbar-thumb-white"
	data-theme={theme.value}
>
	<nav class="mt-2 flex flex-wrap items-center justify-center">
		<AuthButton size="btn-sm" />
		<div role="tablist" class="tabs tabs-bordered">
			{@render tab({ pathname: '/', label: 'offline' })}
			{@render tab({ pathname: '/multiplayer', label: 'online' })}
			{@render tab({ pathname: '/feedback', label: 'feedback' })}
			{@render tab({ pathname: '/theme', label: 'theme' })}
		</div>
	</nav>

	<div class="flex grow flex-col items-center justify-center">{@render children()}</div>
</div>

{#snippet tab(data: { pathname: string; label: string })}
	<a
		href={data.pathname}
		class:tab-active={$page.url.pathname === data.pathname}
		class="tab transition-all hover:opacity-100">{data.label}</a
	>
{/snippet}
