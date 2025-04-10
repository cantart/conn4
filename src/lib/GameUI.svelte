<script lang="ts">
	import type { LocalPlayer } from '$lib/local-game.svelte';
	import { fly, scale, slide, fade } from 'svelte/transition';
	import { expoInOut, expoOut } from 'svelte/easing';
	import { m } from './paraglide/messages';

	export type GameUIDataProps = {
		players: LocalPlayer[];
		currentPlayerTurnId: string;
		table: (string | undefined)[][];
		winner:
			| {
					playerId: string;
					coordinates: [number, number][];
			  }
			| undefined;
		latestPiecePosition: [number, number] | undefined;
		dropDisabled: boolean;
	};

	let props: GameUIDataProps &
		(
			| {
					as: 'player';
					onDrop: (column: number) => void;
					dropping?: boolean;
					restarting?: boolean;
					onRestartHasWinner: () => void;
					onRestartFullTable: () => void;
			  }
			| {
					as: 'spectator';
			  }
		) = $props();

	const useLatestPieceRing = import.meta.env.VITE_USE_LATEST_PIECE_RING === 'true';

	let tableFull = $derived(!props.table.some((row) => row.some((cell) => cell === undefined)));
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
							!!props.winner &&
							!props.winner.coordinates.some(([row, col]) => row === i && col === j)}
						<button
							class:cursor-auto={props.dropDisabled}
							class="border-neutral grid aspect-square w-14 place-items-center border md:w-16 lg:w-20"
							onclick={() => {
								if (
									props.as === 'spectator' ||
									props.dropDisabled ||
									props?.dropping ||
									props.players.length !== 2 ||
									tableFull
								)
									return;
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
										skin: cell.toString() === props.players[0].id ? 'bg-primary' : 'bg-secondary'
									})}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	{#if props.as === 'player'}
		{#if props.winner}
			<div class="mt-2 flex flex-col items-center justify-center gap-2" transition:slide>
				<p class="text-base-rs font-bold">
					{m.bald_great_cockroach_ripple({
						player:
							props.winner.playerId === props.players[0].id
								? props.players[0].name
								: props.players[1].name
					})}
				</p>
				{@render restartButton(props.onRestartHasWinner, props.restarting)}
			</div>
		{:else if tableFull}
			<div class="mt-2 flex flex-col items-center justify-center gap-2" transition:slide>
				<p class="text-base-rs font-bold">{m.any_cool_porpoise_grow()}</p>
				{@render restartButton(props.onRestartFullTable, props.restarting)}
			</div>
		{/if}
	{/if}
</div>

{#snippet restartButton(onRestart: () => void, restarting?: boolean)}
	<button
		class="btn btn-accent btn-sm"
		onclick={onRestart}
		disabled={restarting}
		in:fade={{
			delay: 500
		}}>{m.just_suave_impala_pick()}</button
	>
{/snippet}

{#snippet piece({ halfOpacity, skin }: { halfOpacity: boolean; skin: string })}
	<div class:opacity-50={halfOpacity} class="h-full w-full rounded-full {skin} ring-red-300"></div>
{/snippet}
