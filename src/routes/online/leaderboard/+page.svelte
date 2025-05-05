<script lang="ts">
	import Leaderboard from './Leaderboard.svelte';
	import {
		getConnContext,
		getConnectedContext,
		getPlayersContext,
		getYouContext
	} from '../+layout.svelte';

	let conn = $derived(getConnContext()());
	const connected = getConnectedContext();
	const players = getPlayersContext();
	let you = $derived(getYouContext()());
</script>

{#if conn && connected() && you}
	<Leaderboard {conn} players={players()} {you} />
{/if}
