import { SubscriptionBuilderImpl } from "@clockworklabs/spacetimedb-sdk";

// place files you want to import through the `$lib` alias in this folder.
export type SubscriptionHandle = ReturnType<SubscriptionBuilderImpl['subscribe']>;
