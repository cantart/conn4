<script lang="ts">
	import type { LocalPlayer } from '$lib/local-game.svelte';
	import { fly, scale, slide, fade } from 'svelte/transition';
	import { expoInOut, expoOut } from 'svelte/easing';
	import { m } from './paraglide/messages';
	import { flip } from 'svelte/animate';
	import { useCrossfade } from './transitions';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';

	type GameUIPlayer = LocalPlayer & { teamId: number; online?: boolean };

	export type GameUIDataProps = {
		players: GameUIPlayer[];
		teams: {
			id: number;
			name: string;
		}[];
		currentTeamId: number;
		table: ({ playerId: string; teamId: number; playerName?: string } | undefined)[][];
		winner:
			| {
					teamId: number;
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

	let teamToPlayers = $derived.by(() => {
		const map = new Map<number, GameUIPlayer[]>();
		for (const player of props.players) {
			if (!map.has(player.teamId)) {
				map.set(player.teamId, [player]);
			} else {
				map.get(player.teamId)?.push(player);
			}
		}
		return map;
	});

	const useLatestPieceRing = import.meta.env.VITE_USE_LATEST_PIECE_RING === 'true';

	let tableFull = $derived(!props.table.some((row) => row.some((cell) => cell === undefined)));

	const { send, receive } = useCrossfade();

	let initialScrollLeft = new Tween(0, {
		duration: 250,
		easing: cubicOut
	});

	let scrollContainer: HTMLElement;

	$effect(() => {
		if (scrollContainer) {
			scrollContainer.scrollLeft = initialScrollLeft.current;
		}
	});

	onMount(() => {
		const scrollWidth = scrollContainer.scrollWidth;
		const clientWidth = scrollContainer.clientWidth;
		const targetScrollLeft = (scrollWidth - clientWidth) / 2;
		initialScrollLeft.target = Math.max(0, targetScrollLeft);
	});
</script>

<div class="flex flex-col justify-center gap-2">
	<div class="flex flex-wrap justify-center gap-4">
		{#each props.teams as team, i (team.id)}
			<span
				class:opacity-25={props.currentTeamId !== team.id}
				class="flex items-center gap-1 transition-all"
			>
				<div
					class="aspect-square h-7 rounded-full md:h-8 {i === 0 ? 'bg-primary' : 'bg-secondary'}"
				></div>
				<p>{team.name}</p>
				<ul class="text-left">
					{#each teamToPlayers.get(team.id)! as player (player.id)}
						<li animate:flip in:receive={{ key: player.id }} out:send={{ key: player.id }}>
							{#if player.online !== undefined}
								<div
									class="status transition-colors {player.online
										? 'status-success'
										: 'status-error'}"
								></div>
							{/if}
							<span class="text-sm md:text-base">{player.name}</span>
						</li>
					{/each}
				</ul>
			</span>
		{/each}
	</div>

	<div class="scrollbar-thin w-screen overflow-x-auto text-center" bind:this={scrollContainer}>
		<div in:slide class="inline-block">
			{#each props.table as row, i (i)}
				<div class="flex justify-center">
					{#each row as cell, j (j)}
						{@const halfOpacity =
							!!props.winner &&
							!props.winner.coordinates.some(([row, col]) => row === i && col === j)}
						<button
							class:cursor-auto={props.dropDisabled}
							class="border-neutral grid aspect-square w-12 place-items-center border sm:w-14 md:w-16 2xl:w-20"
							onclick={() => {
								if (
									props.as === 'spectator' ||
									props.dropDisabled ||
									props?.dropping ||
									props.teams.length !== 2 ||
									tableFull
								)
									return;
								props.onDrop(j);
							}}
						>
							{#if cell}
								<div
									class={[
										'h-full w-full',
										{
											'ring-accent z-10 rounded-full ring-4':
												useLatestPieceRing &&
												props.latestPiecePosition?.[0] === i &&
												props.latestPiecePosition?.[1] === j,
											tooltip: !!cell.playerName
										}
									]}
									data-tip={cell.playerName}
									in:fly={{ y: -10, easing: expoOut }}
									out:scale={{
										delay: Math.random() * 300,
										easing: expoInOut
									}}
								>
									{@render piece({
										halfOpacity,
										skin: cell.teamId === props.teams[0].id ? 'bg-primary' : 'bg-secondary'
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
							props.winner.teamId === props.teams[0].id ? props.teams[0].name : props.teams[1].name
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
