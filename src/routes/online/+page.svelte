<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import {
		DbConnection,
		GlobalMessage,
		JoinRoom,
		Player,
		type ErrorContext
	} from '../../module_bindings';
	import { SvelteMap } from 'svelte/reactivity';
	import { beforeNavigate } from '$app/navigation';

	let you = $state<{ id: number; name: string | undefined } | null>(null);
	let connected = $state(false);
	let name = $state<string | undefined>(undefined);
	let globalMessages = $state<GlobalMessage[]>([]);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	import type { SubscriptionHandle } from '$lib';

	let players = new SvelteMap<number, Player>();
	let nameUpdating = $state(false);
	let nameEditing = $state(false);
	let creatingRoom = $state(false);
	let globalMsgSubHandle = $state<SubscriptionHandle | null>(null);
	let playerSubHandle = $state<SubscriptionHandle | null>(null);
	let yourJoinRoomHandle = $state<SubscriptionHandle | null>(null);
	let allJoinRoomHandle = $state<SubscriptionHandle | null>(null);

	const onConnect = (conn: DbConnection, ident: Identity, token: string) => {
		localStorage.setItem('auth_token', token);
		connected = true;

		globalMsgSubHandle = conn
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

		playerSubHandle = conn
			.subscriptionBuilder()
			.onApplied(() => {
				for (const player of conn.db.player.iter()) {
					players.set(player.id, player);
					if (player.identity.toHexString() === ident.toHexString()) {
						you = {
							id: player.id,
							name: player.name
						};
						name = player.name;
					}
				}
			})
			.subscribe(['SELECT * FROM player']);
	};

	$effect(() => {
		if (!you) return;
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

	const onDisconnect = () => {
		connected = false;
	};
	const onConnectError = (_: ErrorContext, error: Error) => {
		console.log('Error connecting to SpacetimeDB:', error);
	};

	const conn = DbConnection.builder()
		.withUri('ws://localhost:3000')
		.withModuleName('fial')
		.withToken(localStorage.getItem('auth_token') || '')
		.onConnect(onConnect)
		.onDisconnect(onDisconnect)
		.onConnectError(onConnectError)
		.build();

	conn.db.player.onInsert((ctx, player) => {
		players.set(player.id, player);
	});
	conn.db.player.onUpdate((ctx, o, n) => {
		players.set(n.id, n);
		if (n.id === you?.id) {
			name = n.name;
			you = { name: n.name, id: n.id };
		}
	});
	conn.db.player.onDelete((ctx, player) => {
		players.delete(player.id);
	});

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

	beforeNavigate(() => {
		conn.disconnect();
	});

	const onNameSubmit = (
		e: SubmitEvent & {
			currentTarget: EventTarget & HTMLFormElement;
		}
	) => {
		e.preventDefault();
		const newName = new FormData(e.currentTarget).get('name') as string;
		if (!newName || newName === you?.name) return;

		conn?.reducers.setName(newName);
		nameUpdating = true;
	};

	const createRoom = () => {
		if (!conn) {
			console.error('Connection is null:', conn);
			return;
		}

		conn.reducers.createRoom();
		creatingRoom = true;
		conn.reducers.onCreateRoom((ctx) => {
			if (ctx.event.status.tag === 'Failed') {
				console.error('Failed to create room:', ctx.event.status.value);
			}
		});
	};

	$effect(() => {
		if (yourJoinRoom) {
			// Go to your room

			// cancel subscriptions
			if (playerSubHandle?.isActive()) {
				playerSubHandle.unsubscribe();
				playerSubHandle = null;
			}
			if (globalMsgSubHandle?.isActive()) {
				globalMsgSubHandle.unsubscribe();
				globalMsgSubHandle = null;
			}

			allJoinRoomHandle = conn
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
		}
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

{#if allJoinRoomHandle}
	<!-- Inside a room -->
	<h1>TODO: You are in a room now!</h1>
{:else if connected && you}
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
{:else}
	<h1>Connecting...</h1>
{/if}
