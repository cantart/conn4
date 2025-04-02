<script lang="ts">
	import type { LocalPlayer } from '$lib/local-game.svelte';
	import { fly, scale, slide, fade } from 'svelte/transition';
	import { expoInOut, expoOut } from 'svelte/easing';

	export type GameUIDataProps = {
		players: LocalPlayer[];
		currentPlayerTurnId: number;
		table: (number | undefined)[][];
		wonPlayer:
			| {
					playerId: number;
					coordinates: [number, number][];
			  }
			| undefined;
		latestPiecePosition: [number, number] | undefined;
	};

	let props: GameUIDataProps & {
		onDrop: (column: number) => void;
		onRestart: () => void;
		isColumnCannotDrop: boolean;
	} = $props();

	if (props.players.length !== 2) {
		throw new Error('GameUI requires exactly 2 players');
	}

	const useLatestPieceRing = import.meta.env.VITE_USE_LATEST_PIECE_RING === 'true';
</script>

<div class="flex flex-col justify-center gap-2">
	<div class="flex flex-wrap justify-center gap-4">
		{#each props.players as player, i (player.id)}
			<span
				class:opacity-25={props.currentPlayerTurnId !== player.id}
				class="flex items-center gap-2 transition-all"
			>
				<div class="aspect-square h-8 rounded-full {i === 0 ? 'bg-primary' : 'bg-secondary'}"></div>
				<p class="text-xs-rs">
					{player.name}
				</p>
			</span>
		{/each}
	</div>

	<div class="scrollbar-thin w-screen overflow-x-auto text-center">
		<div in:slide class="inline-block">
			{#each props.table as row, i (i)}
				<div class="flex justify-center">
					{#each row as cell, j (j)}
						{@const halfOpacity =
							!!props.wonPlayer &&
							!props.wonPlayer.coordinates.some(([row, col]) => row === i && col === j)}
						<button
							class:cursor-auto={props.isColumnCannotDrop}
							class="border-neutral grid aspect-square w-14 place-items-center border md:w-16 lg:w-20"
							onclick={() => {
								if (props.isColumnCannotDrop) return;
								props.onDrop(j);
							}}
						>
							{#if cell}
								<div
									class="h-full w-full {useLatestPieceRing &&
										props.latestPiecePosition?.[0] === i &&
										props.latestPiecePosition?.[1] === j &&
										'ring-accent z-10 rounded-full ring-4'}"
									in:fly={{ y: -10, easing: expoOut }}
									out:scale={{
										delay: Math.random() * 300,
										easing: expoInOut
									}}
								>
									{@render piece({
										halfOpacity,
										skin: cell === props.players[0].id ? 'bg-primary' : 'bg-secondary'
									})}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	{#if props.wonPlayer}
		<div class="mt-2 flex flex-col items-center justify-center gap-2" transition:slide>
			<p class="text-base-rs font-bold">
				{props.wonPlayer.playerId === props.players[0].id
					? props.players[0].name
					: props.players[1].name} wins!
			</p>
			<button
				class="btn btn-accent btn-sm"
				onclick={props.onRestart}
				in:fade={{
					delay: 500
				}}>Restart</button
			>
		</div>
	{/if}
</div>

{#snippet piece({ halfOpacity, skin }: { halfOpacity: boolean; skin: string })}
	<div class:opacity-50={halfOpacity} class="h-full w-full rounded-full {skin} ring-red-300"></div>
{/snippet}
