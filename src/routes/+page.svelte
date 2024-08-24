<script lang="ts">
	import { createGame } from '$lib/game.svelte';
	import { fly, scale, slide } from 'svelte/transition';
	import { expoInOut, expoOut } from 'svelte/easing';
	import { z } from 'zod';

	let game: null | ReturnType<typeof createGame> = $state(null);
	let socket = $state<WebSocket | null>(null);
	const yourId = Math.random().toString();

	$effect(() => {
		const s = new WebSocket('wss://159.65.15.16:80');
		socket = s;

		// Connection opened
		s.addEventListener('open', () => {
			s.send(JSON.stringify({ type: 'join', userId: yourId }));
		});

		// Listen for messages
		s.addEventListener('message', (event) => {
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
			const parsed = incomingMessageSchema.safeParse(JSON.parse(event.data));
			if (!parsed.success) {
				console.error(parsed.error.errors);
				return;
			}
			const data = parsed.data;
			if (data.type === 'start') {
				const { player, opponentId, roomId } = data;
				console.log('start', player, opponentId, roomId);
				if (player === 1) {
					game = createGame({
						players: [
							{
								id: yourId,
								name: 'You'
							},
							{
								id: opponentId,
								name: 'Opponent'
							}
						],
						roomId
					});
				} else {
					game = createGame({
						players: [
							{
								id: opponentId,
								name: 'Opponent'
							},
							{
								id: yourId,
								name: 'You'
							}
						],
						roomId
					});
				}
			} else if (data.type === 'drop') {
				const { column } = data;
				game!.dropPiece(column);
			} else if (data.type === 'restart') {
				game!.restart();
			} else if (data.type === 'error') {
				console.error(data.message);
			} else if (data.type === 'opponent-disconnected') {
				game = null;
			}
		});
	});
</script>

{#if !game}
	<div>finding match...</div>
{:else}
	<div class="flex min-h-screen flex-col justify-center gap-2">
		<div class="flex justify-center gap-8">
			{#each game.players as player, i}
				<span
					class:opacity-25={game.currentPlayerTurn().id !== player.id}
					class="flex items-center gap-2 transition-all"
				>
					<div class="h-8 w-8 rounded-full {i === 0 ? 'bg-red-500' : 'bg-yellow-500'}"></div>
					<p>
						{player.name}
					</p>
				</span>
			{/each}
		</div>

		<div transition:slide>
			{#each game.table as row, i}
				<div class="flex justify-center">
					{#each row as cell, j}
						{@const halfOpacity =
							!!game.wonPlayer &&
							!game.wonPlayer.coordinates.some(([row, col]) => row === i && col === j)}
						{@const cannotPlay = game.wonPlayer || game.currentPlayerTurn().id !== yourId}

						<button
							class:cursor-auto={cannotPlay}
							class="grid aspect-square w-[5rem] place-items-center border border-slate-800"
							onclick={() => {
								if (cannotPlay) return;
								// game!.dropPiece(j);
								console.log('sending drop', j);
								socket!.send(JSON.stringify({ type: 'drop', column: j, roomId: game!.roomId }));
							}}
						>
							{#if cell.playerId}
								<div
									class="h-full w-full"
									in:fly={{ y: -10, easing: expoOut }}
									out:scale={{
										delay: Math.random() * 300,
										easing: expoInOut
									}}
								>
									{@render piece({
										halfOpacity,
										skin: cell.playerId === game.players[0].id ? 'bg-red-500' : 'bg-yellow-500'
									})}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>

		{#if game.wonPlayer}
			<div class="my-2 flex flex-col items-center justify-center" transition:slide>
				<p class="text-2xl font-bold">
					{game.wonPlayer.player.name} won!
				</p>
				<button
					class="block underline"
					onclick={() => {
						socket!.send(JSON.stringify({ type: 'restart', roomId: game!.roomId }));
					}}
					in:fly={{
						y: -10,
						delay: 500
					}}>Restart</button
				>
			</div>
		{/if}
	</div>
{/if}

{#snippet piece({ halfOpacity, skin }: { halfOpacity: boolean; skin: string })}
	<div class:opacity-50={halfOpacity} class="h-full w-full rounded-full {skin}"></div>
{/snippet}
