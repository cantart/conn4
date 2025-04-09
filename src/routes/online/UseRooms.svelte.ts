import { SubscriptionHandle } from "$lib";
import { Room, DbConnection, type EventContext } from "../../module_bindings";

export class UseRooms {
    private _rooms = $state<Room[]>([]);

    private readonly conn: DbConnection;
    private readonly roomSubHandle: SubscriptionHandle;

    private readonly roomOnInsert: (ctx: EventContext, room: Room) => void
    private readonly roomOnUpdate: (ctx: EventContext, oldRow: Room, newRow: Room) => void
    private readonly roomOnDelete: (ctx: EventContext, room: Room) => void

    constructor(conn: DbConnection) {
        this.conn = conn;

        this.roomOnInsert = (ctx, room) => {
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
        }
        this.roomOnDelete = (ctx, room) => {
            this._rooms = this._rooms.filter((r) => r.id !== room.id);
        }
        this.roomOnUpdate = (ctx, _, n) => {
            const index = this._rooms.findIndex((r) => r.id === n.id);
            if (index !== -1) {
                this._rooms[index] = n;
            }
        }

        conn.db.room.onInsert(this.roomOnInsert);
        conn.db.room.onDelete(this.roomOnDelete);
        conn.db.room.onUpdate(this.roomOnUpdate);
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

    async stop() {
        const removeListeners = () => {
            this.conn.db.room.removeOnInsert(this.roomOnInsert);
            this.conn.db.room.removeOnDelete(this.roomOnDelete);
            this.conn.db.room.removeOnUpdate(this.roomOnUpdate);
        }

        new Promise<void>(resolve => {
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

    get rooms() {
        return this._rooms;
    }
}