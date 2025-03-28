<script lang="ts">
	import type { You } from '$lib';
	import { DbConnection, GlobalMessage, JoinRoom, Room } from '../../module_bindings';
	import { onDestroy } from 'svelte';
	import { UseRooms } from './UseRooms.svelte';
	import type { RoomData } from './types';

	let {
		conn,
		you,
		toRoom
	}: {
		conn: DbConnection;
		you: You;
		toRoom: (data: Omit<RoomData, 'players' | 'you'>) => void;
	} = $props();

	let name = $state(you.name);
	let globalMessages = $state<GlobalMessage[]>([]);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	let nameUpdating = $state(false);
	let nameEditing = $state(false);
	let creatingRoom = $state(false);

	const useRooms = new UseRooms(conn);

	let globalMsgSubHandle = conn
		.subscriptionBuilder()
		.onApplied(() => {
			for (const msg of conn.db.globalMessage.iter()) {
				globalMessages.push(msg);
			}
		})
		.onError((ctx) => {
			console.error('Error fetching global messages:', ctx.event);
		})
		.subscribe('SELECT * FROM global_message');

	let yourJoinRoomHandle = conn
		.subscriptionBuilder()
		.onApplied(() => {
			for (const room of conn.db.joinRoom.iter()) {
				if (yourJoinRoom) {
					console.error('Your join room already exists:', yourJoinRoom);
					break;
				}
				yourJoinRoom = room;
			}
		})
		.onError((ctx) => {
			console.error('Error fetching your join room:', ctx.event);
		})
		.subscribe(`SELECT * FROM join_room WHERE joiner_id = '${you.id}'`);

	conn.db.globalMessage.onInsert((ctx, msg) => {
		globalMessages.push(msg);
	});
	conn.db.joinRoom.onInsert((ctx, room) => {
		if (room.joinerId === you.id) {
			yourJoinRoom = room;
			conn.db.joinRoom.removeOnInsert(() => {});
		}
	});
	conn.reducers.onSetName(() => {
		nameUpdating = false;
		nameEditing = false;
	});

	let joiningRoomTitle = $state<string | null>(null);
	function enterRoom(yourJoinRoom: JoinRoom) {
		if (globalMsgSubHandle.isActive()) {
			globalMsgSubHandle.unsubscribe();
		}

		const allJoinRoomHandle = conn
			.subscriptionBuilder()
			.onApplied(() => {
				if (creatingRoom) {
					creatingRoom = false;
				}

				if (yourJoinRoomHandle.isActive()) {
					yourJoinRoomHandle.unsubscribe();
				}

				toRoom({
					allJoinRoomHandle,
					roomId: yourJoinRoom.roomId,
					initialRoomTitle: joiningRoomTitle,
					conn
				});
			})
			.onError((ctx) => {
				console.error('Error fetching all join rooms:', ctx.event);
			})
			.subscribe(`SELECT * FROM join_room WHERE room_id = '${yourJoinRoom.roomId}'`);
	}

	function onNameSubmit(
		e: SubmitEvent & {
			currentTarget: EventTarget & HTMLFormElement;
		}
	) {
		e.preventDefault();
		const newName = new FormData(e.currentTarget).get('name') as string;
		if (!newName || newName === you.name) return;

		conn.reducers.setName(newName);
		nameUpdating = true;
	}

	function createRoom() {
		conn.reducers.createRoom();
		creatingRoom = true;
		conn.reducers.onCreateRoom((ctx) => {
			if (ctx.event.status.tag === 'Failed') {
				console.error('Failed to create room:', ctx.event.status.value);
			}
		});
	}

	function joinRoom(room: Room) {
		joiningRoomTitle = room.title;
		conn.reducers.joinToRoom(room.id);
	}

	$effect(() => {
		if (yourJoinRoom) {
			enterRoom(yourJoinRoom);
		}
	});

	onDestroy(() => {
		conn.db.globalMessage.removeOnInsert(() => {});
		conn.db.joinRoom.removeOnInsert(() => {});
		conn.reducers.removeOnSetName(() => {});
		useRooms.stop();
	});
</script>

{#snippet nameInputForm()}
	<form onsubmit={onNameSubmit} class="flex flex-col gap-4">
		<input
			class="input"
			name="name"
			type="text"
			placeholder="Enter your name"
			bind:value={name}
			disabled={nameUpdating}
		/>
		<button type="submit" class="btn btn-primary">
			{#if nameUpdating}
				<span class="loading loading-spinner loading-md"></span>
			{:else}
				Change
			{/if}
		</button>
	</form>
{/snippet}

<div class="flex flex-col gap-4 text-center">
	{#if you.name}
		<div class="flex items-center justify-center gap-2">
			<h1>Hello, <span class="font-bold">{you.name}</span>!</h1>
			<button
				onclick={() => {
					nameEditing = !nameEditing;
				}}
				class="btn btn-xs">{nameEditing ? 'Cancel' : 'Edit'}</button
			>
		</div>
	{/if}
	{#if !you.name}
		{@render nameInputForm()}
	{:else if nameEditing}
		{@render nameInputForm()}
	{/if}
	{#if you.name}
		<div class="space-y-8">
			<div>
				<button onclick={createRoom} class="btn btn-primary" disabled={creatingRoom}
					>Create Room{#if creatingRoom}
						<span class="loading loading-spinner loading-md"></span>
					{/if}</button
				>
			</div>
			<div class={useRooms.rooms ? 'space-y-2' : 'hidden'}>
				<h2>Rooms ({useRooms.rooms.length})</h2>
				<ol>
					{#each useRooms.rooms as room (room.id)}
						<li>
							<button
								class="btn btn-sm"
								onclick={() => joinRoom(room)}
								disabled={!!joiningRoomTitle}
							>
								{room.title}
							</button>
						</li>
					{/each}
				</ol>
			</div>
			<div class="space-y-2">
				<h2>Global Messages</h2>
				<form
					class="flex items-center gap-2"
					onsubmit={(e) => {
						e.preventDefault();
						const text = new FormData(e.currentTarget).get('text') as string;
						if (!text) return;
						conn.reducers.sendGlobalMessage(text);
						e.currentTarget.reset();
					}}
				>
					<input name="text" class="input input-ghost" type="text" placeholder="Enter a message" />
					<button type="submit" class="btn btn-primary">Send</button>
				</form>
			</div>
		</div>
	{/if}
</div>
