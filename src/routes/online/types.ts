import type { You } from "$lib";
import type { SvelteMap } from "svelte/reactivity";
import type { DbConnection, Player } from "../../module_bindings";

export type RoomData = {
    players: SvelteMap<bigint, Player>;
    conn: DbConnection;
    roomId: number;
    initialRoomTitle: string | null;
    you: You;
    leaveRoom: (you: You) => void;
}
