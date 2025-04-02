import { DbConnection, type EventContext } from '../../module_bindings/index'
import { Room } from "../../module_bindings";
import { SubscriptionHandle } from '$lib';

export class UseRoom {
    _room = $state<Room | null>(null);

    conn: DbConnection;
    roomSubHandle: SubscriptionHandle;

    roomOnUpdate: (ctx: EventContext, oldRow: Room, newRow: Room) => void

    constructor(conn: DbConnection, roomId: number) {
        this.conn = conn;

        this.roomOnUpdate = (ctx, room) => {
            if (this._room && this._room.id === room.id) {
                this._room = room;
            } else {
                throw new Error('Room update?? What is this?');
            }
        }

        conn.db.room.onUpdate(this.roomOnUpdate);
        this.roomSubHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                for (const room of conn.db.room.iter()) {
                    if (room.id === roomId) {
                        this._room = room;
                    } else {
                        console.error('Room already set?? Impossible!');
                    }
                }
            })
            .onError((ctx) => {
                console.error('Error fetching join rooms:', ctx.event);
            })
            .subscribe(`SELECT * FROM room WHERE id = '${roomId}'`);
    }

    async stop() {
        const removeListeners = () => {
            this.conn.db.room.removeOnUpdate(this.roomOnUpdate);
        }

        return new Promise<void>(resolve => {
            if (this.roomSubHandle.isActive()) {
                this.roomSubHandle.unsubscribeThen(() => {
                    removeListeners()
                    resolve();
                });
            } else {
                removeListeners()
                resolve();
            }
        })
    }

    get room() {
        return this._room;
    }
}