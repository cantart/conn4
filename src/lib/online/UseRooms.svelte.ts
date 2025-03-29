import { SubscriptionHandle } from "$lib";
import { Room, DbConnection } from "../../module_bindings";

export class UseRooms {
    _rooms = $state<Room[]>([]);

    conn: DbConnection;
    roomSubHandle: SubscriptionHandle;

    constructor(conn: DbConnection) {
        this.conn = conn;

        conn.db.room.onInsert((ctx, room) => {
            // check if room already exists in the list
            let existingRoom = this._rooms.find((r) => r.id === room.id);
            if (existingRoom) {
                // update the existing room
                existingRoom = room;
                return;
            }
            this._rooms.push(room);
            this._rooms.sort((a, b) => {
                return a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime();
            });
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
        this.roomSubHandle = conn
            .subscriptionBuilder()
            .onApplied((ctx) => {
                this._rooms = [...ctx.db.room.iter(), ...this._rooms].sort((a, b) => {
                    return a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime();
                })
            })
            .onError((ctx) => {
                console.error('Error fetching rooms:', ctx.event);
            })
            .subscribe('SELECT * FROM room');
    }

    stop() {
        if (this.roomSubHandle.isActive()) {
            this.roomSubHandle.unsubscribeThen(() => {
                // TODO: maybe a good idea to make this function async
            });
        }
        this.conn.db.room.removeOnInsert(() => { });
        this.conn.db.room.removeOnDelete(() => { });
        this.conn.db.room.removeOnUpdate(() => { });
    }

    get rooms() {
        return this._rooms;
    }
}