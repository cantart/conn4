import { SubscriptionHandle } from "$lib";
import { DbConnection } from "../module_bindings";

export const db = $state<{
    conn: DbConnection | null
    r: {
        allJoinRoomHandle: SubscriptionHandle
    } | null
}>({
    conn: null,
    r: null
})