import { DbConnection } from './../../module_bindings/index'
import { Room } from "../../module_bindings";
import { SubscriptionHandle } from '$lib';

export class UseRoom {
    _room = $state<Room | null>(null);

    conn: DbConnection;
    roomSubHandle: SubscriptionHandle;

    constructor(conn: DbConnection, roomId: number) {
        this.conn = conn;

        conn.db.room.onInsert(() => {
            throw new Error('Room insert?? Impossible!');
        });
        conn.db.room.onDelete(() => {
            throw new Error('Room delete?? Impossible!');
        });
        conn.db.room.onUpdate((ctx, room) => {
            if (this._room && this._room.id === room.id) {
                this._room = room;
            } else {
                throw new Error('Room update?? What is this?');
            }
        });
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

    stop() {
        if (this.roomSubHandle.isActive()) {
            this.roomSubHandle.unsubscribe();
        }
        this.conn.db.room.removeOnInsert(() => { });
        this.conn.db.room.removeOnDelete(() => { });
        this.conn.db.room.removeOnUpdate(() => { });
    }

    get room() {
        return this._room;
    }
}