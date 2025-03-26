<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import { DbConnection, Player, type ErrorContext } from '../../module_bindings';
	import { SvelteMap } from 'svelte/reactivity';

	let identity = $state<Identity | null>(null);
	let connected = $state(false);

	const subscribeToQueries = (conn: DbConnection, queries: string[], onReady?: () => undefined) => {
		let count = 0;
		for (const query of queries) {
			conn
				?.subscriptionBuilder()
				.onApplied(() => {
					count++;
					if (count === queries.length) {
						console.log('SDK client cache initialized.');
						onReady?.();
					}
				})
				.subscribe(query);
		}
	};

	let players = new SvelteMap<string, Player>();

	const onConnect = (conn: DbConnection, ident: Identity, token: string) => {
		identity = ident;
		localStorage.setItem('auth_token', token);
		connected = true;
		console.log('Connected to the database with identity:', ident.toHexString());

		subscribeToQueries(conn, ['SELECT * FROM player'], () => {
			for (const player of conn.db.player.iter()) {
				players.set(player.identity.toHexString(), player);
			}
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
	});
	conn.db.player.onDelete((ctx, player) => {
		players.delete(player.identity.toHexString());
	});
</script>

{#if connected && identity}
	<h1>Connected!</h1>
	<h2>Players:</h2>
	{#each Array.from(players.entries()) as [identHex, player] (identHex)}
		<p class={player.online ? 'text-green-400' : ''}>
			{identHex} - {player.name}
		</p>
	{/each}
{:else}
	<h1>Connecting...</h1>
{/if}
