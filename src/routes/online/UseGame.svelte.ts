import { SubscriptionHandle } from "$lib";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { type DbConnection, type EventContext, type Game, type GameCurrentTeam, type JoinTeam, type ReducerEventContext, type Team } from "../../module_bindings";

export class UseGame {
    // TODO: Try to refactor so that we can do some union type i.e. if loading is true, game is undefined, if not game is Game or null. Maybe we need to convert the class to a function that returns an object with the correct types.
    private _loading = $state(true);
    get loading() {
        return this._loading;
    }

    private readonly subscriptions = 0;
    private activeSubscriptions = $state(0);

    private readonly gameHandle: SubscriptionHandle;
    private readonly gameOnUpdate: (ctx: EventContext, oldRow: Game, newRow: Game) => void
    private readonly gameOnInsert: (ctx: EventContext, game: Game) => void
    private readonly gameOnDelete: (ctx: EventContext, game: Game) => void
    private _game = $state<Game | null>(null);
    get game() {
        return this._game;
    }

    private readonly joinTeamHandle: SubscriptionHandle;
    private readonly joinTeamOnInsert: (ctx: EventContext, jt: JoinTeam) => void
    private readonly joinTeamOnUpdate: (ctx: EventContext, oldRow: JoinTeam, newRow: JoinTeam) => void
    private readonly joinTeamOnDelete: (ctx: EventContext, jt: JoinTeam) => void
    private _joinTeams = $state<JoinTeam[]>([]);
    get joinTeams() {
        return this._joinTeams;
    }
    bothTeamsHavePlayers = $derived(new Set(this._joinTeams.map((jt) => jt.teamId)).size === 2)
    // TODO: Change the mapping to from bigint
    playersToTeams = $derived(new Map<string, number>(this._joinTeams.map((jt) => [jt.joiner.toHexString(), jt.teamId])))
    oppositeTeam = $derived.by(() => {
        if (!this.yourJoinTeam || !this._teams.length) {
            return null;
        }
        const yourTeamId = this.yourJoinTeam.teamId;
        const oppositeTeam = this._teams.find((team) => team.id !== yourTeamId);
        return oppositeTeam ?? null;
    })

    /**
     * Not `undefined` if you are one of the joiners of the game.
     */
    yourJoinTeam = $derived(this._joinTeams.find((jt) => jt.joiner.data === this.yourIdentity.data))

    private _gameJoining = $state(false);
    get gameJoining() {
        return this._gameJoining;
    }

    private readonly teamHandle: SubscriptionHandle;
    private teamOnInsert: (ctx: EventContext, team: Team) => void
    private _teams = $state<Team[]>([]);
    get teams() {
        return this._teams;
    }
    emptyTeamIds = $derived.by(() => {
        if (!this._teams || !this._joinTeams) {
            return new Set<number>();
        }
        const teamIds = new Set(this._teams.map((t) => t.id));
        const joinTeamIds = new Set(this._joinTeams.map((jt) => jt.teamId));
        return teamIds.difference(joinTeamIds);
    })

    private readonly gameCurrentTeamHandle: SubscriptionHandle;
    private readonly gameCurrentTeamOnUpdate: (ctx: EventContext, oldRow: GameCurrentTeam, newRow: GameCurrentTeam) => void
    private readonly gameCurrentTeamOnInsert: (ctx: EventContext, gameCurrentTeam: GameCurrentTeam) => void
    private _gameCurrentTeam = $state<GameCurrentTeam | null>(null);
    get gameCurrentTeam() {
        return this._gameCurrentTeam;
    }


    constructor(private readonly conn: DbConnection, roomId: number, private readonly yourIdentity: Identity) {
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

        this.joinTeamOnInsert = (ctx, jt) => {
            if (jt.joiner.data === yourIdentity.data) {
                this._gameJoining = false;
            }
            let existing = this._joinTeams.find((j) => j.joiner.data === jt.joiner.data);
            if (existing) {
                existing = jt
            } else {
                this._joinTeams.push(jt);
            }
        }
        this.joinTeamOnUpdate = (ctx, _, n) => {
            const idx = this._joinTeams.findIndex((j) => j.joiner.data === n.joiner.data);
            if (idx !== -1) {
                this._joinTeams[idx] = n;
                if (n.joiner.data === yourIdentity.data) {
                    this._gameJoining = false;
                }
            } else {
                throw new Error('Got updated but could not find the existing item.')
            }
        }
        this.joinTeamOnDelete = (ctx, jt) => {
            if (jt.joiner.data === yourIdentity.data) {
                if (!this.yourJoinTeam) {
                    throw new Error('You have not joined to the game.')
                }
            }
            const deleted = this._joinTeams.findIndex((j) => j.joiner.data === jt.joiner.data);
            if (deleted !== -1) {
                this._joinTeams.splice(deleted, 1);
            }
        }
        conn.db.joinTeam.onInsert(this.joinTeamOnInsert);
        conn.db.joinTeam.onDelete(this.joinTeamOnDelete);
        conn.db.joinTeam.onUpdate(this.joinTeamOnUpdate);

        this.subscriptions++;
        this.joinTeamHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.activeSubscriptions++;
                for (const jt of conn.db.joinTeam.iter()) {
                    if (jt.roomId === roomId) {
                        this._joinTeams.push(jt);
                    } else {
                        throw new Error('Join teams from other subscriptions leaked in. Make sure to completely unsubscribe from previous subscriptions first.')
                    }
                }
            })
            .onError((ctx) => {
                console.error('Error fetching join teams:', ctx.event);
            })
            .subscribe(`SELECT * FROM join_team WHERE room_id = '${roomId}'`);

        this.gameCurrentTeamOnUpdate = (ctx, _, n) => {
            this._gameCurrentTeam = n;
        }
        conn.db.gameCurrentTeam.onUpdate(this.gameCurrentTeamOnUpdate);
        this.gameCurrentTeamOnInsert = (ctx, gameCurrentTeam) => {
            this._gameCurrentTeam = gameCurrentTeam;
        }
        conn.db.gameCurrentTeam.onInsert(this.gameCurrentTeamOnInsert);


        this.subscriptions++;
        this.gameCurrentTeamHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.activeSubscriptions++;
                const currentTeam = Array.from(conn.db.gameCurrentTeam.iter())[0];
                if (currentTeam) {
                    this._gameCurrentTeam = currentTeam;
                }
            })
            .onError((ctx) => {
                console.error('Error fetching game current team:', ctx.event);
            })
            .subscribe(`SELECT * FROM game_current_team WHERE game_id = '${roomId}'`);

        this.teamOnInsert = (ctx, team) => {
            this._teams.push(team);
            if (this._teams.length > 2) {
                throw new Error('There cannot be more than two teams. Check the subscription or something is wrong on the backend.')
            }
            this._teams.sort((a, b) => a.id - b.id);
        }

        this.subscriptions++;
        this.teamHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this.activeSubscriptions++;
                const teams = Array.from(conn.db.team.iter());
                if (teams.length) {
                    // joined into a room when there are teams (there is a game)
                    this._teams = teams;
                } else {
                    // joined a room when there is no team (there is no game yet)
                    conn.db.team.onInsert(this.teamOnInsert);
                }
            })
            .onError((ctx) => {
                console.error('Error fetching teams:', ctx.event);
            })
            .subscribe(`SELECT * FROM team WHERE game_id = '${roomId}'`);
    }

    createGame() {
        this._gameJoining = true;
        this.conn.reducers.createGame()
        return new Promise<void>(resolve => {
            const onCreateGame = (ctx: ReducerEventContext) => {
                this._gameJoining = false;
                ctx.reducers.removeOnCreateGame(onCreateGame);
                // see join game on insert for the rest of the logic
                resolve();
            }
            this.conn.reducers.onCreateGame(onCreateGame)
        })
    }

    joinTeam(teamId: number) {
        this._gameJoining = true;
        this.conn.reducers.joinToTeam(teamId)
        return new Promise<void>(resolve => {
            const onJoinTeam = (ctx: ReducerEventContext) => {
                this._gameJoining = false;
                ctx.reducers.removeOnJoinToTeam(onJoinTeam);
                // see join game on insert for the rest of the logic
                resolve();
            }
            this.conn.reducers.onJoinToTeam(onJoinTeam)
        })
    }

    private stopGame() {
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

    private stopJoinTeam() {
        const removeListeners = () => {
            this.conn.db.joinTeam.removeOnInsert(this.joinTeamOnInsert);
            this.conn.db.joinTeam.removeOnDelete(this.joinTeamOnDelete);
            this.conn.db.joinTeam.removeOnUpdate(this.joinTeamOnUpdate);
        }

        return new Promise<void>(resolve => {
            if (this.joinTeamHandle.isActive()) {
                this.joinTeamHandle.unsubscribeThen(() => {
                    removeListeners()
                    resolve();
                });
            } else {
                removeListeners()
                resolve();
            }
        })
    }

    private stopGameCurrentTeam() {
        const removeListeners = () => {
            this.conn.db.gameCurrentTeam.removeOnUpdate(this.gameCurrentTeamOnUpdate);
            this.conn.db.gameCurrentTeam.removeOnInsert(this.gameCurrentTeamOnInsert);
        }

        return new Promise<void>(resolve => {
            if (this.gameCurrentTeamHandle.isActive()) {
                this.gameCurrentTeamHandle.unsubscribeThen(() => {
                    removeListeners()
                    resolve();
                });
            } else {
                removeListeners()
                resolve();
            }
        })
    }

    private stopTeam() {
        const removeListeners = () => {
            this.conn.db.team.removeOnInsert(this.teamOnInsert);
        }

        return new Promise<void>(resolve => {
            if (this.teamHandle.isActive()) {
                this.teamHandle.unsubscribeThen(() => {
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
            this.stopGame(),
            this.stopJoinTeam(),
            this.stopGameCurrentTeam(),
            this.stopTeam(),
        ])
    }
}