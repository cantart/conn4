<script lang="ts">
	import { type DocumentReference, updateDoc } from 'firebase/firestore';
	import { type Game } from './game.svelte';
	import GameUI from './GameUI.svelte';
	import { onSnapshot } from 'firebase/firestore';
	import type { Doc } from './firestore';
	import { onMount } from 'svelte';

	let props: { game: Game; gameRoomRef: DocumentReference; yourId: string } = $props();
	let hasPendingWrites = $state(false);
	let unsub = $state<(() => void) | null>(null);

	$effect(() => {
		// start listening to the game room
		unsub = onSnapshot(props.gameRoomRef, (snap) => {
			if (!snap.exists()) {
				throw new Error('Game room does not exist');
			}
			hasPendingWrites = snap.metadata.hasPendingWrites;
			if (snap.metadata.hasPendingWrites) {
				return;
			}

			const data = snap.data() as Doc['gameRooms'];
			// listen for changes in the game
		});
	});

	onMount(() => {
		return () => {
			unsub?.();
		};
	});

	const sendDrop = async (column: number) => {
		// await updateDoc(props.gameRoomRef, {});
	};
</script>

<GameUI
	game={props.game}
	isColumnCannotDrop={!!props.game.wonPlayer || props.game.currentPlayerTurn().id !== props.yourId}
	onDrop={(column) => {
		if (hasPendingWrites) {
			return;
		}
		sendDrop(column);
	}}
	onRestart={() => {}}
/>
