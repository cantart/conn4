<script lang="ts">
	import { getContext } from 'svelte';
	import type { CustomerContext } from '../types';
	import Leaderboard from './Leaderboard.svelte';

	let conn = $derived(getContext<CustomerContext['conn']>('conn')());
	const connected = getContext<CustomerContext['connected']>('connected');
	const players = getContext<CustomerContext['players']>('players');
	let you = $derived(getContext<CustomerContext['you']>('you')());
</script>

{#if conn && connected() && you}
	<Leaderboard {conn} players={players()} {you} />
{/if}
