import { SubscriptionHandle } from "$lib";
import { Room, DbConnection } from "../../module_bindings";

export class UseRooms {
    _rooms = $state<Room[]>([]);

    conn: DbConnection;
    roomSubHandle: SubscriptionHandle;

    constructor(conn: DbConnection) {
        this.conn = conn;

        this.roomSubHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this._rooms = Array.from(conn.db.room.iter()).sort((a, b) => {
                    return a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime();
                });
            })
            .onError((ctx) => {
                console.error('Error fetching rooms:', ctx.event);
            })
            .subscribe('SELECT * FROM room');

        conn.db.room.onInsert((ctx, room) => {
            this._rooms.push(room);
        });
        conn.db.room.onDelete((ctx, room) => {
            this._rooms = this._rooms.filter((r) => r.id !== room.id);
        });
        conn.db.room.onUpdate((ctx, room) => {
            const index = this._rooms.findIndex((r) => r.id === room.id);
            if (index !== -1) {
                this._rooms[index] = room;
            }
        });
    }

    stop() {
        if (this.roomSubHandle.isActive()) {
            this.roomSubHandle.unsubscribe();
        }
        this.conn.db.room.removeOnInsert(() => { });
        this.conn.db.room.removeOnDelete(() => { });
        this.conn.db.room.removeOnUpdate(() => { });
    }

    get rooms() {
        return this._rooms;
    }
}