<script lang="ts">
	import { createGame, type Game } from '$lib/game.svelte';
	import OnlineMatch from '$lib/OnlineMatch.svelte';
	import { z } from 'zod';

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

	const startMatchmaking = () => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}
		flow = {
			name: 'matchmaking'
		};
		setupWebsocket();
	};

	const setupWebsocket = () => {
		const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_ENDPOINT);

		// Connection opened
		socket.addEventListener('open', () => {
			socket.send(JSON.stringify({ type: 'join', userId: yourId }));
		});

		const incomingMessageSchema = z.union([
			z.object({
				type: z.literal('start'),
				player: z.number(),
				opponentId: z.string(),
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
				message: z.string()
			}),
			z.object({
				type: z.literal('opponent-disconnected')
			})
		]);

		// Listen for messages
		socket.addEventListener('message', (event) => {
			const data = incomingMessageSchema.parse(JSON.parse(event.data));

			if (data.type === 'start') {
				if (flow.name !== 'matchmaking') {
					throw new Error('Invalid state');
				}

				const { player, opponentId, roomId } = data;
				const game = createGame({
					players:
						player === 1
							? [
									{
										id: yourId,
										name: 'You'
									},
									{
										id: opponentId,
										name: 'Opponent'
									}
								]
							: [
									{
										id: opponentId,
										name: 'Opponent'
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
			}

			if (data.type === 'error') {
				console.error(data.message);
			}
		});
	};
</script>

{#if flow.name === 'standby'}
	<button onclick={startMatchmaking}>Click to start</button>
{:else if flow.name === 'matchmaking'}
	<div>finding match...</div>
{:else if flow.name === 'in-match'}
	<OnlineMatch socket={flow.socket} roomId={flow.roomId} game={flow.game} {yourId} />
{/if}
