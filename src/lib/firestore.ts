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
		state: z.union([
			z.object({
				type: z.literal('waiting')
			}),
			z.object({
				type: z.literal('accepted'),
				opponent: z.string(),
				gameRoomId: z.string()
			})
		])
	}),
	gameRooms: z.object({
		host: z.string(),
		state: z.union([
			z.object({
				type: z.literal('waiting')
			}),
			z.object({
				type: z.literal('player-joined'),
				opponent: z.string()
			}),
			z.object({
				type: z.literal('playing'),
				opponent: z.string(),
				startPlayerOrder: z.tuple([z.string(), z.string()]),
				drops: z
					.object({
						column: z.number()
					})
					.array()
			})
		])
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
