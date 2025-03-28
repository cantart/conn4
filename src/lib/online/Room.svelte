<script lang="ts">
	import type { SubscriptionHandle } from '$lib';
	import { onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { DbConnection, JoinRoom, Player } from '../../module_bindings';

	let {
		allJoinRoomHandle,
		conn,
		players,
		roomId
	}: {
		allJoinRoomHandle: SubscriptionHandle;
		players: SvelteMap<number, Player>;
		conn: DbConnection;
		roomId: number;
	} = $props();

	let joinRooms = $state<JoinRoom[]>(Array.from(conn.db.joinRoom.iter()));

	onDestroy(() => {
		if (allJoinRoomHandle.isActive()) {
			allJoinRoomHandle.unsubscribe();
		}
	});
</script>

<h1>You are in the room!</h1>
