import { SubscriptionHandle, You } from "$lib";
import { SvelteMap } from "svelte/reactivity";
import { DbConnection, Player } from "../../module_bindings";

export type RoomData = {
    allJoinRoomHandle: SubscriptionHandle;
    players: SvelteMap<number, Player>;
    conn: DbConnection;
    roomId: number;
    initialRoomTitle: string;
    you: You;
    leaveRoom: () => void;
}