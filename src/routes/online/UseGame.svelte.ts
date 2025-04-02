import { SubscriptionHandle } from "$lib";
import type { JoinGame, DbConnection, EventContext, Game, ReducerEventContext } from "../../module_bindings";

export class UseGame {
    // TODO: Try to refactor so that we can do some union type i.e. if loading is true, game is undefined, if not game is Game or null. Maybe we need to convert the class to a function that returns an object with the correct types.
    #loading = $state(true);
    get loading() {
        return this.#loading;
    }

    #subscriptions = 0;
    #activeSubscriptions = $state(0);

    #joined = $state(false);
    get joined() {
        return this.#joined;
    }

    #gameHandle: SubscriptionHandle;
    #gameOnUpdate: (ctx: EventContext, oldRow: Game, newRow: Game) => void
    #gameOnInsert: (ctx: EventContext, game: Game) => void
    #gameOnDelete: (ctx: EventContext, game: Game) => void
    #game = $state<Game | null>(null);
    get game() {
        return this.#game;
    }

    #joinGameHandle: SubscriptionHandle;
    #joinGameOnInsert: (ctx: EventContext, jg: JoinGame) => void
    #joinGameOnDelete: (ctx: EventContext, jg: JoinGame) => void
    #joinGames = $state<JoinGame[]>([]);
    get joinGames() {
        return this.#joinGames;
    }

    #conn: DbConnection;

    #gameJoining = $state(false);
    get gameJoining() {
        return this.#gameJoining;
    }

    constructor(conn: DbConnection, roomId: number, yourId: number) {
        this.#conn = conn;

        $effect(() => {
            this.#joined = this.#joinGames.some(jg => jg.joinerId === yourId)
        })

        $effect(() => {
            if (this.#activeSubscriptions === this.#subscriptions) {
                this.#loading = false
            }
        })

        this.#gameOnUpdate = (ctx, game) => {
            this.#game = game;
        }
        this.#gameOnInsert = (ctx, game) => {
            if (game.roomId !== roomId) {
                throw new Error('Game from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
            }
            this.#game = game;
        }
        this.#gameOnDelete = (ctx, game) => {
            if (game.roomId !== roomId) {
                throw new Error('Game from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
            }
            this.#game = null;
        }
        conn.db.game.onDelete(this.#gameOnDelete);
        conn.db.game.onUpdate(this.#gameOnUpdate);
        conn.db.game.onInsert(this.#gameOnInsert);

        this.#subscriptions++;
        this.#gameHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.#activeSubscriptions++;
                for (const game of conn.db.game.iter()) {
                    if (game.roomId === roomId) {
                        this.#game = game;
                    } else {
                        throw new Error('Games from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
                    }
                }
            })
            .onError((ctx) => {
                console.error('Error fetching join rooms:', ctx.event);
            })
            .subscribe(`SELECT * FROM game WHERE room_id = '${roomId}'`);

        this.#joinGameOnInsert = (ctx, jg) => {
            if (jg.joinerId === yourId) {
                if (this.#joined) {
                    throw new Error('You are already joined to the game.')
                }
            }
            let existing = this.#joinGames.find((j) => j.joinerId === jg.joinerId);
            if (existing) {
                existing = jg
            } else {
                this.#joinGames.push(jg);
            }
        }
        this.#joinGameOnDelete = (ctx, jg) => {
            if (jg.joinerId === yourId) {
                if (!this.#joined) {
                    throw new Error('You are not joined to the game.')
                }
            }
            const deleted = this.#joinGames.findIndex((j) => j.joinerId === jg.joinerId);
            if (deleted !== -1) {
                this.#joinGames.splice(deleted, 1);
            }
        }
        conn.db.joinGame.onInsert(this.#joinGameOnInsert);
        conn.db.joinGame.onDelete(this.#joinGameOnDelete);

        this.#subscriptions++;
        this.#joinGameHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.#activeSubscriptions++;
                for (const jg of conn.db.joinGame.iter()) {
                    if (jg.joinerId === yourId) {
                        if (this.#joined) {
                            throw new Error('You are already joined to the game.')
                        }
                    }
                    if (jg.roomId === roomId) {
                        this.#joinGames.push(jg);
                    } else {
                        throw new Error('Join games from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
                    }
                }
            })
            .onError((ctx) => {
                console.error('Error fetching join rooms:', ctx.event);
            })
            .subscribe(`SELECT * FROM join_game WHERE room_id = '${roomId}'`);


    }

    joinOrCreate() {
        this.#gameJoining = true;
        this.#conn.reducers.joinOrCreateGame()
        return new Promise<void>(resolve => {
            const onJoinOrCreateGame = (ctx: ReducerEventContext) => {
                this.#gameJoining = false;
                ctx.reducers.removeOnJoinOrCreateGame(onJoinOrCreateGame);
                // see join game on insert for the rest of the logic
                resolve();
            }
            this.#conn.reducers.onJoinOrCreateGame(onJoinOrCreateGame)
        })

    }

    #stopGame() {
        const removeListeners = () => {
            this.#conn.db.game.removeOnUpdate(this.#gameOnUpdate);
            this.#conn.db.game.removeOnInsert(this.#gameOnInsert);
            this.#conn.db.game.removeOnDelete(this.#gameOnDelete);
        }

        return new Promise<void>(resolve => {
            if (this.#gameHandle.isActive()) {
                this.#gameHandle.unsubscribeThen(() => {
                    removeListeners()
                    resolve();
                });
            } else {
                removeListeners()
                resolve();
            }
        })
    }

    #stopJoinGame() {
        const removeListeners = () => {
            this.#conn.db.joinGame.removeOnInsert(this.#joinGameOnInsert);
            this.#conn.db.joinGame.removeOnDelete(this.#joinGameOnDelete);
        }

        return new Promise<void>(resolve => {
            if (this.#joinGameHandle.isActive()) {
                this.#joinGameHandle.unsubscribeThen(() => {
                    removeListeners()
                    resolve();
                });
            } else {
                removeListeners()
                resolve();
            }
        })
    }


    async stop() {
        return Promise.all([
            this.#stopGame(),
            this.#stopJoinGame()
        ])
    }
}