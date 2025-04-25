<script lang="ts">
	import { onMount } from 'svelte';
	import type { DbConnection, Player } from '../../../module_bindings';
	import { UseLeaderboard } from '../UseLeaderboard.svelte';
	import type { SvelteMap } from 'svelte/reactivity';
	import { m } from '$lib/paraglide/messages';
	import { flip } from 'svelte/animate';
	import { useCrossfade } from '$lib/transitions';

	let { conn, players }: { conn: DbConnection; players: SvelteMap<bigint, Player> } = $props();
	const lb = new UseLeaderboard(conn);

	const headColumns = [
		'',
		m.legal_cool_dolphin_cry(),
		m.light_north_manatee_propel(),
		m.every_fancy_bat_ask()
	] as const;

	const { send, receive } = useCrossfade();

	onMount(() => {
		return () => {
			lb.stop();
		};
	});
</script>

<div class="space-y-2 overflow-x-auto">
	<div class="flex justify-center gap-2">
		<h1>Last Month</h1>
		<a href="/online" class="btn btn-xs btn-error btn-outline">✈️ {m.sleek_strong_turtle_pat()}</a>
	</div>
	<table class="table">
		<thead>
			<tr>
				{#each headColumns as col (col)}
					<th>{col}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if lb.oneMonth.loading}
				<tr>
					<td colspan="4" class="text-center">
						<div class="loading loading-sm"></div>
					</td>
				</tr>
			{:else}
				{#each lb.oneMonth.data as item, i (item.player.data)}
					{@const name = players.get(item.player.data)?.name ?? '(Unknown)'}
					<tr
						animate:flip
						in:receive={{ key: item.player.data }}
						out:send={{ key: item.player.data }}
					>
						<th>{i + 1}</th>
						<td>{name}</td>
						<td>{(item.winRate * 100).toFixed(2) + '%'}</td>
						<td>{item.wins} / {item.total}</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
