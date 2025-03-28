<script lang="ts">
	import { onDestroy } from 'svelte';
	import { JoinRoom } from '../../module_bindings';
	import type { RoomData } from './types';
	import { UseRoom } from './UseRoom.svelte';

	let { allJoinRoomHandle, conn, players, roomId, initialRoomTitle, you }: RoomData = $props();

	let roomTitle = $state(initialRoomTitle);
	let joinRooms = $state<JoinRoom[]>(Array.from(conn.db.joinRoom.iter()));

	const useRoom = new UseRoom(conn, roomId);
	$effect(() => {
		if (useRoom.room?.title) {
			roomTitle = useRoom.room.title;
		}
	});

	conn.db.joinRoom.onInsert((ctx, jr) => {
		joinRooms.push(jr);
	});
	conn.db.joinRoom.onDelete((ctx, jr) => {
		const index = joinRooms.findIndex((j) => j.joinerId === jr.joinerId);
		if (index !== -1) {
			joinRooms.splice(index, 1);
		} else {
			throw new Error(`Join room not found for deletion: ${jr.joinerId}`);
		}
	});
	conn.db.joinRoom.onUpdate((ctx, o, n) => {
		const index = joinRooms.findIndex((j) => j.joinerId === o.joinerId);
		if (index !== -1) {
			joinRooms[index] = n;
		} else {
			throw new Error(`Join room not found for update: ${o.joinerId}`);
		}
	});
	onDestroy(() => {
		if (allJoinRoomHandle.isActive()) {
			allJoinRoomHandle.unsubscribe();
		}
		useRoom.stop();
		conn.db.joinRoom.removeOnInsert(() => {});
		conn.db.joinRoom.removeOnDelete(() => {});
		conn.db.joinRoom.removeOnUpdate(() => {});
	});
</script>

<div class="space-y-8">
	{#if roomTitle}
		<h1>{roomTitle}</h1>
	{:else}
		<span class="loading loading-spinner loading-sm"></span>
	{/if}

	<div>
		<ul>
			{#each joinRooms as jr (jr.joinerId)}
				{@const player = players.get(jr.joinerId)}
				<li>
					{#if player}
						{player.name}
						{#if player.id === you.id}
							(You)
						{/if}
					{:else}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
</div>
