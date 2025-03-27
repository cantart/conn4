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
	import { beforeNavigate, goto } from '$app/navigation';

	let you = $state<{ ident: Identity; identStr: string; name: string | undefined } | null>(null);
	let connected = $state(false);
	let name = $state<string | undefined>(undefined);
	let globalMessages = $state<GlobalMessage[]>([]);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	import { setContext } from 'svelte';

	let players = new SvelteMap<string, Player>();
	let nameUpdating = $state(false);
	let nameEditing = $state(false);

	const onConnect = (conn: DbConnection, ident: Identity, token: string) => {
		localStorage.setItem('auth_token', token);
		connected = true;

		const globalMsgSubHandle = conn
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

		const playerSubHandle = conn
			.subscriptionBuilder()
			.onApplied(() => {
				for (const player of conn.db.player.iter()) {
					players.set(player.identity.toHexString(), player);
					if (player.identity.toHexString() === ident.toHexString()) {
						you = {
							ident: player.identity,
							name: player.name,
							identStr: player.identity.toHexString()
						};
						name = player.name;

						// set up your join room listener
						const yourJoinRoomHandle = conn
							.subscriptionBuilder()
							.onApplied(() => {
								for (const room of conn.db.joinRoom.iter()) {
									if (yourJoinRoom) {
										console.error('Your join room already exists:', yourJoinRoom);
										break;
									}
									yourJoinRoom = room;
								}

								if (yourJoinRoom) {
									// Go to your room

									// unsubscribe subscriptions
									playerSubHandle.unsubscribe();
									globalMsgSubHandle.unsubscribe();

									const allJoinRoomHandle = conn
										.subscriptionBuilder()
										.onApplied(() => {
											if (!yourJoinRoom) {
												console.error('Your join room is null:', yourJoinRoom);
												return;
											}
											setContext('conn', conn);
											setContext('allJoinRoomHandle', allJoinRoomHandle);
											goto(`/online/r/${yourJoinRoom.roomId}`);
										})
										.onError((ctx) => {
											console.error('Error fetching all join rooms:', ctx.event);
										})
										.subscribe(`SELECT * FROM join_room WHERE roomId = '${yourJoinRoom.roomId}'`);

									if (allJoinRoomHandle.isActive()) {
										yourJoinRoomHandle.unsubscribe();
									}
								}
							})
							.onError((ctx) => {
								console.error('Error fetching your join room:', ctx.event);
							})
							.subscribe(`SELECT * FROM join_room WHERE joiner = '${you.ident.toHexString()}'`);
					}
				}
			})
			.subscribe(['SELECT * FROM player']);

		conn.reducers.onSetName(() => {
			nameUpdating = false;
			nameEditing = false;
		});
	};
	const onDisconnect = () => {
		connected = false;
	};
	const onConnectError = (_: ErrorContext, error: Error) => {
		console.log('Error connecting to SpacetimeDB:', error);
	};

	let conn = $state(
		DbConnection.builder()
			.withUri('ws://localhost:3000')
			.withModuleName('fial')
			.withToken(localStorage.getItem('auth_token') || '')
			.onConnect(onConnect)
			.onDisconnect(onDisconnect)
			.onConnectError(onConnectError)
			.build()
	);

	conn.db.player.onInsert((ctx, player) => {
		players.set(player.identity.toHexString(), player);
	});
	conn.db.player.onUpdate((ctx, o, n) => {
		players.set(n.identity.toHexString(), n);
		if (n.identity.toHexString() === you?.ident.toHexString()) {
			name = n.name;
			you = { ident: n.identity, name: n.name, identStr: n.identity.toHexString() };
		}
	});
	conn.db.player.onDelete((ctx, player) => {
		players.delete(player.identity.toHexString());
	});

	conn.db.globalMessage.onInsert((ctx, msg) => {
		globalMessages.push(msg);
	});

	beforeNavigate(() => {
		conn?.disconnect();
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
</script>

{#if connected && you}
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
		<form onsubmit={onNameSubmit} class="flex flex-col gap-4 {nameEditing ? '' : 'hidden'}">
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
		{#if you.name}
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
		{/if}
	</div>
{:else}
	<h1>Connecting...</h1>
{/if}
