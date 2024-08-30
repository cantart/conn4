<script lang="ts">
	import type { DocumentReference } from 'firebase/firestore';
	import { type Game } from './game.svelte';
	import GameUI from './GameUI.svelte';

	let props: { game: Game; gameRoomRef: DocumentReference; yourId: string } = $props();

	$effect(() => {
		// start listening to the game room
	});
</script>

<GameUI
	game={props.game}
	isColumnCannotDrop={!!props.game.wonPlayer || props.game.currentPlayerTurn().id !== props.yourId}
	onDrop={(column) => {
		// props.socket.send(JSON.stringify({ type: 'drop', column, roomId: props.roomId }));
	}}
	onRestart={() => {
		// props.socket.send(JSON.stringify({ type: 'restart', roomId: props.roomId }));
	}}
/>
