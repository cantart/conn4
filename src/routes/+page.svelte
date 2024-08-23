<script lang="ts">
	import { createGame, type Player } from '$lib/game.svelte';

	const players: [Player, Player] = [
		{ id: '1', name: 'player 1' },
		{ id: '2', name: 'player 2' }
	];
	const game = createGame({ players });
</script>

<div class="mt-2 flex flex-col gap-2">
	<div class="flex justify-center gap-8">
		{#each players as player, i}
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

	{#if game.wonPlayer}
		<div class="my-2 flex flex-col items-center justify-center">
			<p class="text-2xl font-bold">
				{game.wonPlayer.player.name} won!
			</p>
			<button class="block underline" onclick={game.restart}>Restart</button>
		</div>
	{/if}

	{#snippet piece({ halfOpacity, skin }: { halfOpacity: boolean; skin: string })}
		<div class:opacity-50={halfOpacity} class="h-full w-full rounded-full {skin}"></div>
	{/snippet}

	<div>
		{#each game.table as row, i}
			<div class="flex justify-center">
				{#each row as cell, j}
					{@const halfOpacity =
						!!game.wonPlayer &&
						!game.wonPlayer.coordinates.some(([row, col]) => row === i && col === j)}

					<button
						class:cursor-auto={game.wonPlayer}
						class="grid aspect-square w-[5rem] place-items-center border border-slate-800"
						onclick={() => game.dropPiece(j)}
					>
						{#if cell.playerId}
							{@render piece({
								halfOpacity,
								skin: cell.playerId === '1' ? 'bg-red-500' : 'bg-yellow-500'
							})}
						{/if}
					</button>
				{/each}
			</div>
		{/each}
	</div>
</div>
