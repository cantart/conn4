import { collection } from 'firebase/firestore';
import { db } from './firebase.client';
import { z } from 'zod';

export const collectionNames: Record<string, string> = {
	matchmakingRooms: 'matchmaking-rooms',
	gameRooms: 'game-rooms'
} as const;

export const docSchemas = z.object({
	matchmakingRooms: z.object({
		host: z.string().min(1),
		queue: z.string().array(),
		acceptedPlayer: z.string().optional()
	}),
	gameRooms: z.object({
		host: z.string(),
		opponent: z.string().optional(),
		startPlayerOrder: z.string().array().optional()
	})
});

export type Doc = z.infer<typeof docSchemas>;

export const collections: Record<
	keyof typeof collectionNames,
	(...pathSegments: string[]) => ReturnType<typeof collection>
> = {
	gameRooms: (...pathSegments) => collection(db, collectionNames.gameRooms, ...pathSegments),
	matchmakingRooms: (...pathSegments) =>
		collection(db, collectionNames.matchmakingRooms, ...pathSegments)
} as const;
