<script lang="ts" module>
	import GameUi from '$lib/GameUI.svelte';
	import { createLocalGame } from '$lib/local-game.svelte';
	import { m } from '$lib/paraglide/messages';

	const game = createLocalGame({
		players: [
			{ id: '1', name: '' },
			{ id: '2', name: '' }
		]
	});

	const playerToTeamId = {
		'1': 1,
		'2': 2
	} as const;

	let currentTeamId = $derived(playerToTeamId[game.currentPlayerTurn() as '1' | '2']);
	let winner = $derived.by(() => {
		if (!game.winner) return undefined;
		return {
			teamId: playerToTeamId[game.winner.playerId as '1' | '2'],
			coordinates: game.winner.coordinates
		};
	});
</script>

<GameUi
	as="player"
	teams={[
		{
			id: 1,
			name: m.noisy_least_newt_cure({ number: 1 })
		},
		{ id: 2, name: m.noisy_least_newt_cure({ number: 2 }) }
	]}
	players={game.players.map((player) => ({
		...player,
		teamId: player.id === '1' ? 1 : 2
	}))}
	{currentTeamId}
	table={game.table.map((row) =>
		row.map((cell) => {
			if (cell === undefined) return undefined;
			return {
				playerId: cell,
				teamId: playerToTeamId[cell as '1' | '2']
			};
		})
	)}
	{winner}
	latestPiecePosition={game.latestPiecePosition}
	onDrop={(column) => {
		game.dropPiece(column);
	}}
	onRestartHasWinner={game.restart}
	onRestartFullTable={game.restart}
	dropDisabled={!!game.winner}
/>
