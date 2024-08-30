<script lang="ts">
	import { googleSignInWithPopup } from '$lib/firebase.client';
	import { createGame, type Game } from '$lib/game.svelte';
	import OnlineMatch from '$lib/OnlineMatch.svelte';
	import { session } from '$lib/session.svelte';
	import { z } from 'zod';
	import {
		addDoc,
		onSnapshot,
		type DocumentReference,
		deleteDoc,
		updateDoc
	} from 'firebase/firestore';
	import { collections } from '$lib/firestore';

	let flow = $state<
		| {
				name: 'standby';
				opponentDisconnected: boolean;
		  }
		| {
				name: 'matchmaking';
				yourId: string;
				queue: string[];
				matchMakingRoomUnsub: () => void;
				roomRef: DocumentReference;
		  }
		| {
				name: 'in-match';
				game: Game;
				gameRoomRef: DocumentReference;
				yourId: string;
		  }
	>({ name: 'standby', opponentDisconnected: false });

	const startMatchmaking = async (data: { name: string; userId: string }) => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}
		// setupWebsocket(data);
		const d: z.infer<typeof collections.matchmakingRooms.docSchema> = {
			host: data.userId,
			queue: []
		};
		const docRef = await addDoc(collections.matchmakingRooms.collection([]), d);
		let queue = $state<string[]>([]);
		const unsub = onSnapshot(docRef, (doc) => {
			const data = doc.data() as z.infer<typeof collections.matchmakingRooms.docSchema> | undefined;
			if (!data) {
				throw new Error('Cannot find matchmaking room after creation');
			}
			queue = data.queue;
		});
		flow = {
			name: 'matchmaking',
			yourId: data.userId,
			matchMakingRoomUnsub: unsub,
			get queue() {
				return queue;
			},
			roomRef: docRef
		};
	};

	const setupWebsocket = (data: { name: string; userId: string }) => {
		const socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_ENDPOINT);

		// Connection opened
		socket.addEventListener('open', () => {
			socket.send(JSON.stringify({ type: 'join', userId: data.userId, name: data.name }));
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
										id: flow.yourId,
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
										id: flow.yourId,
										name: 'You'
									}
								]
				});
				flow = {
					name: 'in-match',
					game,
					socket,
					roomId,
					yourId: flow.yourId
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

	const acceptPlayer = async (opponentId: string) => {
		if (flow.name !== 'matchmaking') {
			throw new Error('Invalid state');
		}
		// add opponent as an accepted player to the matchmaking room
		const dataToUpdate: Partial<z.infer<typeof collections.matchmakingRooms.docSchema>> = {
			acceptedPlayer: opponentId
		};
		await updateDoc(flow.roomRef, dataToUpdate);
		// create game room
		const gameRoom: z.infer<typeof collections.gameRooms.docSchema> = {
			players: [flow.yourId]
		};
		const gameRoomRef = await addDoc(collections.gameRooms.collection([]), gameRoom);
		// listen if the opponent has joined the game room (listen to the `players` field)
		const unsub = onSnapshot(gameRoomRef, (doc) => {
			if (flow.name !== 'matchmaking') {
				throw new Error('Invalid state');
			}
			if (doc.metadata.hasPendingWrites) {
				return;
			}
			const data = doc.data() as z.infer<typeof collections.gameRooms.docSchema> | undefined;
			if (!data || data.players.length !== 2) {
				return;
			}

			// unsubscribe the matchmaking room
			flow.matchMakingRoomUnsub();
			// delete the matchmaking room
			deleteDoc(flow.roomRef);
			unsub();

			// change flow to in-match
			flow = {
				name: 'in-match',
				game: createGame({
					players: [
						{
							id: data.players[0],
							name: data.players[0] === flow.yourId ? 'You' : 'Opponent'
						},
						{
							id: data.players[1],
							name: data.players[1] === flow.yourId ? 'You' : 'Opponent'
						}
					]
				}),
				gameRoomRef,
				yourId: flow.yourId
			};
		});

		// create an active game room
		const d: z.infer<typeof collections.gameRooms.docSchema> = {
			players: [flow.yourId, opponentId]
		};
		await addDoc(collections.gameRooms.collection([]), d);
	};
</script>

{#if session.data.ready}
	{#if session.data.user}
		{@const user = session.data.user}
		{#if flow.name === 'standby'}
			<button
				onclick={() =>
					startMatchmaking({
						name: user.displayName ?? 'Anonymous',
						userId: user.uid
					})}
				type="submit">Enter</button
			>
		{:else if flow.name === 'matchmaking'}
			{#each flow.queue as q}
				<button onclick={() => acceptPlayer(q)}>{q}</button>
			{/each}
		{:else if flow.name === 'in-match'}
			<OnlineMatch gameRoomRef={flow.gameRoomRef} game={flow.game} yourId={flow.yourId} />
		{/if}
	{:else}
		<button onclick={googleSignInWithPopup}>Login</button>
	{/if}
{:else}
	<div>Loading...</div>
{/if}
