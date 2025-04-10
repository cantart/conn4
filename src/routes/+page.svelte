<script lang="ts" module>
	import GameUi from '$lib/GameUI.svelte';
	import { createLocalGame } from '$lib/local-game.svelte';
	import { m } from '$lib/paraglide/messages';

	const game = createLocalGame({
		players: [
			{ id: '1', name: m.noisy_least_newt_cure({ number: 1 }) },
			{ id: '2', name: m.noisy_least_newt_cure({ number: 2 }) }
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
