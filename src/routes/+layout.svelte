<script lang="ts">
	import { auth } from '$lib/firebase.client';
	import '../app.css';
	import { session } from '$lib/session.svelte';
	let { children } = $props();
	import { onAuthStateChanged } from 'firebase/auth';
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

	const pages = [
		{ pathname: '/', label: 'offline', icon: '😪' },
		{ pathname: '/multiplayer', label: 'online', icon: '🤼' },
		{ pathname: '/theme', label: 'theme', icon: '🎨' },
		{ pathname: '/feedback', label: 'feedback', icon: '💬' },
	] as const;
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center gap-2 scrollbar-track-transparent scrollbar-thumb-white"
>
	<div class="navbar bg-base-100">
		<div class="navbar-start sm:invisible">
			<div class="dropdown">
				<div tabindex="0" role="button" class="btn btn-circle btn-ghost">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h7"
						/>
					</svg>
				</div>
				<ul class="menu dropdown-content z-[1] w-40 rounded-box bg-base-100 p-2 shadow">
					{#each pages as p}
						<li>
							<a href={p.pathname} class:active={$page.url.pathname === p.pathname}>
								{p.icon}
								{p.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
		<div class="navbar-center hidden sm:block">
			<ul class="menu menu-horizontal rounded-box bg-base-200">
				{#each pages as p}
					<li>
						<a href={p.pathname} class:active={$page.url.pathname === p.pathname}>
							{p.icon}
							{#if $page.url.pathname === p.pathname}
								{p.label}
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</div>
		<div class="navbar-end"></div>
	</div>

	<div class="flex grow flex-col items-center justify-center">{@render children()}</div>
</div>
