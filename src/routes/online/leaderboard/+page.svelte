<script lang="ts">
	import { getContext } from 'svelte';
	import type { CustomerContext } from '../types';
	import Leaderboard from './Leaderboard.svelte';

	let conn = $derived(getContext<CustomerContext['conn']>('conn')());
	const connected = getContext<CustomerContext['connected']>('connected');
	const players = getContext<CustomerContext['players']>('players');
</script>

{#if conn && connected()}
	<Leaderboard {conn} players={players()} />
{/if}
