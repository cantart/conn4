import { SubscriptionHandle } from "$lib";
import { DbConnection, EventContext, Message, ReducerEventContext } from "../../module_bindings";

export class UseRoomMessages {
    private _messages = $state<Message[]>([]);
    get messages() {
        return this._messages;
    }
    private sending = $state(false);
    get sendingMessage() {
        return this.sending;
    }

    private readonly messageOnInsert: (ctx: EventContext, msg: Message) => void
    private readonly messageSubHandle: SubscriptionHandle
    private readonly messageOnDelete: (ctx: ReducerEventContext, text: string) => void = () => {
        this.sending = false;
    }

    constructor(
        private readonly conn: DbConnection,
        public readonly roomId: number,
    ) {
        this.conn.reducers.onSendMessage(this.messageOnDelete)
        this.messageOnInsert = (ctx: EventContext, msg: Message) => {
            let existingMessage = this._messages.find((m) => m.sentAt === msg.sentAt);
            if (existingMessage) {
                existingMessage = msg;
                return;
            }
            this._messages.push(msg);
            this._messages.sort((a, b) => b.sentAt.toDate().getTime() - a.sentAt.toDate().getTime());
        };

        this.messageSubHandle = conn
            .subscriptionBuilder()
            .onApplied(() => {
                this._messages = Array.from(conn.db.message.iter()).sort(
                    (a, b) => b.sentAt.toDate().getTime() - a.sentAt.toDate().getTime()
                );
                conn.db.message.onInsert(this.messageOnInsert);
            })
            .onError((ctx) => {
                console.error('Error fetching messages:', ctx.event);
            })
            .subscribe(`SELECT * FROM message WHERE room_id = '${roomId}'`);
    }

    async stop() {
        const removeListeners = () => {
            this.conn.db.message.removeOnInsert(this.messageOnInsert);
        }

        return new Promise<void>((resolve) => {
            if (this.messageSubHandle.isActive()) {
                this.messageSubHandle.unsubscribeThen(() => {
                    removeListeners();
                    resolve();
                })
            } else {
                removeListeners();
                resolve();
            }
        });
    }

    async sendMessage(text: string) {
        this.sending = true;
        this.conn.reducers.sendMessage(text)
    }
}