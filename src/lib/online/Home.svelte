<script lang="ts">
	import type { SubscriptionHandle, You } from '$lib';
	import { DbConnection, type EventContext, JoinRoom, Room } from '../../module_bindings';
	import { onDestroy } from 'svelte';
	import { UseRooms } from './UseRooms.svelte';
	import type { RoomData } from './types';

	let {
		conn,
		you,
		toRoom,
		setAllJRHandle
	}: {
		conn: DbConnection;
		you: You;
		setAllJRHandle: (handle: SubscriptionHandle) => void;
		toRoom: (data: Omit<RoomData, 'players' | 'you' | 'leaveRoom' | 'allJoinRoomHandle'>) => void;
	} = $props();

	let name = $state(you.name);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	let nameUpdating = $state(false);
	let nameEditing = $state(false);
	let creatingRoom = $state(false);

	const useRooms = new UseRooms(conn);

	const youJoinRoomOnInsert = (ctx: EventContext, jr: JoinRoom) => {
		if (jr.joinerId === you.id) {
			yourJoinRoom = jr;
			conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
		} else {
			console.error('Room of another user', jr);
		}
	};

	conn.db.joinRoom.onInsert(youJoinRoomOnInsert);
	let yourJoinRoomHandle = conn
		.subscriptionBuilder()
		.onError((ctx) => {
			console.error('Error fetching your join room:', ctx.event);
		})
		.subscribe(`SELECT * FROM join_room WHERE joiner_id = '${you.id}'`);

	const onSetName = () => {
		nameUpdating = false;
		nameEditing = false;
	};
	conn.reducers.onSetName(onSetName);

	let joiningRoomTitle = $state('');
	function enterRoom(yourJoinRoom: JoinRoom) {
		setAllJRHandle(
			conn
				.subscriptionBuilder()
				.onApplied(() => {
					toRoom({
						// allJoinRoomHandle,
						roomId: yourJoinRoom.roomId,
						initialRoomTitle: joiningRoomTitle,
						conn
					});
				})
				.onError((ctx) => {
					console.error('Error fetching all join rooms:', ctx.event);
				})
				.subscribe(`SELECT * FROM join_room WHERE room_id = '${yourJoinRoom.roomId}'`)
		);

		if (yourJoinRoomHandle.isActive()) {
			yourJoinRoomHandle.unsubscribe();
		}
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
		creatingRoom = true;
		conn.reducers.createRoom(joiningRoomTitle);
		conn.reducers.onCreateRoom((ctx) => {
			if (ctx.event.status.tag === 'Failed') {
				console.error('Failed to create room:', ctx.event.status.value);
			}
			creatingRoom = false;
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
		conn.reducers.removeOnSetName(onSetName);
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
				<form
					onsubmit={(e) => {
						e.preventDefault();
						createRoom();
					}}
					class="dropdown dropdown-hover dropdown-center"
				>
					<button type="submit" class="btn btn-primary" disabled={creatingRoom}
						>Create Room{#if creatingRoom}
							<span class="loading loading-spinner loading-md"></span>
						{/if}</button
					>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						tabindex="0"
						class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
					>
						<input
							type="text"
							name="title"
							placeholder="Enter room title"
							class="input input-bordered w-full max-w-xs"
							bind:value={joiningRoomTitle}
							required
						/>
					</div>
				</form>
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
		</div>
	{/if}
</div>
