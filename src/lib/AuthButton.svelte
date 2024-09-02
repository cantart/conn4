<script lang="ts">
	import { auth, googleSignInWithPopup } from '$lib/firebase.client';
	import { session } from './session.svelte';
	import { signOut } from 'firebase/auth';

	let props: {
		size?: 'btn-xs' | 'btn-sm' | 'btn-md' | 'btn-lg';
	} = $props();

	const tipData = $derived(() => {
		if (!session.data.ready || !session.data.user) {
			return undefined;
		}
		return 'Click to logout';
	});
</script>

<div class="tooltip tooltip-bottom" data-tip={tipData()}>
	<button
		class="btn btn-primary {props.size} {(!session.data.ready ||
			(session.data.ready && session.data.user)) &&
			'btn-ghost'}"
		onclick={() => {
			if (!session.data.ready) {
				return;
			}
			if (session.data.user) {
				signOut(auth);
			} else {
				googleSignInWithPopup();
			}
		}}
	>
		{#if session.data.ready}
			{#if session.data.user}
				<div class="avatar">
					<div class="h-5 rounded-full">
						<img src={session.data.user.photoURL} alt="" />
					</div>
				</div>
				{session.data.user.displayName}{:else}<svg
					xmlns="http://www.w3.org/2000/svg"
					width="1.2em"
					height="1.2em"
					viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
					/></svg
				>Login{/if}
		{:else}
			<span class="loading loading-spinner loading-xs"></span>
		{/if}
	</button>
</div>
