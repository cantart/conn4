<script lang="ts">
	import { arrayUnion, type DocumentReference, updateDoc } from 'firebase/firestore';
	import { type Game } from './game.svelte';
	import GameUI from './GameUI.svelte';
	import { onSnapshot } from 'firebase/firestore';
	import type { Doc, Drop } from './firestore';
	import { onMount } from 'svelte';

	let props: { game: Game; gameRoomRef: DocumentReference; yourId: string } = $props();
	let unsub = $state<(() => void) | null>(null);
	const appliedDrops = new Set<string>();

	$effect(() => {
		// start listening to the game room
		unsub = onSnapshot(props.gameRoomRef, (snap) => {
			if (!snap.exists()) {
				throw new Error('Game room does not exist');
			}

			const data = snap.data() as Doc['gameRooms'];
			if (data.state.type !== 'playing') {
				throw new Error('Invalid game state');
			}

			data.state.drops.forEach((drop) => {
				if (appliedDrops.has(drop.id)) {
					return;
				}
				appliedDrops.add(drop.id);
				props.game.dropPiece(drop.column);
			});
		});
	});

	onMount(() => {
		return () => {
			unsub?.();
		};
	});

	let dropping = $state(false);
	const sendDrop = async (column: number) => {
		dropping = true;
		const drop: Drop = { column, id: Math.random().toString() };
		await updateDoc(props.gameRoomRef, {
			'state.drops': arrayUnion(drop),
		}).finally(() => {
			dropping = false;
		});
	};
</script>

<GameUI
	game={props.game}
	isColumnCannotDrop={!!props.game.wonPlayer || props.game.currentPlayerTurn().id !== props.yourId}
	onDrop={(column) => {
		if (dropping) {
			return;
		}
		sendDrop(column);
	}}
	onRestart={() => {}}
/>
