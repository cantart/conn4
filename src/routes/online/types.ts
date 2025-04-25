import type { You } from "$lib";
import type { SvelteMap } from "svelte/reactivity";
import type { DbConnection, Player } from "../../module_bindings";
import type { User } from "firebase/auth";

export type RoomData = {
    players: SvelteMap<bigint, Player>;
    conn: DbConnection;
    roomId: number;
    initialRoomTitle: string | null;
    you: You;
    leaveRoom: (you: You) => void;
}

export type CustomContext = {
    connected: () => boolean
    players: () => SvelteMap<bigint, Player>
    you: () => (You | null)
    conn: () => (DbConnection | null)
    postSignIn: (idToken?: string) => void
    firebaseUser: () => {
        ready: false;
    } | {
        ready: true;
        value: User | null;
    }
}