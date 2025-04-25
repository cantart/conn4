<script lang="ts">
	import { onMount } from 'svelte';
	import type { DbConnection, Player } from '../../../module_bindings';
	import { UseLeaderboard } from '../UseLeaderboard.svelte';
	import type { SvelteMap } from 'svelte/reactivity';
	import { m } from '$lib/paraglide/messages';
	import { flip } from 'svelte/animate';
	import { useCrossfade } from '$lib/transitions';
	import PlayerNameWithStatus from '../PlayerNameWithStatus.svelte';
	import type { You } from '$lib';

	let { conn, players, you }: { conn: DbConnection; players: SvelteMap<bigint, Player>; you: You } =
		$props();
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
		<h1>{m.witty_few_owl_amaze()}</h1>
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
					{@const p = players.get(item.player.data)}
					{@const nameStatus = p
						? { name: p.name ?? '(???)', online: p.online }
						: { name: '(???)', online: false }}
					{@const isYou = you.identity.data === item.player.data}
					<tr
						animate:flip
						in:receive={{ key: item.player.data }}
						out:send={{ key: item.player.data }}
					>
						<th>{i + 1}</th>
						<td
							><div
								data-tip={m.you()}
								class={{
									'font-semibold': isYou,
									tooltip: isYou
								}}
							>
								<PlayerNameWithStatus name={nameStatus.name} online={nameStatus.online} />
							</div></td
						>
						<td>{(item.winRate * 100).toFixed(2) + '%'}</td>
						<td>{item.wins} / {item.total}</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
