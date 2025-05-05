<script lang="ts" module>
	import { initializeApp } from 'firebase/app';
	import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
	import { DbConnection, type ErrorContext, Player } from '../../module_bindings';
	import type { You } from '$lib';
	import { SvelteMap } from 'svelte/reactivity';
	import { Identity } from '@clockworklabs/spacetimedb-sdk';
	import { getContext, setContext } from 'svelte';

	const firebaseConfig = {
		apiKey: 'AIzaSyATTntrsu3XgqR1S73O_FemmFgAwkAw420',
		authDomain: 'conn4-a3b1f.firebaseapp.com',
		projectId: 'conn4-a3b1f',
		storageBucket: 'conn4-a3b1f.firebasestorage.app',
		messagingSenderId: '255108508987',
		appId: '1:255108508987:web:2d3b39a1fb097f8ab3db1e'
	};

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
	let players = new SvelteMap<bigint, Player>();
	let you = $state<You | null>(null);
	let connected = $state(false);

	const onConnectError = (_: ErrorContext, error: Error) => {
		connected = false;
		console.error('Error connecting to SpacetimeDB:', error);
	};

	const commonConnectionBuild = () => {
		return DbConnection.builder()
			.withUri(import.meta.env.VITE_SPACETIME_DB_URI ?? 'ws://localhost:3000')
			.withModuleName(import.meta.env.VITE_SPACETIME_DB_MODULE ?? 'conn4')
			.onConnectError(onConnectError);
	};

	let conn = $state<DbConnection | null>(null);

	const setupPlayerTableSubscription = (conn: DbConnection, yourIdentity: Identity) => {
		conn
			.subscriptionBuilder()
			.onApplied(async () => {
				for (const player of conn.db.player.iter()) {
					players.set(player.identity.data, player);
					if (player.identity.data === yourIdentity.data) {
						you = {
							name: player.name,
							identity: player.identity
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
				you = { name: n.name, identity: n.identity };
			}
		});
		conn.db.player.onDelete((ctx, player) => {
			players.delete(player.identity.data);
		});
	};

	const setupDbConnection = (idToken?: string) => {
		conn?.disconnect();
		connected = false;
		conn = commonConnectionBuild()
			.withToken(idToken ?? localStorage.getItem('anon_token') ?? '')
			.onConnect((conn, identity, token) => {
				connected = true;

				if (!idToken) {
					localStorage.setItem('anon_token', token);
				}

				setupPlayerTableSubscription(conn, identity);
			})
			.build();
	};

	const app = initializeApp(firebaseConfig);
	const auth = getAuth(app);
	onAuthStateChanged(auth, async (user) => {
		setupDbConnection(await user?.getIdToken());
		firebaseUser = {
			ready: true,
			value: user
		};
	});

	const connectedContext = {
		key: '$connected', // Using '$' prefix convention for context keys
		set: () => setContext(connectedContext.key, () => connected),
		get: () => {
			return getContext<ReturnType<typeof connectedContext.set>>(connectedContext.key);
		}
	} as const;

	const playersContext = {
		key: '$players',
		ctx: () => players,
		set: () => setContext(playersContext.key, playersContext.ctx),
		get: () => {
			return getContext<ReturnType<typeof playersContext.set>>(playersContext.key);
		}
	} as const;

	const youContext = {
		key: '$you',
		ctx: () => you,
		set: () => setContext(youContext.key, youContext.ctx),
		get: () => {
			return getContext<ReturnType<typeof youContext.set>>(youContext.key);
		}
	} as const;

	const connContext = {
		key: '$conn',
		ctx: () => conn,
		set: () => setContext(connContext.key, connContext.ctx),
		get: () => {
			return getContext<ReturnType<typeof connContext.set>>(connContext.key);
		}
	} as const;

	const postSignInContext = {
		key: '$postSignIn',
		set: () => setContext(postSignInContext.key, setupDbConnection),
		get: () => {
			return getContext<ReturnType<typeof postSignInContext.set>>(postSignInContext.key);
		}
	} as const;

	const firebaseUserContext = {
		key: '$firebaseUser',
		ctx: () => firebaseUser,
		set: () => setContext(firebaseUserContext.key, firebaseUserContext.ctx),
		get: () => {
			return getContext<ReturnType<typeof firebaseUserContext.set>>(firebaseUserContext.key);
		}
	} as const;

	export const getConnectedContext = connectedContext.get;
	export const getPlayersContext = playersContext.get;
	export const getYouContext = youContext.get;
	export const getConnContext = connContext.get;
	export const getPostSignInContext = postSignInContext.get;
	export const getFirebaseUserContext = firebaseUserContext.get;
</script>

<script lang="ts">
	let { children } = $props();

	// --- Set Contexts ---
	connectedContext.set();
	playersContext.set();
	youContext.set();
	connContext.set();
	postSignInContext.set();
	firebaseUserContext.set();
</script>

{@render children()}
