<script lang="ts">
	import { type Game } from '$lib/game.svelte';
	import { fly, scale, slide, fade } from 'svelte/transition';
	import { expoInOut, expoOut } from 'svelte/easing';

	let props: {
		game: Game;
		isColumnCannotDrop: boolean;
		onDrop: (column: number) => void;
		onRestart: () => void;
	} = $props();
</script>

<div class="flex flex-col justify-center gap-2">
	<div class="flex flex-wrap justify-center gap-4">
		{#each props.game.players as player, i}
			<span
				class:opacity-25={props.game.currentPlayerTurn().id !== player.id}
				class="flex items-center gap-2 transition-all"
			>
				<div
					class="aspect-square h-8 rounded-full {i === 0 ? 'bg-red-500' : 'bg-yellow-500'}"
				></div>
				<p class="text-xs-rs">
					{player.name}
				</p>
			</span>
		{/each}
	</div>

	<div class="w-screen overflow-x-auto text-center scrollbar-thin">
		<div in:slide class="inline-block">
			{#each props.game.table as row, i}
				<div class="flex justify-center">
					{#each row as cell, j}
						{@const halfOpacity =
							!!props.game.wonPlayer &&
							!props.game.wonPlayer.coordinates.some(([row, col]) => row === i && col === j)}
						<button
							class:cursor-auto={props.isColumnCannotDrop}
							class="grid aspect-square w-14 place-items-center border border-slate-800 md:w-16 lg:w-20"
							onclick={() => {
								// if (import.meta.env.PROD) {
								// 	document.body.requestFullscreen();
								// }
								if (props.isColumnCannotDrop) return;
								props.onDrop(j);
							}}
						>
							{#if cell.playerId}
								<div
									class="h-full w-full {props.game.latestPiecePosition?.[0] === i &&
										props.game.latestPiecePosition?.[1] === j &&
										'z-10 rounded-full ring-4 ring-white'}"
									in:fly={{ y: -10, easing: expoOut }}
									out:scale={{
										delay: Math.random() * 300,
										easing: expoInOut,
									}}
								>
									{@render piece({
										halfOpacity,
										skin:
											cell.playerId === props.game.players[0].id ? 'bg-red-500' : 'bg-yellow-500',
									})}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	{#if props.game.wonPlayer}
		<div class="mt-2 flex flex-col items-center justify-center gap-2" transition:slide>
			<p class="text-base-rs font-bold">
				{props.game.wonPlayer.player.name} won!
			</p>
			<button
				class="btn btn-accent btn-sm"
				onclick={props.onRestart}
				in:fade={{
					delay: 500,
				}}>Restart</button
			>
		</div>
	{/if}
</div>

{#snippet piece({ halfOpacity, skin }: { halfOpacity: boolean; skin: string })}
	<div class:opacity-50={halfOpacity} class="h-full w-full rounded-full {skin} ring-red-300"></div>
{/snippet}
