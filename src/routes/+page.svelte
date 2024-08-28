<script lang="ts">
	import GameUi from '$lib/GameUI.svelte';
	import { createGame } from '$lib/game.svelte';

	const game = createGame({
		players: [
			{ id: '1', name: 'Player 1' },
			{ id: '2', name: 'Player 2' }
		]
	});
</script>

<GameUi
	{game}
	isColumnCannotDrop={!!game.wonPlayer}
	onDrop={(column) => {
		game.dropPiece(column);
	}}
	onRestart={game.restart}
/>
