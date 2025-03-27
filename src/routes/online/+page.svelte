<script lang="ts">
	import type { Identity } from '@clockworklabs/spacetimedb-sdk';
	import { DbConnection, GlobalMessage, Player, type ErrorContext } from '../../module_bindings';
	import { SvelteMap } from 'svelte/reactivity';
	import { beforeNavigate } from '$app/navigation';

	let you = $state<{ ident: Identity; identStr: string; name: string | undefined } | null>(null);
	let connected = $state(false);
	let name = $state<string | undefined>(undefined);
	let globalMessages = $state<GlobalMessage[]>([]);

	const subscribeToPlayers = (conn: DbConnection, queries: string[], onReady?: () => undefined) => {
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

		subscribeToPlayers(conn, ['SELECT * FROM player'], () => {
			for (const player of conn.db.player.iter()) {
				players.set(player.identity.toHexString(), player);
				if (player.identity.toHexString() === ident.toHexString()) {
					you = {
						ident: player.identity,
						name: player.name,
						identStr: player.identity.toHexString()
					};
				}
			}
		});

		conn
			.subscriptionBuilder()
			.onApplied(() => {
				for (const msg of conn.db.globalMessage.iter()) {
					globalMessages.push(msg);
				}
				console.log(globalMessages);
			})
			.onError((ctx) => {
				console.error('Error fetching global messages:', ctx.event);
			})
			.subscribe('SELECT * FROM global_message');
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
	};
</script>

{#if connected && you}
	<div class="flex flex-col gap-4 text-center">
		{#if you.name}
			<h1>Hello, {you.name}!</h1>
		{/if}
		<form onsubmit={onNameSubmit} class="flex flex-col gap-4">
			<input
				class="input"
				name="name"
				type="text"
				placeholder="Enter your name"
				bind:value={name}
			/>
			<button type="submit" class="btn btn-primary">Submit</button>
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
