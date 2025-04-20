const createTable = () => {
	const rows = 6;
	const cols = 20;
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols }, () => {
			return undefined;
		}),
	);
};

export type LocalPlayer = {
	id: string;
	name: string;
	// teamId: number;
};

export type LocalGameState = {
	winner: { playerId: string; coordinates: [number, number][] } | undefined;
	table: (string | undefined)[][];
	sw: boolean;
	latestPiecePosition: [number, number] | undefined;
};

export function createLocalGame(args: { players: [LocalPlayer, LocalPlayer] }) {
	let winner = $state<LocalGameState['winner']>(undefined);
	let table = $state<LocalGameState['table']>(createTable());
	let sw = $state(true);
	let latestPiecePosition: LocalGameState['latestPiecePosition'] = $state(undefined);

	const restart = () => {
		table = createTable();
		sw = true;
		winner = undefined;
		latestPiecePosition = undefined;
	};

	const players = args.players;

	const currentPlayerTurnId = $derived(() => {
		return sw ? args.players[0].id : args.players[1].id;
	});

	const switchTurn = () => {
		sw = !sw;
	};

	function checkWin(
		table: LocalGameState['table'],
		playerId: string,
	): null | [number, number][] {
		const rows = table.length;
		const cols = table[0].length;
		const winningStreak = 4;

		// Check horizontal
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col <= cols - winningStreak; col++) {
				if (
					table[row][col] === playerId &&
					table[row][col + 1] === playerId &&
					table[row][col + 2] === playerId &&
					table[row][col + 3] === playerId
				) {
					return [
						[row, col],
						[row, col + 1],
						[row, col + 2],
						[row, col + 3],
					];
				}
			}
		}

		// Check vertical
		for (let col = 0; col < cols; col++) {
			for (let row = 0; row <= rows - winningStreak; row++) {
				if (
					table[row][col] === playerId &&
					table[row + 1][col] === playerId &&
					table[row + 2][col] === playerId &&
					table[row + 3][col] === playerId
				) {
					return [
						[row, col],
						[row + 1, col],
						[row + 2, col],
						[row + 3, col],
					];
				}
			}
		}

		// Check diagonal (top-left to bottom-right)
		for (let row = 0; row <= rows - winningStreak; row++) {
			for (let col = 0; col <= cols - winningStreak; col++) {
				if (
					table[row][col] === playerId &&
					table[row + 1][col + 1] === playerId &&
					table[row + 2][col + 2] === playerId &&
					table[row + 3][col + 3] === playerId
				) {
					return [
						[row, col],
						[row + 1, col + 1],
						[row + 2, col + 2],
						[row + 3, col + 3],
					];
				}
			}
		}

		// Check diagonal (bottom-left to top-right)
		for (let row = winningStreak - 1; row < rows; row++) {
			for (let col = 0; col <= cols - winningStreak; col++) {
				if (
					table[row][col] === playerId &&
					table[row - 1][col + 1] === playerId &&
					table[row - 2][col + 2] === playerId &&
					table[row - 3][col + 3] === playerId
				) {
					return [
						[row, col],
						[row - 1, col + 1],
						[row - 2, col + 2],
						[row - 3, col + 3],
					];
				}
			}
		}

		return null;
	}

	const dropPiece = (column: number) => {
		if (winner) {
			console.error('Game is over');
			return;
		}

		const playerId = currentPlayerTurnId();
		for (let i = table.length - 1; i >= 0; i--) {
			if (table[i][column] === undefined) {
				table[i][column] = playerId;
				latestPiecePosition = [i, column];
				const winCoordinates = checkWin(table, playerId);
				if (winCoordinates) {
					winner = { playerId: playerId, coordinates: winCoordinates };
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
			return currentPlayerTurnId;
		},
		get winner() {
			return winner;
		},
		get latestPiecePosition() {
			return latestPiecePosition;
		},
		players,
		switchTurn,
		dropPiece,
		restart,
	};
}

export type LocalGame = ReturnType<typeof createLocalGame>;
