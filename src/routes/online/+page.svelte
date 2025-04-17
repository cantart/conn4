<script lang="ts" module>
	// Import the functions you need from the SDKs you need
	import { initializeApp } from 'firebase/app';
	import {
		getAuth,
		onAuthStateChanged,
		signInWithPopup,
		type User,
		signOut,
		type AuthProvider,
		FacebookAuthProvider,
		GithubAuthProvider,
		TwitterAuthProvider
	} from 'firebase/auth';
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

	const googleProvider = new GoogleAuthProvider();
	const facebookProvider = new FacebookAuthProvider();
	const githubProvider = new GithubAuthProvider();
	const xProvider = new TwitterAuthProvider();

	const firebaseConfig = {
		apiKey: 'AIzaSyATTntrsu3XgqR1S73O_FemmFgAwkAw420',
		authDomain: 'conn4-a3b1f.firebaseapp.com',
		projectId: 'conn4-a3b1f',
		storageBucket: 'conn4-a3b1f.firebasestorage.app',
		messagingSenderId: '255108508987',
		appId: '1:255108508987:web:2d3b39a1fb097f8ab3db1e'
	};

	const disconnect = () => {
		conn?.disconnect();
		s = {
			page: 'loading'
		};
	};

	const postSignIn = (idToken: string) => {
		disconnect();
		conn = commonConnectionBuild()
			.withToken(idToken)
			.onConnect((conn, identity) => onConnect(conn, identity, { yes: false }))
			.build();
	};

	// Initialize Firebase
	const app = initializeApp(firebaseConfig);
	const auth = getAuth(app);
	onAuthStateChanged(auth, async (user) => {
		if (!firebaseUser.ready) {
			// Set up conn for the first time
			if (user) {
				postSignIn(await user.getIdToken());
			} else {
				conn = commonConnectionBuild()
					.withToken(localStorage.getItem('anon_token') ?? '')
					.onConnect((conn, identity, token) => onConnect(conn, identity, { yes: true, token }))
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
				page: 'loading';
		  }
	>({
		page: 'loading'
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

	const onConnect = (
		conn: DbConnection,
		identity: Identity,
		anon:
			| {
					yes: true;
					token: string;
			  }
			| {
					yes: false;
			  }
	) => {
		if (anon.yes) {
			localStorage.setItem('anon_token', anon.token);
		}

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

	let conn = $state<DbConnection | null>(null);

	const commonConnectionBuild = () => {
		return DbConnection.builder()
			.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
			.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'fial')
			.onConnectError(onConnectError);
	};
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
	import GoogleLoginButton from './GoogleLoginButton.svelte';
	import { m } from '$lib/paraglide/messages';
	import FacebookLoginButton from './FacebookLoginButton.svelte';
	import GitHubLoginButton from './GitHubLoginButton.svelte';
	import XLoginButton from './XLoginButton.svelte';

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

	const signInWithProvider = async (provider: AuthProvider) => {
		// TODO: set language
		return signInWithPopup(auth, provider)
			.then(async (result) => {
				postSignIn(await result.user.getIdToken());
			})
			.catch((error) => {
				console.error('Error signing in provider', error);
			});
	};

	let signInModal = $state<HTMLDialogElement | null>(null);
</script>

<div class="space-y-4 text-center">
	{#if firebaseUser.ready && s.page === 'home'}
		<!-- content here -->
		{#if firebaseUser.value}
			<button
				class="btn btn-warning btn-xs"
				onclick={() => {
					disconnect();
					conn = commonConnectionBuild()
						.withToken(localStorage.getItem('anon_token') ?? '')
						.onConnect((conn, identity, token) => onConnect(conn, identity, { yes: true, token }))
						.build();
					signOut(auth);
				}}
			>
				{m.sign_out()}
			</button>
		{:else}
			<button
				class="btn btn-accent btn-xs"
				onclick={() => {
					signInModal?.showModal();
				}}>{m.sign_in()}</button
			>
			<dialog bind:this={signInModal} class="modal">
				<div class="modal-box flex flex-wrap justify-center gap-2">
					<GoogleLoginButton
						onclick={() => {
							signInWithProvider(googleProvider);
						}}
					/>
					<GitHubLoginButton
						onclick={() => {
							signInWithProvider(githubProvider);
						}}
					/><XLoginButton
						onclick={() => {
							signInWithProvider(xProvider);
						}}
					/>
					<FacebookLoginButton
						onclick={() => {
							signInWithProvider(facebookProvider);
						}}
					/>
				</div>
				<form method="dialog" class="modal-backdrop">
					<button>{m.close()}</button>
				</form>
			</dialog>
		{/if}
	{/if}

	{#if s.page === 'loading' || !you || !conn}
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
</div>
