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
		getDoc,
	} from 'firebase/firestore';
	import { collections, type Doc } from '$lib/firestore';
	import { type ConvertToUnknown, type SafeOmit } from '$lib/utils';

	type UserWithId = Doc['users'] & { id: string };

	type GameRoomDataWhenSearching = SafeOmit<Doc['matchmakingRooms'], 'host'> & {
		host: UserWithId;
	};

	let flow = $state<
		| {
				name: 'standby';
				opponentDisconnected: boolean;
		  }
		| {
				name: 'hosting';
				yourId: string;
				queue: UserWithId[];
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
					data: GameRoomDataWhenSearching;
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
			query(
				collections.matchmakingRooms(),
				where('host', '==', doc(collections.userInfos(), data.userId)),
			),
		);
		const deletePromises = existingMatchmakingRoom.docs.map((doc) => deleteDoc(doc.ref));
		await Promise.all(deletePromises);

		const d: Doc['matchmakingRooms'] = {
			host: doc(collections.userInfos(), data.userId),
			queue: [],
			state: {
				type: 'waiting',
			},
		};
		const matchmakingRoomRef = await addDoc(collections.matchmakingRooms(), d);
		let queue = $state<UserWithId[]>([]);
		const unsub = onSnapshot(matchmakingRoomRef, async (snap) => {
			const data = snap.data() as Doc['matchmakingRooms'] | undefined;
			if (!data) {
				throw new Error('Cannot find matchmaking room after creation');
			}
			queue = await Promise.all(
				data.queue.map(async (userId) => {
					if (userInfoCache.has(userId)) {
						return {
							...userInfoCache.get(userId)!,
							id: userId,
						};
					}
					const snap = await getDoc(doc(collections.userInfos(), userId));
					const data = snap.data() as Doc['users'];
					userInfoCache.set(userId, {
						displayName: data.displayName,
						photoURL: data.photoURL,
					});
					return {
						...data,
						id: userId,
					};
				}),
			);
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
			host: doc(collections.userInfos(), flow.yourId),
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
		const unsub = onSnapshot(gameRoomRef, async (snap) => {
			if (!snap.exists()) {
				return;
			}
			if (flow.name !== 'waiting-for-opponent-to-join') {
				throw new Error('Invalid state');
			}
			if (snap.metadata.hasPendingWrites) {
				return;
			}
			const data = snap.data() as Doc['gameRooms'];
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
					opponent: doc(collections.userInfos(), opponentId),
					startPlayerOrder: [players[0].id, players[1].id],
					drops: [],
					quitter: null,
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

	const userInfoCache = new Map<
		string /* user id */,
		{
			displayName: string | null;
			photoURL: string | null;
		}
	>();

	const searchForRoom = () => {
		if (flow.name !== 'standby') {
			throw new Error('Invalid state');
		}

		let rooms = $state<
			{
				ref: DocumentReference;
				data: GameRoomDataWhenSearching;
			}[]
		>([]);

		const unsub = onSnapshot(
			query(collections.matchmakingRooms(), where('state.type', '==', 'waiting')),
			async (snapshot) => {
				rooms = await Promise.all(
					snapshot.docs.map(
						async (
							roomSnap,
						): Promise<{
							ref: DocumentReference;
							data: GameRoomDataWhenSearching;
						}> => {
							const data = roomSnap.data() as Doc['matchmakingRooms'];
							const hostId = data.host.id;
							if (userInfoCache.has(hostId)) {
								return {
									ref: roomSnap.ref,
									data: {
										...data,
										host: {
											...userInfoCache.get(hostId)!,
											id: hostId,
										},
									},
								};
							}

							const hostSnap = await getDoc(doc(collections.userInfos(), hostId));
							const hostData = hostSnap.data() as Doc['users'];
							const gameRoomDataWhenSearching: GameRoomDataWhenSearching = {
								...data,
								host: {
									...hostData,
									id: hostId,
								},
							};
							userInfoCache.set(hostId, {
								displayName: hostData.displayName,
								photoURL: hostData.photoURL,
							});

							return {
								ref: roomSnap.ref,
								data: gameRoomDataWhenSearching,
							};
						},
					),
				);
				rooms = rooms.filter((room) => {
					if (!session.data.ready || !session.data.user) {
						console.error('User not ready or not logged in');
						return true;
					}
					const isOwnRoom = room.data.host.id === session.data.user.uid;
					if (isOwnRoom) {
						// delete the room if it's the user's own room
						deleteDoc(room.ref);
					}
					return !isOwnRoom;
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
		room: {
			ref: DocumentReference;
			data: GameRoomDataWhenSearching;
		},
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
			<div class="space-y-4">
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

				{#if flow.opponentDisconnected}
					<p>Your opponent has disconnected</p>
				{/if}
			</div>
		{:else if flow.name === 'hosting'}
			<div class="flex flex-col gap-4">
				<div>Select a player to play with</div>
				<ol>
					{#each flow.queue as q}
						<li>
							<button onclick={() => acceptPlayer(q.id)}>{@render userRow(q)}</button>
						</li>
					{:else}
						<li>No players in queue</li>
					{/each}
				</ol>
			</div>
		{:else if flow.name === 'waiting-for-opponent-to-join'}
			<div>Waiting for {flow.opponentId} to join</div>
		{:else if flow.name === 'in-match'}
			<OnlineMatch
				gameRoomRef={flow.gameRoomRef}
				game={flow.game}
				yourId={flow.yourId}
				onSelfQuitForcefully={() => {
					if (flow.name !== 'in-match') {
						throw new Error('Invalid state');
					}

					// let the opponent know that you have left
					updateDoc(flow.gameRoomRef, {
						'state.quitter': flow.yourId,
					});
				}}
				onOpponentQuit={() => {
					if (flow.name !== 'in-match') {
						throw new Error('Invalid state');
					}

					// delete the game room
					deleteDoc(flow.gameRoomRef);
					// the opponent has left the game
					flow = {
						name: 'standby',
						opponentDisconnected: true,
					};
				}}
			/>
		{:else if flow.name === 'searching-for-room'}
			<ul>
				{#each flow.rooms as room}
					<li>
						<button
							onclick={() => {
								joinRoom(user.uid, room);
							}}
						>
							{@render userRow(room.data.host)}
						</button>
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

{#snippet userRow(data: { photoURL: string | null; displayName: string | null })}
	<div class="flex items-center gap-2">
		<img class="aspect-square h-8 rounded-full" src={data.photoURL} alt="host profile" />
		<div>{data.displayName}</div>
	</div>
{/snippet}
