<script lang="ts">
	import { googleSignInWithPopup } from '$lib/firebase.client';
	import { createGame, type Game, type Player } from '$lib/game.svelte';
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
	import { collections, type Doc } from '$lib/firestore';

	let flow = $state<
		| {
				name: 'standby';
				opponentDisconnected: boolean;
		  }
		| {
				name: 'hosting';
				yourId: string;
				queue: string[];
				matchMakingRoomUnsub: () => void;
				matchmakingRoomRef: DocumentReference;
		  }
		| {
				name: 'in-match';
				game: Game;
				gameRoomRef: DocumentReference;
				yourId: string;
		  }
		| {
				name: 'waiting-for-opponent-to-join';
				matchMakingRoomUnsub: () => void;
				matchmakingRoomRef: DocumentReference;
				yourId: string;
				opponentId: string;
		  }
	>({ name: 'standby', opponentDisconnected: false });

	const starHosting = async (data: { userId: string }) => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}

		const d: Doc['matchmakingRooms'] = {
			host: data.userId,
			queue: []
		};
		const matchmakingRoomRef = await addDoc(collections.matchmakingRooms(), d);
		let queue = $state<string[]>([]);
		const unsub = onSnapshot(matchmakingRoomRef, (doc) => {
			const data = doc.data() as Doc['matchmakingRooms'] | undefined;
			if (!data) {
				throw new Error('Cannot find matchmaking room after creation');
			}
			queue = data.queue;
		});
		flow = {
			name: 'hosting',
			yourId: data.userId,
			matchMakingRoomUnsub: unsub,
			get queue() {
				return queue;
			},
			matchmakingRoomRef
		};
	};

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

	const acceptPlayer = async (opponentId: string) => {
		if (flow.name !== 'hosting') {
			throw new Error('Invalid state');
		}
		// add opponent as an accepted player to the matchmaking room
		const dataToUpdate: Partial<Doc['matchmakingRooms']> = {
			acceptedPlayer: opponentId
		};
		await updateDoc(flow.matchmakingRoomRef, dataToUpdate);
		// create game room
		const gameRoom: Doc['gameRooms'] = {
			host: flow.yourId
		};
		const gameRoomRef = await addDoc(collections.gameRooms(), gameRoom);

		// change flow to waiting for opponent to join
		flow = {
			name: 'waiting-for-opponent-to-join',
			matchmakingRoomRef: flow.matchmakingRoomRef,
			matchMakingRoomUnsub: flow.matchMakingRoomUnsub,
			yourId: flow.yourId,
			opponentId
		};

		// listen if the opponent has joined the game room (listen to the `players` field)
		const unsub = onSnapshot(gameRoomRef, async (doc) => {
			if (flow.name !== 'waiting-for-opponent-to-join') {
				throw new Error('Invalid state');
			}
			if (doc.metadata.hasPendingWrites) {
				return;
			}
			const data = doc.data() as Doc['gameRooms'] | undefined;
			if (!data || data.opponent === undefined) {
				return;
			}
			// unsubscribe the game room being used to listen to the opponent's join
			unsub();

			// unsubscribe the matchmaking room
			flow.matchMakingRoomUnsub();
			// delete the matchmaking room
			deleteDoc(flow.matchmakingRoomRef);

			// change flow to in-match
			const players: [Player, Player] =
				Math.random() < 0.5
					? [
							{
								id: flow.yourId,
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
								id: flow.yourId,
								name: 'You'
							}
						];

			// add the field of actual player orders to the game room
			const toUpdate: Partial<Doc['gameRooms']> = {
				startPlayerOrder: players.map((p) => p.id)
			};
			await updateDoc(gameRoomRef, toUpdate);

			flow = {
				name: 'in-match',
				game: createGame({ players }),
				gameRoomRef,
				yourId: flow.yourId
			};
		});
	};
</script>

{#if session.data.ready}
	{#if session.data.user}
		{@const user = session.data.user}
		{#if flow.name === 'standby'}
			<button
				onclick={() =>
					starHosting({
						userId: user.uid
					})}
				type="submit">Enter</button
			>
		{:else if flow.name === 'hosting'}
			{#each flow.queue as q}
				<button onclick={() => acceptPlayer(q)}>{q}</button>
			{/each}
		{:else if flow.name === 'waiting-for-opponent-to-join'}
			<div>Waiting for {flow.opponentId} to join</div>
		{:else if flow.name === 'in-match'}
			<OnlineMatch gameRoomRef={flow.gameRoomRef} game={flow.game} yourId={flow.yourId} />
		{/if}
	{:else}
		<button onclick={googleSignInWithPopup}>Login</button>
	{/if}
{:else}
	<div>Loading...</div>
{/if}
