import { SubscriptionHandle } from "$lib";
import type { JoinGame, DbConnection, EventContext, Game } from "../../module_bindings";

export class UseGame {
    gameHandle: SubscriptionHandle;
    gameOnUpdate: (ctx: EventContext, oldRow: Game, newRow: Game) => void
    _game = $state<Game | null>(null);
    get game() {
        return this._game;
    }

    joinGameHandle: SubscriptionHandle;
    joinGameOnInsert: (ctx: EventContext, jg: JoinGame) => void
    joinGameOnDelete: (ctx: EventContext, jg: JoinGame) => void
    _joinGames = $state<JoinGame[]>([]);

    conn: DbConnection;

    constructor(conn: DbConnection, roomId: number) {
        this.conn = conn;

        this.gameOnUpdate = (ctx, game) => {
            this._game = game;
        }
        conn.db.game.onUpdate(this.gameOnUpdate);
        this.gameHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
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
            this._joinGames.push(jg);
        }
        this.joinGameOnDelete = (ctx, jg) => {
            const deleted = this._joinGames.findIndex((j) => j.joinerId === jg.joinerId);
            if (deleted !== -1) {
                this._joinGames.splice(deleted, 1);
            }
        }
        conn.db.joinGame.onInsert(this.joinGameOnInsert);
        conn.db.joinGame.onDelete(this.joinGameOnDelete);
        this.joinGameHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                for (const jg of conn.db.joinGame.iter()) {
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

    _stopGame() {
        const removeListeners = () => {
            this.conn.db.game.removeOnUpdate(this.gameOnUpdate);
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

    _stopJoinGame() {
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
            this._stopGame(),
            this._stopJoinGame()
        ])
    }
}