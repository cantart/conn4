<script lang="ts">
	import { getContext } from 'svelte';
	import type { CustomContext } from '../types';
	import Leaderboard from './Leaderboard.svelte';

	let conn = $derived(getContext<CustomContext['conn']>('conn')());
	const connected = getContext<CustomContext['connected']>('connected');
	const players = getContext<CustomContext['players']>('players');
	let you = $derived(getContext<CustomContext['you']>('you')());
</script>

{#if conn && connected() && you}
	<Leaderboard {conn} players={players()} {you} />
{/if}
