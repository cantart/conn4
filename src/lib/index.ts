import { Identity, SubscriptionBuilderImpl } from "@clockworklabs/spacetimedb-sdk";
import { RemoteTables, RemoteReducers, SetReducerFlags } from "../module_bindings";

// place files you want to import through the `$lib` alias in this folder.
export type SubscriptionHandle = ReturnType<SubscriptionBuilderImpl<RemoteTables, RemoteReducers, SetReducerFlags>['subscribe']>;

export type You = { name?: string; identity: Identity }

