<script lang="ts">
	const createTable = () => {
		return Array.from({ length: 6 }, () =>
			Array.from({ length: 7 }, () => {
				return {
					playerId: null
				};
			})
		);
	};
	type Player = {
		id: string;
		name: string;
	};
	// game of connect four
	function createGame(args: { players: [Player, Player] }) {
		let wonPlayer = $state<{ player: Player; coordinates: [number, number][] } | null>(null);
		let table = $state<{ playerId: string | null }[][]>(createTable());
		let sw = $state(true);

		const restart = () => {
			table = createTable();
			sw = true;
			wonPlayer = null;
		};

		let currentPlayerTurn = $derived(() => {
			return sw ? args.players[0] : args.players[1];
		});

		const switchTurn = () => {
			sw = !sw;
		};

		function checkWin(
			table: { playerId: string | null }[][],
			playerId: string
		): null | [number, number][] {
			const rows = table.length;
			const cols = table[0].length;
			const winningStreak = 4;

			// Check horizontal
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col <= cols - winningStreak; col++) {
					if (
						table[row][col].playerId === playerId &&
						table[row][col + 1].playerId === playerId &&
						table[row][col + 2].playerId === playerId &&
						table[row][col + 3].playerId === playerId
					) {
						return [
							[row, col],
							[row, col + 1],
							[row, col + 2],
							[row, col + 3]
						];
					}
				}
			}

			// Check vertical
			for (let col = 0; col < cols; col++) {
				for (let row = 0; row <= rows - winningStreak; row++) {
					if (
						table[row][col].playerId === playerId &&
						table[row + 1][col].playerId === playerId &&
						table[row + 2][col].playerId === playerId &&
						table[row + 3][col].playerId === playerId
					) {
						return [
							[row, col],
							[row + 1, col],
							[row + 2, col],
							[row + 3, col]
						];
					}
				}
			}

			// Check diagonal (top-left to bottom-right)
			for (let row = 0; row <= rows - winningStreak; row++) {
				for (let col = 0; col <= cols - winningStreak; col++) {
					if (
						table[row][col].playerId === playerId &&
						table[row + 1][col + 1].playerId === playerId &&
						table[row + 2][col + 2].playerId === playerId &&
						table[row + 3][col + 3].playerId === playerId
					) {
						return [
							[row, col],
							[row + 1, col + 1],
							[row + 2, col + 2],
							[row + 3, col + 3]
						];
					}
				}
			}

			// Check diagonal (bottom-left to top-right)
			for (let row = winningStreak - 1; row < rows; row++) {
				for (let col = 0; col <= cols - winningStreak; col++) {
					if (
						table[row][col].playerId === playerId &&
						table[row - 1][col + 1].playerId === playerId &&
						table[row - 2][col + 2].playerId === playerId &&
						table[row - 3][col + 3].playerId === playerId
					) {
						return [
							[row, col],
							[row - 1, col + 1],
							[row - 2, col + 2],
							[row - 3, col + 3]
						];
					}
				}
			}

			return null;
		}

		const dropPiece = (column: number) => {
			const player = currentPlayerTurn();
			for (let i = table.length - 1; i >= 0; i--) {
				if (table[i][column].playerId === null) {
					table[i][column].playerId = player.id;
					const winCoordinates = checkWin(table, player.id);
					if (winCoordinates) {
						wonPlayer = { player: player, coordinates: winCoordinates };
					} else {
						switchTurn();
					}
					break;
				}
			}
		};

		return {
			get table() {
				return table;
			},
			get currentPlayerTurn() {
				return currentPlayerTurn;
			},
			get wonPlayer() {
				return wonPlayer;
			},
			switchTurn,
			dropPiece,
			restart
		};
	}

	const players: [Player, Player] = [
		{ id: '1', name: 'player 1' },
		{ id: '2', name: 'player 2' }
	];
	const game = createGame({ players });
</script>

<div class="flex w-full items-center justify-between bg-slate-800 p-2">
	{#each players as player, i}
		<div class="flex items-center gap-2">
			<div class="h-8 w-8 rounded-full {i === 0 ? 'bg-red-500' : 'bg-yellow-500'}"></div>
			<p
				class:font-bold={game.currentPlayerTurn().id === player.id}
				class="text-white transition-all"
			>
				{player.name}
			</p>
		</div>
	{/each}
</div>

<div class="grid w-screen place-items-center border-b">
	<!-- render table -->
	{#each game.table as row}
		<div class="flex">
			{#each row as cell, j}
				<button
					class="grid h-[7rem] w-[7rem] place-items-center border border-slate-800"
					onclick={() => game.dropPiece(j)}
				>
					{#if cell.playerId === players[0].id}
						<div class="h-[5rem] w-[5rem] rounded-full bg-red-500"></div>
					{:else if cell.playerId === players[1].id}
						<div class="h-[5rem] w-[5rem] rounded-full bg-yellow-500"></div>
					{/if}
				</button>
			{/each}
		</div>
	{/each}
</div>

{#if game.wonPlayer}
	<div class="flex flex-col items-center justify-center bg-opacity-50">
		<p class="text-2xl font-bold">
			{game.wonPlayer.player.name} won!
		</p>
		<button class="mt-2 block rounded-lg p-2 text-white" onclick={game.restart}>Restart</button>
	</div>
{/if}
