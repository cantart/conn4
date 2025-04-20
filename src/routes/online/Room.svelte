<script lang="ts">
	import type { GameUIDataProps } from '$lib/GameUI.svelte';
	import GameUi from '$lib/GameUI.svelte';
	import { fly } from 'svelte/transition';
	import { type EventContext, JoinRoom } from '../../module_bindings';
	import type { RoomData } from './types';
	import { UseGame } from './UseGame.svelte';
	import { UseRoom } from './UseRoom.svelte';
	import { flip } from 'svelte/animate';
	import { UseRoomMessages } from './UseRoomMessages.svelte';
	import { m } from '$lib/paraglide/messages';

	let { conn, players, roomId, initialRoomTitle, you, leaveRoom }: RoomData = $props();

	let joinRooms = $state<JoinRoom[]>(Array.from(conn.db.joinRoom.iter()));

	const useMessages = new UseRoomMessages(conn, roomId);
	const useGame = new UseGame(conn, roomId, you.identity);
	const useRoom = new UseRoom(conn, roomId, initialRoomTitle);

	const joinRoomOnInsert = (_: EventContext, jr: JoinRoom) => {
		joinRooms.push(jr);
	};
	const joinRoomOnDelete = async (_: EventContext, jr: JoinRoom) => {
		const index = joinRooms.findIndex((j) => j.joiner.data === jr.joiner.data);
		if (index !== -1) {
			joinRooms.splice(index, 1);
		} else {
			throw new Error(`Join room not found for deletion: ${jr.joiner}`);
		}
		if (jr.joiner.data === you.identity.data) {
			if (allJoinRoomHandle.isActive()) {
				try {
					allJoinRoomHandle.unsubscribe();
				} catch (e) {
					console.error('Error unsubscribing from all join room handle:', e);
				}
			}
			await Promise.all([useRoom.stop(), useGame.stop(), useMessages.stop()]);
			removeJoinRoomListeners();
			leaving = false;
			leaveRoom(you);
		}
	};
	const joinRoomOnUpdate = (_: EventContext, o: JoinRoom, n: JoinRoom) => {
		const index = joinRooms.findIndex((j) => j.joiner.data === o.joiner.data);
		if (index !== -1) {
			joinRooms[index] = n;
		} else {
			throw new Error(`Join room not found for update: ${o.joiner}`);
		}
	};
	// TODO: Move join rooms inside a room to `UseRoom` just like what happens in `UseGame`.
	const allJoinRoomHandle = conn
		.subscriptionBuilder()
		.onError((ctx) => {
			console.error('Error fetching all join rooms:', ctx.event);
		})
		.subscribe(`SELECT * FROM join_room WHERE room_id = '${roomId}'`);

	conn.db.joinRoom.onInsert(joinRoomOnInsert);
	conn.db.joinRoom.onDelete(joinRoomOnDelete);
	conn.db.joinRoom.onUpdate(joinRoomOnUpdate);
	const removeJoinRoomListeners = () => {
		conn.db.joinRoom.removeOnInsert(joinRoomOnInsert);
		conn.db.joinRoom.removeOnDelete(joinRoomOnDelete);
		conn.db.joinRoom.removeOnUpdate(joinRoomOnUpdate);
	};

	let leaving = $state(false);
	const leave = () => {
		leaving = true;
		conn.reducers.leaveRoom();
	};

	const onStartGame = async () => {
		await useGame.createGame();
	};

	let dropping = $state(false);
	/**
	 * Not null if the game is ready to be played.
	 */
	const readyGameState = $derived.by((): GameUIDataProps | null => {
		if (!useGame.game || !useGame.gameCurrentTeam || !useGame.teams.length) {
			return null;
		}

		const yourTurn = useGame.gameCurrentTeam.teamId === useGame.yourJoinTeam?.teamId;
		return {
			currentTeamId: useGame.gameCurrentTeam.teamId,
			latestPiecePosition: useGame.game.latestMove
				? [useGame.game.latestMove.x, useGame.game.latestMove.y]
				: undefined,
			players: useGame.joinTeams.map((jt) => {
				const player = players.get(jt.joiner.data);
				return {
					id: jt.joiner.toHexString(),
					name: player?.name ?? 'Unknown',
					teamId: jt.teamId,
					online: player?.online
				};
			}),
			teams: useGame.teams.map((team) => {
				return {
					id: team.id,
					name: team.name
				};
			}),
			table: useGame.game.table.map((row) =>
				row.map((cell) => {
					if (cell === undefined) {
						return undefined;
					}
					return {
						playerId: cell.dropper.toHexString(),
						teamId: cell.teamId
					};
				})
			),
			winner: useGame.game.winner
				? {
						coordinates: useGame.game.winner.coordinates.map((c) => [c.x, c.y]),
						teamId: useGame.game.winner.teamId
					}
				: undefined,
			dropDisabled: !!useGame.game.winner || !yourTurn || useGame.gameJoining
		};
	});

	conn.reducers.onDropPiece((ctx) => {
		if (ctx.event.status.tag !== 'Committed') {
			console.error('Error dropping piece:', ctx.event.status);
			dropping = false;
		}
		// For the happy case, `dropping` is reset when the `readyGameState` is changed.
	});
	const drop = (col: number) => {
		dropping = true;
		conn.reducers.dropPiece(col);
		// TODO: Optimistic update of the game state.
	};
	$effect(() => {
		if (readyGameState) {
			// Game state starts or is updated.
			dropping = false;
		} else {
			// Game state is not ready.
			dropping = false;
		}
		// Reset `dropping` anyway.
	});

	let restarting = $state(false);

	const restartGameHasWinner = () => {
		restarting = true;
		conn.reducers.restartGameHasWinner();
	};
	conn.reducers.onRestartGameHasWinner((ctx) => {
		restarting = false;
		if (ctx.event.status.tag !== 'Committed') {
			console.error('Error restarting game:', ctx.event.status);
		}
	});

	const restartGameFullTable = () => {
		restarting = true;
		conn.reducers.restartGameTableFull();
	};
	conn.reducers.onRestartGameTableFull((ctx) => {
		restarting = false;
		if (ctx.event.status.tag !== 'Committed') {
			console.error('Error restarting game:', ctx.event.status);
		}
	});
</script>

<div class="space-y-8">
	<div class="flex items-center gap-4 justify-self-center">
		{@render title()}

		<button onclick={leave} class="btn btn-xs btn-error" disabled={leaving}>{m.leave()}</button>
	</div>

	{@render gameArea()}

	<div class="flex justify-center gap-4">
		{@render playerList()}
		{@render chat()}
	</div>
</div>

{#snippet gameArea()}
	<div class="text-center">
		{#if useGame.loading}
			<span class="loading loading-spinner loading-lg"></span>
		{:else if readyGameState}
			<!-- Game is being displayed. -->
			{#if useGame.yourJoinTeam}
				<!-- The match has started with at least you in it -->
				{#if useGame.emptyTeamIds.size > 0}
					<!-- can happen if the opponent left mid-game -->
					<span>{m.waiting_another_player_to_join()}</span>
				{/if}
				<div class="space-y-2">
					<GameUi
						as="player"
						{...readyGameState}
						onDrop={drop}
						onRestartHasWinner={restartGameHasWinner}
						onRestartFullTable={restartGameFullTable}
						{restarting}
						{dropping}
					/>
					{#if useGame.oppositeTeam && !readyGameState.winner}
						{@const oppositeTeam = useGame.oppositeTeam}
						<button
							transition:fly={{ y: -10, duration: 150 }}
							disabled={useGame.gameJoining}
							onclick={() => useGame.joinTeam(oppositeTeam.id)}
							class="btn btn-primary"
							>{m.steep_large_snail_catch({ name: oppositeTeam.name })}</button
						>
					{/if}
				</div>
			{:else}
				<!-- You are watching a match as a spectator. -->
				<div class="space-y-2">
					<GameUi as="spectator" {...readyGameState} />
					<ul class="flex justify-center gap-2">
						{#each useGame.teams as team (team.id)}
							<li>
								<button
									disabled={useGame.gameJoining}
									onclick={() => useGame.joinTeam(team.id)}
									class="btn btn-primary"
									>{m.join_game({
										name: team.name
									})}</button
								>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else}
			<button onclick={onStartGame} disabled={useGame.gameJoining} class="btn btn-primary"
				>{m.start_game()}</button
			>
		{/if}
	</div>
{/snippet}

{#snippet title()}
	{#if useRoom.title}
		<h1 class="text-center">{useRoom.title}</h1>
	{:else}
		<span class="loading loading-spinner loading-sm"></span>
	{/if}
{/snippet}

{#snippet playerList()}
	<ul>
		{#each joinRooms as jr (jr.joiner)}
			{@const player = players.get(jr.joiner.data)}
			<li>
				{#if player}
					<div
						class="status transition-colors {player.online ? 'status-success' : 'status-error'}"
					></div>
					{#if player.identity.data === you.identity.data}
						<span>
							<span class="font-bold">{player.name} ({m.you()})</span>
						</span>
					{:else}
						{player.name}
					{/if}
				{:else}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet chat()}
	<div class="space-y-4 rounded">
		<!-- message input area -->
		<form
			class="flex gap-2"
			onsubmit={async (e) => {
				e.preventDefault();
				const text = new FormData(e.currentTarget).get('text') as string;
				if (!text) {
					return;
				}
				await useMessages.sendMessage(text);
				e.currentTarget.reset();
			}}
		>
			<input
				autocomplete="off"
				type="text"
				name="text"
				placeholder={m.message()}
				class="input grow"
			/>
			<button disabled={useMessages.sendingMessage} class="btn-primary btn" type="submit"
				>&gt;</button
			>
		</form>

		<ol class="h-96 overflow-auto">
			<!-- message display area -->
			{#each useMessages.messages as msg (msg.sentAt)}
				{@const isYours = msg.sender.data === you.identity.data}
				<div
					in:fly={{
						y: -100,
						duration: 150
					}}
					animate:flip={{
						duration: 150
					}}
					class="chat {isYours ? 'chat-end' : 'chat-start'}"
				>
					<div class="chat-header">
						{#if msg.sender.data === you.identity.data}
							{m.you()}
						{:else if players.has(msg.sender.data)}
							{@const player = players.get(msg.sender.data)!}
							<div class="flex items-center gap-1 overflow-visible">
								{#if !player.online}
									<div class="tooltip tooltip-right" data-tip="Offline">
										<div class="status bg-red-500"></div>
									</div>
								{/if}
								<span>{player.name}</span>
							</div>
						{:else}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						<time class="text-xs opacity-50"
							>{msg.sentAt
								.toDate()
								.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</time
						>
					</div>
					<div
						class={[
							'chat-bubble',
							{
								'chat-bubble-accent': isYours
							}
						]}
					>
						{msg.text}
					</div>
					<!-- <div class="chat-footer opacity-50">Delivered</div> -->
				</div>
			{:else}
				<p class="text-center">{m.no_messages()}</p>
			{/each}
		</ol>
	</div>
{/snippet}
