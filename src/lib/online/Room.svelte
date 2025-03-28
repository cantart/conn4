<script lang="ts">
	import type { SubscriptionHandle } from '$lib';
	import { onDestroy } from 'svelte';

	let {
		allJoinRoomHandle
	}: {
		allJoinRoomHandle: SubscriptionHandle;
	} = $props();

	onDestroy(() => {
		if (allJoinRoomHandle.isActive()) {
			allJoinRoomHandle.unsubscribe();
		}
	});
</script>

<h1>You are in the room!</h1>
