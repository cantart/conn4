import { You } from "$lib";
import { SvelteMap } from "svelte/reactivity";
import { DbConnection, Player } from "../../module_bindings";

export type RoomData = {
    players: SvelteMap<bigint, Player>;
    conn: DbConnection;
    roomId: number;
    initialRoomTitle: string | null;
    you: You;
    leaveRoom: (you: You) => void;
}