<script lang="ts" module>
	let players = new SvelteMap<bigint, Player>();
	let you = $state<You | null>(null);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	let yourJoinRoomHandle: SubscriptionHandle | null = null;

	let s = $state<
		| {
				page: 'home';
		  }
		| ({
				page: 'room';
		  } & Omit<RoomData, 'players' | 'you' | 'leaveRoom' | 'conn'>)
		| {
				page: 'init';
		  }
	>({
		page: 'init'
	});

	let youJoinRoomOnInsert: (ctx: EventContext, jr: JoinRoom) => void = (ctx, jr) => {
		if (!you) {
			throw new Error('You are not set yet');
		}
		if (jr.joiner.data === you.identity.data) {
			yourJoinRoom = jr;
			conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
		} else {
			console.error('Room of another user', jr);
		}
	};

	const setupYourJoinRoom = async (y: You) => {
		return new Promise<void>((resolve) => {
			yourJoinRoomHandle = conn
				.subscriptionBuilder()
				.onApplied(() => {
					for (const jr of conn.db.joinRoom.iter()) {
						if (jr.joiner.data === you?.identity.data) {
							yourJoinRoom = jr;
							return;
						}
					}
					conn.db.joinRoom.onInsert(youJoinRoomOnInsert);
					resolve();
				})
				.onError((ctx) => {
					console.error('Error fetching your join room:', ctx.event);
				})
				.subscribe(`SELECT * FROM join_room WHERE joiner = '${y.identity.toHexString()}'`);
		});
	};

	const onConnectError = (_: ErrorContext, error: Error) => {
		console.error('Error connecting to SpacetimeDB:', error);
	};

	const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
		localStorage.setItem('auth_token', token);

		conn
			.subscriptionBuilder()
			.onApplied(async () => {
				for (const player of conn.db.player.iter()) {
					players.set(player.identity.data, player);
					if (player.identity.data === identity.data) {
						you = {
							name: player.name,
							identity
						};
						await setupYourJoinRoom(you);
						s = {
							page: 'home'
						};
					}
				}
			})
			.subscribe(['SELECT * FROM player']);

		conn.db.player.onInsert((ctx, player) => {
			players.set(player.identity.data, player);
		});
		conn.db.player.onUpdate((ctx, o, n) => {
			players.set(n.identity.data, n);
			if (n.identity.data === you?.identity.data) {
				you = { name: n.name, identity: identity };
			}
		});
		conn.db.player.onDelete((ctx, player) => {
			players.delete(player.identity.data);
		});
	};

	const conn = DbConnection.builder()
		.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
		.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'fial')
		.withToken(localStorage.getItem('auth_token') || '')
		.onConnect(onConnect)
		.onConnectError(onConnectError)
		.build();
</script>

<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import {
		DbConnection,
		type EventContext,
		type JoinRoom,
		Player,
		type ErrorContext
	} from '../../module_bindings';
	import type { SubscriptionHandle, You } from '$lib';
	import Home from './Home.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { RoomData } from './types';
	import Room from './Room.svelte';

	$inspect(yourJoinRoom);

	let home: Home | null = $state(null);
	$effect(() => {
		if (yourJoinRoom) {
			const toRoomData: Extract<typeof s, { page: 'room' }> = {
				page: 'room',
				initialRoomTitle: null,
				roomId: yourJoinRoom.roomId
			};
			yourJoinRoom = null;
			if (yourJoinRoomHandle?.isActive()) {
				yourJoinRoomHandle.unsubscribeThen(async () => {
					conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
					yourJoinRoomHandle = null;
					await home?.stopUseRooms();
					s = toRoomData;
				});
			}
		}
	});
</script>

{#if s.page === 'init'}
	<h1>Connecting...</h1>
{:else if s.page === 'home' && you}
	<Home bind:this={home} {conn} {you} />
{:else if s.page === 'room' && you}
	<Room
		{conn}
		initialRoomTitle={s.initialRoomTitle}
		roomId={s.roomId}
		{players}
		{you}
		leaveRoom={(y) => {
			s = {
				page: 'home'
			};
			setupYourJoinRoom(y);
		}}
	/>
{:else}
	<h1>Not implemented yet</h1>
{/if}
