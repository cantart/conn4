<script lang="ts">
	import GameUi from '$lib/GameUI.svelte';
	import { createLocalGame } from '$lib/local-game.svelte';

	const game = createLocalGame({
		players: [
			{ id: 1, name: 'Player 1' },
			{ id: 2, name: 'Player 2' }
		]
	});
</script>

<GameUi
	players={game.players}
	currentPlayerTurnId={game.currentPlayerTurn()}
	table={game.table}
	wonPlayer={game.wonPlayer}
	latestPiecePosition={game.latestPiecePosition}
	isColumnCannotDrop={!!game.wonPlayer}
	onDrop={(column) => {
		game.dropPiece(column);
	}}
	onRestart={game.restart}
/>
