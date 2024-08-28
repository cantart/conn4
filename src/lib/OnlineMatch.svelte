<script lang="ts">
	import { type Game } from './game.svelte';
	import GameUI from './GameUI.svelte';

	let props: { socket: WebSocket; game: Game; roomId: string; yourId: string } = $props();
</script>

<GameUI
	game={props.game}
	isColumnCannotDrop={!!props.game.wonPlayer || props.game.currentPlayerTurn().id !== props.yourId}
	onDrop={(column) => {
		props.socket.send(JSON.stringify({ type: 'drop', column, roomId: props.roomId }));
	}}
	onRestart={() => {
		props.socket.send(JSON.stringify({ type: 'restart', roomId: props.roomId }));
	}}
/>
