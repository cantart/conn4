<script lang="ts">
	import { createGame, type Game } from '$lib/game.svelte';
	import OnlineMatch from '$lib/OnlineMatch.svelte';
	import { z } from 'zod';

	let { data } = $props();

	const yourId = Math.random().toString();

	let flow = $state<
		| {
				name: 'standby';
				opponentDisconnected: boolean;
		  }
		| {
				name: 'matchmaking';
		  }
		| {
				name: 'in-match';
				game: Game;
				socket: WebSocket;
				roomId: string;
		  }
	>({ name: 'standby', opponentDisconnected: false });

	const startMatchmaking = (data: { name: string }) => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}
		flow = {
			name: 'matchmaking'
		};
		setupWebsocket(data);
	};

	const setupWebsocket = (data: { name: string }) => {
		const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_ENDPOINT);

		// Connection opened
		socket.addEventListener('open', () => {
			socket.send(JSON.stringify({ type: 'join', userId: yourId, name: data.name }));
		});

		const incomingMessageSchema = z.union([
			z.object({
				type: z.literal('start'),
				player: z.number(),
				opponent: z.object({
					id: z.string(),
					name: z.string()
				}),
				roomId: z.string()
			}),
			z.object({
				type: z.literal('drop'),
				column: z.number()
			}),
			z.object({
				type: z.literal('restart')
			}),
			z.object({
				type: z.literal('error'),
				message: z.string().nullable(),
				parseErrors: z
					.object({
						formErrors: z.string().array(),
						fieldErrors: z.record(z.any())
					})
					.nullable()
			}),
			z.object({
				type: z.literal('opponent-disconnected')
			})
		]);

		// Listen for messages
		socket.addEventListener('message', (event) => {
			const parsed = incomingMessageSchema.safeParse(JSON.parse(event.data));

			if (!parsed.success) {
				console.error(parsed.error.flatten());
				return;
			}

			const data = parsed.data;
			if (data.type === 'start') {
				if (flow.name !== 'matchmaking') {
					throw new Error('Invalid state');
				}

				const { player, opponent, roomId } = data;
				const game = createGame({
					players:
						player === 1
							? [
									{
										id: yourId,
										name: 'You'
									},
									{
										id: opponent.id,
										name: opponent.name
									}
								]
							: [
									{
										id: opponent.id,
										name: opponent.name
									},
									{
										id: yourId,
										name: 'You'
									}
								]
				});
				flow = {
					name: 'in-match',
					game,
					socket,
					roomId
				};
				return;
			}

			if (data.type === 'drop') {
				if (flow.name !== 'in-match') {
					throw new Error('Invalid state');
				}
				const { column } = data;
				flow.game.dropPiece(column);
				return;
			}

			if (data.type === 'restart') {
				if (flow.name !== 'in-match') {
					throw new Error('Invalid state');
				}
				flow.game.restart();
				return;
			}

			if (data.type === 'opponent-disconnected') {
				if (flow.name !== 'in-match') {
					throw new Error('Invalid state');
				}

				flow.socket.close();
				flow = {
					name: 'standby',
					opponentDisconnected: true
				};
				return;
			}

			if (data.type === 'error') {
				console.error(data);
			}
		});
	};
</script>

{#if flow.name === 'standby'}
	<button
		onclick={() =>
			startMatchmaking({
				name: data.user.username
			})}
		type="submit">Enter</button
	>
{:else if flow.name === 'matchmaking'}
	<div>finding match...</div>
{:else if flow.name === 'in-match'}
	<OnlineMatch socket={flow.socket} roomId={flow.roomId} game={flow.game} {yourId} />
{/if}
