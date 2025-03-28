<script lang="ts">
	import type { SubscriptionHandle, You } from '$lib';
	import { DbConnection, GlobalMessage, JoinRoom } from '../../module_bindings';
	import { onDestroy } from 'svelte';

	let {
		conn,
		you,
		toRoom
	}: {
		conn: DbConnection;
		you: You;
		toRoom: (data: { allJoinRoomHandle: SubscriptionHandle }) => void;
	} = $props();

	let name = $state(you.name);
	let globalMessages = $state<GlobalMessage[]>([]);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	let nameUpdating = $state(false);
	let nameEditing = $state(false);
	let creatingRoom = $state(false);

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

	let yourJoinRoomHandle: SubscriptionHandle | null = null;

	conn.db.globalMessage.onInsert((ctx, msg) => {
		globalMessages.push(msg);
	});
	conn.db.joinRoom.onInsert((ctx, room) => {
		if (room.joinerId === you?.id) {
			yourJoinRoom = room;
			conn.db.joinRoom.removeOnInsert(() => {});
		}
	});
	conn.reducers.onSetName(() => {
		nameUpdating = false;
		nameEditing = false;
	});

	function removeUpdateListeners() {
		conn.db.globalMessage.removeOnInsert(() => {});
		conn.db.joinRoom.removeOnInsert(() => {});
		conn.reducers.removeOnSetName(() => {});
	}

	function enterRoom(yourJoinRoom: JoinRoom) {
		if (globalMsgSubHandle?.isActive()) {
			globalMsgSubHandle.unsubscribe();
		}

		const allJoinRoomHandle = conn
			.subscriptionBuilder()
			.onApplied(() => {
				if (!yourJoinRoom) {
					console.error('Your join room is null:', yourJoinRoom);
					return;
				}
				if (creatingRoom) {
					creatingRoom = false;
				}
			})
			.onError((ctx) => {
				console.error('Error fetching all join rooms:', ctx.event);
			})
			.subscribe(`SELECT * FROM join_room WHERE room_id = '${yourJoinRoom.roomId}'`);

		if (yourJoinRoomHandle?.isActive()) {
			yourJoinRoomHandle.unsubscribe();
			yourJoinRoomHandle = null;
		}

		toRoom({
			allJoinRoomHandle
		});
	}

	function onNameSubmit(
		e: SubmitEvent & {
			currentTarget: EventTarget & HTMLFormElement;
		}
	) {
		e.preventDefault();
		const newName = new FormData(e.currentTarget).get('name') as string;
		if (!newName || newName === you?.name) return;

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

	$effect(() => {
		// set up your join room listener
		yourJoinRoomHandle = conn
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
	});

	$effect(() => {
		if (yourJoinRoom) {
			enterRoom(yourJoinRoom);
		}
	});

	onDestroy(() => {
		removeUpdateListeners();
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
	{#if you?.name}
		<div class="flex items-center justify-center gap-2">
			<h1>Hello, <span class="font-bold">{you?.name}</span>!</h1>
			<button
				onclick={() => {
					nameEditing = !nameEditing;
				}}
				class="btn btn-xs">{nameEditing ? 'Cancel' : 'Edit'}</button
			>
		</div>
	{/if}
	{#if !you?.name}
		{@render nameInputForm()}
	{:else if nameEditing}
		{@render nameInputForm()}
	{/if}
	{#if you?.name}
		<div>
			<button onclick={createRoom} class="btn btn-primary" disabled={creatingRoom}
				>Create Room{#if creatingRoom}
					<span class="loading loading-spinner loading-md"></span>
				{/if}</button
			>
		</div>
		<div class="space-y-2">
			<h2>Global Messages</h2>
			<form
				class="flex items-center gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					const text = new FormData(e.currentTarget).get('text') as string;
					if (!text) return;
					conn?.reducers.sendGlobalMessage(text);
					e.currentTarget.reset();
				}}
			>
				<input name="text" class="input input-ghost" type="text" placeholder="Enter a message" />
				<button type="submit" class="btn btn-primary">Send</button>
			</form>
		</div>
	{/if}
</div>
