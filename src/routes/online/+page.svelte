<script lang="ts" module>
	// Import the functions you need from the SDKs you need
	import { initializeApp } from 'firebase/app';
	import { getAuth, onAuthStateChanged, signInWithPopup, type User, signOut } from 'firebase/auth';
	import { GoogleAuthProvider } from 'firebase/auth';

	let firebaseUser = $state<
		| {
				ready: false;
		  }
		| {
				ready: true;
				value: User | null;
		  }
	>({
		ready: false
	});

	const provider = new GoogleAuthProvider();

	const firebaseConfig = {
		apiKey: 'AIzaSyATTntrsu3XgqR1S73O_FemmFgAwkAw420',
		authDomain: 'conn4-a3b1f.firebaseapp.com',
		projectId: 'conn4-a3b1f',
		storageBucket: 'conn4-a3b1f.firebasestorage.app',
		messagingSenderId: '255108508987',
		appId: '1:255108508987:web:2d3b39a1fb097f8ab3db1e'
	};

	// Initialize Firebase
	const app = initializeApp(firebaseConfig);
	const auth = getAuth(app);
	onAuthStateChanged(auth, async (user) => {
		if (!firebaseUser.ready) {
			// Set up conn for the first time
			if (user) {
				const idToken = await user.getIdToken();
				conn = DbConnection.builder()
					.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
					.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'fial')
					.withToken(idToken)
					.onConnect(onConnect)
					.onConnectError(onConnectError)
					.build();
				console.log('idToken', idToken);
			} else {
				conn = DbConnection.builder()
					.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
					.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'fial')
					.withToken('')
					.onConnect(onConnect)
					.onConnectError(onConnectError)
					.build();
			}
		}
		firebaseUser = {
			ready: true,
			value: user
		};
	});

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
		if (!conn) {
			throw new Error('Connection is not set yet');
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
			if (!conn) {
				throw new Error('Connection is not set yet');
			}

			yourJoinRoomHandle = conn
				.subscriptionBuilder()
				.onApplied(() => {
					if (!conn) {
						throw new Error('Connection is not set yet');
					}

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

	const onConnect = (conn: DbConnection, identity: Identity) => {
		console.log('identity', identity);
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

	// svelte-ignore non_reactive_update
	let conn: DbConnection | null = null;
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
					if (!conn) {
						throw new Error('Connection is not set yet');
					}

					conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
					yourJoinRoomHandle = null;
					await home?.stopUseRooms();
					s = toRoomData;
				});
			}
		}
	});
</script>

{#if firebaseUser.ready}
	<!-- content here -->
	{#if firebaseUser.value}
		<p>{firebaseUser.value.displayName}</p>
		<button
			onclick={() => {
				conn?.disconnect();
				conn = DbConnection.builder()
					.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
					.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'fial')
					.withToken('')
					.onConnect(onConnect)
					.onConnectError(onConnectError)
					.build();
				signOut(auth);
			}}
		>
			Sign out
		</button>
	{:else}
		<button
			onclick={() => {
				signInWithPopup(auth, provider)
					.then(async (result) => {
						// This gives you a Google Access Token. You can use it to access the Google API.
						conn?.disconnect();
						conn = DbConnection.builder()
							.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
							.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'fial')
							.withToken(await result.user.getIdToken())
							.onConnect(onConnect)
							.onConnectError(onConnectError)
							.build();
						// console.log('credential.idToken', credential.idToken);
					})
					.catch((error) => {
						console.error('Error signing in with Google:', error);
					});
			}}>Continue with Google</button
		>
	{/if}
{:else}
	<!-- else content here -->
{/if}

{#if s.page === 'init' || !you || !conn}
	<h1>Connecting...</h1>
{:else if s.page === 'home'}
	<Home bind:this={home} {conn} {you} />
{:else if s.page === 'room'}
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
