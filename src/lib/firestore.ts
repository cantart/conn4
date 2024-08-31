import { collection } from 'firebase/firestore';
import { db } from './firebase.client';

export const collectionNames = {
	matchmakingRooms: 'matchmaking-rooms',
	gameRooms: 'game-rooms',
	userInfos: 'user-public-infos',
} as const;

export type Drop = {
	column: number;
	id: string;
};

export type Doc = {
	users: {
		displayName: string | null;
		photoURL: string | null;
	};
	matchmakingRooms: {
		host: string;
		queue: string[];
		state:
			| {
					type: 'waiting';
			  }
			| {
					type: 'accepted';
					opponent: string;
					gameRoomId: string;
			  };
	};
	gameRooms: {
		host: string;
		state:
			| {
					type: 'waiting';
			  }
			| {
					type: 'player-joined';
					opponent: string;
			  }
			| {
					type: 'playing';
					opponent: string;
					startPlayerOrder: [string, string];
					drops: {
						column: number;
						id: string;
					}[];
			  };
	};
};

export const collections: Record<
	keyof typeof collectionNames,
	(...pathSegments: string[]) => ReturnType<typeof collection>
> = {
	gameRooms: (...pathSegments) => collection(db, collectionNames.gameRooms, ...pathSegments),
	matchmakingRooms: (...pathSegments) =>
		collection(db, collectionNames.matchmakingRooms, ...pathSegments),
	userInfos: (...pathSegments) => collection(db, collectionNames.userInfos, ...pathSegments),
} as const;
