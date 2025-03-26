<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import { DbConnection, Player, type ErrorContext } from '../../module_bindings';
	import { SvelteMap } from 'svelte/reactivity';
	import { beforeNavigate } from '$app/navigation';

	let you = $state<{ ident: Identity; name: string | undefined } | null>(null);
	let connected = $state(false);
	let name = $state<string | undefined>(undefined);

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
		localStorage.setItem('auth_token', token);
		connected = true;

		subscribeToQueries(conn, ['SELECT * FROM player'], () => {
			for (const player of conn.db.player.iter()) {
				players.set(player.identity.toHexString(), player);
				if (player.identity.toHexString() === ident.toHexString()) {
					you = { ident: player.identity, name: player.name };
				}
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
		if (n.identity.toHexString() === you?.ident.toHexString()) {
			name = n.name;
			you = { ident: n.identity, name: n.name };
		}
	});
	conn.db.player.onDelete((ctx, player) => {
		players.delete(player.identity.toHexString());
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
	};
</script>

{#if connected && you}
	<div class="flex flex-col gap-4 text-center">
		{#if you.name}
			<h1>Hello, {you.name}!</h1>
		{/if}
		<form onsubmit={onNameSubmit} class="flex flex-col gap-4">
			<input name="name" type="text" placeholder="Enter your name" bind:value={name} />
			<button type="submit" class="btn btn-primary">Submit</button>
		</form>
	</div>
{:else}
	<h1>Connecting...</h1>
{/if}
