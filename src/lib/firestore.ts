import { collection as c } from 'firebase/firestore';
import { db } from './firebase.client';
import { z } from 'zod';

export const collections = {
	matchmakingRooms: {
		collection: (parts: string[]) => c(db, 'matchmaking-rooms', ...parts),
		docSchema: z.object({
			host: z.string().min(1),
			queue: z.string().array(),
			acceptedPlayer: z.string().optional()
		})
	},
	gameRooms: {
		collection: (parts: string[]) => c(db, 'game-rooms', ...parts),
		docSchema: z.object({
			players: z.string().array()
		})
	}
} as const;
