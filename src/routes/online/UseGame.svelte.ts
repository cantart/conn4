import { SubscriptionHandle } from "$lib";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import type { JoinGame, DbConnection, EventContext, Game, ReducerEventContext } from "../../module_bindings";

export class UseGame {
    // TODO: Try to refactor so that we can do some union type i.e. if loading is true, game is undefined, if not game is Game or null. Maybe we need to convert the class to a function that returns an object with the correct types.
    private _loading = $state(true);
    get loading() {
        return this._loading;
    }

    private readonly subscriptions = 0;
    private activeSubscriptions = $state(0);

    private _yourJoinGame = $state<JoinGame | undefined>(undefined);
    /**
     * Not `undefined` if you are one of the joiners of the game.
     */
    get yourJoinGame() {
        return this._yourJoinGame;
    }

    private readonly gameHandle: SubscriptionHandle;
    private readonly gameOnUpdate: (ctx: EventContext, oldRow: Game, newRow: Game) => void
    private readonly gameOnInsert: (ctx: EventContext, game: Game) => void
    private readonly gameOnDelete: (ctx: EventContext, game: Game) => void
    private _game = $state<Game | null>(null);
    get game() {
        return this._game;
    }

    private readonly joinGameHandle: SubscriptionHandle;
    private readonly joinGameOnInsert: (ctx: EventContext, jg: JoinGame) => void
    private readonly joinGameOnDelete: (ctx: EventContext, jg: JoinGame) => void
    private _joinGames = $state<JoinGame[]>([]);
    get joinGames() {
        return this._joinGames;
    }

    private readonly conn: DbConnection;

    private _gameJoining = $state(false);
    get gameJoining() {
        return this._gameJoining;
    }

    constructor(conn: DbConnection, roomId: number, yourIdentity: Identity) {
        this.conn = conn;

        $effect(() => {
            this._yourJoinGame = this._joinGames.find((jg) => jg.joiner.data === yourIdentity.data);
        })

        $effect(() => {
            if (this.activeSubscriptions === this.subscriptions) {
                this._loading = false
            }
        })

        this.gameOnUpdate = (ctx, _, n) => {
            this._game = n;
        }
        this.gameOnInsert = (ctx, game) => {
            if (game.roomId !== roomId) {
                throw new Error('Game from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
            }
            this._game = game;
        }
        this.gameOnDelete = (ctx, game) => {
            if (game.roomId !== roomId) {
                throw new Error('Game from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
            }
            this._game = null;
        }
        conn.db.game.onDelete(this.gameOnDelete);
        conn.db.game.onUpdate(this.gameOnUpdate);
        conn.db.game.onInsert(this.gameOnInsert);

        this.subscriptions++;
        this.gameHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.activeSubscriptions++;
                for (const game of conn.db.game.iter()) {
                    if (game.roomId === roomId) {
                        this._game = game;
                    } else {
                        throw new Error('Games from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
                    }
                }
            })
            .onError((ctx) => {
                console.error('Error fetching join rooms:', ctx.event);
            })
            .subscribe(`SELECT * FROM game WHERE room_id = '${roomId}'`);

        this.joinGameOnInsert = (ctx, jg) => {
            if (jg.joiner.data === yourIdentity.data) {
                if (this._yourJoinGame) {
                    throw new Error('You already joined to the game.')
                }
                this._gameJoining = false;
            }
            let existing = this._joinGames.find((j) => j.joiner.data === jg.joiner.data);
            if (existing) {
                existing = jg
            } else {
                this._joinGames.push(jg);
            }
        }
        this.joinGameOnDelete = (ctx, jg) => {
            if (jg.joiner.data === yourIdentity.data) {
                if (!this._yourJoinGame) {
                    throw new Error('You have not joined to the game.')
                }
            }
            const deleted = this._joinGames.findIndex((j) => j.joiner.data === jg.joiner.data);
            if (deleted !== -1) {
                this._joinGames.splice(deleted, 1);
            }
        }
        conn.db.joinGame.onInsert(this.joinGameOnInsert);
        conn.db.joinGame.onDelete(this.joinGameOnDelete);

        this.subscriptions++;
        this.joinGameHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.activeSubscriptions++;
                for (const jg of conn.db.joinGame.iter()) {
                    if (jg.joiner.data === yourIdentity.data) {
                        if (this._yourJoinGame) {
                            throw new Error('You already joined to the game.')
                        }
                    }
                    if (jg.roomId === roomId) {
                        this._joinGames.push(jg);
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
        this._gameJoining = true;
        this.conn.reducers.joinOrCreateGame()
        return new Promise<void>(resolve => {
            const onJoinOrCreateGame = (ctx: ReducerEventContext) => {
                this._gameJoining = false;
                ctx.reducers.removeOnJoinOrCreateGame(onJoinOrCreateGame);
                // see join game on insert for the rest of the logic
                resolve();
            }
            this.conn.reducers.onJoinOrCreateGame(onJoinOrCreateGame)
        })

    }

    #stopGame() {
        const removeListeners = () => {
            this.conn.db.game.removeOnUpdate(this.gameOnUpdate);
            this.conn.db.game.removeOnInsert(this.gameOnInsert);
            this.conn.db.game.removeOnDelete(this.gameOnDelete);
        }

        return new Promise<void>(resolve => {
            if (this.gameHandle.isActive()) {
                this.gameHandle.unsubscribeThen(() => {
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
            this.conn.db.joinGame.removeOnInsert(this.joinGameOnInsert);
            this.conn.db.joinGame.removeOnDelete(this.joinGameOnDelete);
        }

        return new Promise<void>(resolve => {
            if (this.joinGameHandle.isActive()) {
                this.joinGameHandle.unsubscribeThen(() => {
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