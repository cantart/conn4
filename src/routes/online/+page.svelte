<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import {
		DbConnection,
		type EventContext,
		type JoinRoom,
		Player,
		type ErrorContext
	} from '../../module_bindings';
	import { beforeNavigate } from '$app/navigation';
	import type { SubscriptionHandle, You } from '$lib';
	import Home from '$lib/online/Home.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Room from '$lib/online/Room.svelte';
	import type { RoomData } from '$lib/online/types';
	import { UseRooms } from '$lib/online/UseRooms.svelte';

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

	let players = new SvelteMap<number, Player>();
	let you = $state<You | null>(null);
	let yourJoinRoom = $state<JoinRoom | null>(null);
	let yourJoinRoomHandle: SubscriptionHandle | null = null;
	let youJoinRoomOnInsert: (ctx: EventContext, jr: JoinRoom) => void = (ctx, jr) => {
		if (!you) {
			throw new Error('You are not set yet');
		}
		if (jr.joinerId === you.id) {
			yourJoinRoom = jr;
			conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
		} else {
			console.error('Room of another user', jr);
		}
	};

	const onConnectError = (_: ErrorContext, error: Error) => {
		console.error('Error connecting to SpacetimeDB:', error);
	};

	const setupYourJoinRoom = async (y: You) => {
		return new Promise<void>((resolve) => {
			conn.db.joinRoom.onInsert(youJoinRoomOnInsert);
			yourJoinRoomHandle = conn
				.subscriptionBuilder()
				.onApplied(() => {
					for (const jr of conn.db.joinRoom.iter()) {
						if (jr.joinerId === you?.id) {
							yourJoinRoom = jr;
							return;
						}
					}
					resolve();
				})
				.onError((ctx) => {
					console.error('Error fetching your join room:', ctx.event);
				})
				.subscribe(`SELECT * FROM join_room WHERE joiner_id = '${y.id}'`);
		});
	};

	const onConnect = (conn: DbConnection, ident: Identity, token: string) => {
		localStorage.setItem('auth_token', token);

		conn
			.subscriptionBuilder()
			.onApplied(async () => {
				for (const player of conn.db.player.iter()) {
					players.set(player.id, player);
					if (
						player.id === you?.id ||
						player.identity.toHexString() === conn.identity?.toHexString()
					) {
						you = {
							id: player.id,
							name: player.name
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
			players.set(player.id, player);
		});
		conn.db.player.onUpdate((ctx, o, n) => {
			players.set(n.id, n);
			if (n.id === you?.id || n.identity.toHexString() === conn.identity?.toHexString()) {
				you = { name: n.name, id: n.id };
			}
		});
		conn.db.player.onDelete((ctx, player) => {
			players.delete(player.id);
		});
	};

	const conn = DbConnection.builder()
		.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
		.withModuleName('fial')
		.withToken(localStorage.getItem('auth_token') || '')
		.onConnect(onConnect)
		.onConnectError(onConnectError)
		.build();

	beforeNavigate(() => {
		conn.disconnect();
	});

	let homeUseRooms: UseRooms | null = null;
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
					await homeUseRooms?.stop();
					s = toRoomData;
				});
			}
		}
	});
</script>

{#if s.page === 'init'}
	<h1>Connecting...</h1>
{:else if s.page === 'home' && you}
	<Home
		setUseRooms={(ur) => {
			homeUseRooms = ur;
		}}
		{conn}
		{you}
	/>
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
