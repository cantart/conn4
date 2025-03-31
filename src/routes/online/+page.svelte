<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import { DbConnection, Player, type ErrorContext } from '../../module_bindings';
	import { beforeNavigate } from '$app/navigation';
	import type { You } from '$lib';
	import Home from '$lib/online/Home.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Room from '$lib/online/Room.svelte';
	import type { RoomData } from '$lib/online/types';

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

	const onConnectError = (_: ErrorContext, error: Error) => {
		console.error('Error connecting to SpacetimeDB:', error);
	};

	const onConnect = (conn: DbConnection, ident: Identity, token: string) => {
		localStorage.setItem('auth_token', token);

		conn
			.subscriptionBuilder()
			.onApplied(() => {
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
</script>

{#if s.page === 'init'}
	<h1>Connecting...</h1>
{:else if s.page === 'home' && you}
	<Home
		{conn}
		{you}
		toRoom={(data) => {
			s = {
				page: 'room',
				...data
			};
		}}
	/>
{:else if s.page === 'room' && you}
	<Room
		{conn}
		initialRoomTitle={s.initialRoomTitle}
		roomId={s.roomId}
		{players}
		{you}
		leaveRoom={() => {
			s = {
				page: 'home'
			};
		}}
	/>
{:else}
	<h1>Not implemented yet</h1>
{/if}
