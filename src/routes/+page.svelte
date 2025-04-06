<script lang="ts" module>
	import GameUi from '$lib/GameUI.svelte';
	import { createLocalGame } from '$lib/local-game.svelte';

	const game = createLocalGame({
		players: [
			{ id: '1', name: 'Player 1' },
			{ id: '2', name: 'Player 2' }
		]
	});
</script>

<GameUi
	as="player"
	players={game.players}
	currentPlayerTurnId={game.currentPlayerTurn()}
	table={game.table}
	winner={game.winner}
	latestPiecePosition={game.latestPiecePosition}
	onDrop={(column) => {
		game.dropPiece(column);
	}}
	onRestartHasWinner={game.restart}
	onRestartFullTable={game.restart}
	dropDisabled={!!game.winner}
/>
