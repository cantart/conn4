const createTable = () => {
	return Array.from({ length: 6 }, () =>
		Array.from({ length: 7 }, () => {
			return {
				playerId: null
			};
		})
	);
};

export type Player = {
	id: string;
	name: string;
};

export function createGame(args: { players: [Player, Player] }) {
	let wonPlayer = $state<{ player: Player; coordinates: [number, number][] } | null>(null);
	let table = $state<{ playerId: string | null }[][]>(createTable());
	let sw = $state(true);

	const restart = () => {
		table = createTable();
		sw = true;
		wonPlayer = null;
	};

	const currentPlayerTurn = $derived(() => {
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
		if (wonPlayer) {
			console.error('Game is over');
			return;
		}

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
				return;
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
