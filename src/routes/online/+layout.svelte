<script lang="ts" module>
	import { initializeApp } from 'firebase/app';
	import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
	import { DbConnection, type ErrorContext, Player } from '../../module_bindings';
	import type { You } from '$lib';
	import { SvelteMap } from 'svelte/reactivity';
	import { Identity } from '@clockworklabs/spacetimedb-sdk';
	import { setContext } from 'svelte';
	import type { CustomerContext } from './types';

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
	// let yourIdentity = $state<Identity | null>(null);
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
			console.log(n);
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
</script>

<script lang="ts">
	let { children } = $props();

	setContext<CustomerContext['connected']>('connected', () => connected);
	setContext<CustomerContext['players']>('players', () => players);
	setContext<CustomerContext['you']>('you', () => you);
	setContext<CustomerContext['conn']>('conn', () => conn);
	setContext<CustomerContext['postSignIn']>('postSignIn', setupDbConnection);
	setContext<CustomerContext['firebaseUser']>('firebaseUser', () => firebaseUser);
</script>

{@render children()}
