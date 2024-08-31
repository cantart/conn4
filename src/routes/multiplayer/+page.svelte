<script lang="ts">
	import { googleSignInWithPopup } from '$lib/firebase.client';
	import { createGame, type Game, type Player } from '$lib/game.svelte';
	import OnlineMatch from '$lib/OnlineMatch.svelte';
	import { session } from '$lib/session.svelte';
	import {
		addDoc,
		onSnapshot,
		type DocumentReference,
		deleteDoc,
		updateDoc,
		query,
		where,
		arrayUnion,
		doc,
		getDocs,
	} from 'firebase/firestore';
	import { collections, type Doc } from '$lib/firestore';
	import { type ConvertToUnknown } from '$lib/utils';

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
		| {
				name: 'searching-for-room';
				matchMakingRoomUnsub: () => void;
				rooms: {
					ref: DocumentReference;
					data: Doc['matchmakingRooms'];
				}[];
		  }
	>({ name: 'standby', opponentDisconnected: false });

	let startingHost = $state(false);
	const starHosting = async (data: { userId: string }) => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}
		startingHost = true;

		// delete any existing matchmaking room whose host is the same as the current user
		const existingMatchmakingRoom = await getDocs(
			query(collections.matchmakingRooms(), where('host', '==', data.userId)),
		);
		const deletePromises = existingMatchmakingRoom.docs.map((doc) => deleteDoc(doc.ref));
		await Promise.all(deletePromises);

		const d: Doc['matchmakingRooms'] = {
			host: data.userId,
			queue: [],
			state: {
				type: 'waiting',
			},
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
			matchmakingRoomRef,
		};
		startingHost = false;
	};

	const acceptPlayer = async (opponentId: string) => {
		if (flow.name !== 'hosting') {
			throw new Error('Invalid state');
		}
		// create game room
		const gameRoom: Doc['gameRooms'] = {
			host: flow.yourId,
			state: {
				type: 'waiting',
			},
		};
		const gameRoomRef = await addDoc(collections.gameRooms(), gameRoom);

		// update state of the matchmaking room
		const dataToUpdate: Partial<Doc['matchmakingRooms']> = {
			state: {
				type: 'accepted',
				opponent: opponentId,
				gameRoomId: gameRoomRef.id,
			},
		};
		await updateDoc(flow.matchmakingRoomRef, dataToUpdate);

		// change flow to waiting for opponent to join
		flow = {
			name: 'waiting-for-opponent-to-join',
			matchmakingRoomRef: flow.matchmakingRoomRef,
			matchMakingRoomUnsub: flow.matchMakingRoomUnsub,
			yourId: flow.yourId,
			opponentId,
		};

		// listen if the opponent has joined the game room (listen to the `players` field)
		const unsub = onSnapshot(gameRoomRef, async (doc) => {
			if (!doc.exists()) {
				return;
			}
			if (flow.name !== 'waiting-for-opponent-to-join') {
				throw new Error('Invalid state');
			}
			if (doc.metadata.hasPendingWrites) {
				return;
			}
			const data = doc.data() as Doc['gameRooms'];
			if (data.state.type !== 'player-joined') {
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
								name: 'You',
							},
							{
								id: opponentId,
								name: 'Opponent',
							},
						]
					: [
							{
								id: opponentId,
								name: 'Opponent',
							},
							{
								id: flow.yourId,
								name: 'You',
							},
						];

			// start the game
			const toUpdate: Partial<Doc['gameRooms']> = {
				state: {
					type: 'playing',
					opponent: opponentId,
					startPlayerOrder: [players[0].id, players[1].id],
					drops: [],
				},
			};
			await updateDoc(gameRoomRef, toUpdate);

			flow = {
				name: 'in-match',
				game: createGame({ players }),
				gameRoomRef,
				yourId: flow.yourId,
			};
		});
	};

	const searchForRoom = () => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}

		let rooms = $state<
			{
				ref: DocumentReference;
				data: Doc['matchmakingRooms'];
			}[]
		>([]);

		const unsub = onSnapshot(
			query(collections.matchmakingRooms(), where('state.type', '==', 'waiting')),
			(snapshot) => {
				rooms = snapshot.docs.map((doc) => {
					return {
						ref: doc.ref,
						data: doc.data() as Doc['matchmakingRooms'],
					};
				});
			},
		);

		flow = {
			name: 'searching-for-room',
			matchMakingRoomUnsub: unsub,
			get rooms() {
				return rooms;
			},
		};
	};

	const joinRoom = async (
		userId: string,
		room: { ref: DocumentReference; data: Doc['matchmakingRooms'] },
	) => {
		const toUpdate: Partial<ConvertToUnknown<Doc['matchmakingRooms']>> = {
			queue: arrayUnion(userId),
		};
		await updateDoc(room.ref, toUpdate);

		// listen if the game room has been created
		const unsub = onSnapshot(room.ref, (snap) => {
			if (flow.name !== 'searching-for-room') {
				throw new Error('Invalid state');
			}

			const data = snap.data() as Doc['matchmakingRooms'] | undefined;
			if (!data || data.state.type !== 'accepted') {
				return;
			}
			unsub();
			flow.matchMakingRoomUnsub();

			const gameRoomRef = doc(collections.gameRooms(), data.state.gameRoomId);
			const joinGameRoomUnsub = onSnapshot(gameRoomRef, async (gameRoomSnap) => {
				const gameRoomData = gameRoomSnap.data() as Doc['gameRooms'] | undefined;
				if (!gameRoomData) {
					return;
				}

				// join the game room
				const toUpdate: Partial<Doc['gameRooms']> = {
					state: {
						type: 'player-joined',
						opponent: userId,
					},
				};
				await updateDoc(gameRoomRef, toUpdate);
				joinGameRoomUnsub();

				// listen for host to start the game (listen to the `startPlayerOrder` field)
				const startPlayerOrderUnsub = onSnapshot(gameRoomRef, async (gameRoomSnap) => {
					if (!gameRoomSnap.exists()) {
						return;
					}
					const gameRoomData = gameRoomSnap.data() as Doc['gameRooms'];

					if (gameRoomData.state.type !== 'playing') {
						return;
					}
					startPlayerOrderUnsub();

					const players: [Player, Player] = [
						{
							id: gameRoomData.state.startPlayerOrder[0],
							name: gameRoomData.state.startPlayerOrder[0] === userId ? 'You' : 'Opponent',
						},
						{
							id: gameRoomData.state.startPlayerOrder[1],
							name: gameRoomData.state.startPlayerOrder[1] === userId ? 'You' : 'Opponent',
						},
					];

					flow = {
						name: 'in-match',
						game: createGame({
							players,
						}),
						gameRoomRef,
						yourId: userId,
					};
				});
			});
		});
	};
</script>

{#if session.data.ready}
	{#if session.data.user}
		{@const user = session.data.user}
		{#if flow.name === 'standby'}
			<div class="flex flex-col gap-2">
				<button
					onclick={() => {
						if (startingHost) {
							return;
						}
						starHosting({
							userId: user.uid,
						});
					}}
					type="submit">Host</button
				>
				<button
					onclick={() => {
						searchForRoom();
					}}>Join</button
				>
			</div>
		{:else if flow.name === 'hosting'}
			<div>
				<div>Select a player to play with</div>
				<ol>
					{#each flow.queue as q}
						<li>
							<button onclick={() => acceptPlayer(q)}>{q}</button>
						</li>
					{:else}
						<li>No players in queue</li>
					{/each}
				</ol>
			</div>
		{:else if flow.name === 'waiting-for-opponent-to-join'}
			<div>Waiting for {flow.opponentId} to join</div>
		{:else if flow.name === 'in-match'}
			<OnlineMatch gameRoomRef={flow.gameRoomRef} game={flow.game} yourId={flow.yourId} />
		{:else if flow.name === 'searching-for-room'}
			<ul>
				{#each flow.rooms as room}
					<li>
						<button
							onclick={() => {
								joinRoom(user.uid, room);
							}}>{room.data.host}</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<button onclick={googleSignInWithPopup}>Login</button>
	{/if}
{:else}
	<div>Loading...</div>
{/if}
