// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
import { GameCurrentTeam } from "./game_current_team_type";
import { EventContext, Reducer, RemoteReducers, RemoteTables } from ".";

/**
 * Table handle for the table `game_current_team`.
 *
 * Obtain a handle from the [`gameCurrentTeam`] property on [`RemoteTables`],
 * like `ctx.db.gameCurrentTeam`.
 *
 * Users are encouraged not to explicitly reference this type,
 * but to directly chain method calls,
 * like `ctx.db.gameCurrentTeam.on_insert(...)`.
 */
export class GameCurrentTeamTableHandle {
  tableCache: TableCache<GameCurrentTeam>;

  constructor(tableCache: TableCache<GameCurrentTeam>) {
    this.tableCache = tableCache;
  }

  count(): number {
    return this.tableCache.count();
  }

  iter(): Iterable<GameCurrentTeam> {
    return this.tableCache.iter();
  }
  /**
   * Access to the `game_id` unique index on the table `game_current_team`,
   * which allows point queries on the field of the same name
   * via the [`GameCurrentTeamGameIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.gameCurrentTeam.game_id().find(...)`.
   *
   * Get a handle on the `game_id` unique index on the table `game_current_team`.
   */
  game_id = {
    // Find the subscribed row whose `game_id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: number): GameCurrentTeam | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.game_id, col_val)) {
          return row;
        }
      }
    },
  };
  /**
   * Access to the `team_id` unique index on the table `game_current_team`,
   * which allows point queries on the field of the same name
   * via the [`GameCurrentTeamTeamIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.gameCurrentTeam.team_id().find(...)`.
   *
   * Get a handle on the `team_id` unique index on the table `game_current_team`.
   */
  team_id = {
    // Find the subscribed row whose `team_id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: number): GameCurrentTeam | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.team_id, col_val)) {
          return row;
        }
      }
    },
  };

  onInsert = (cb: (ctx: EventContext, row: GameCurrentTeam) => void) => {
    return this.tableCache.onInsert(cb);
  }

  removeOnInsert = (cb: (ctx: EventContext, row: GameCurrentTeam) => void) => {
    return this.tableCache.removeOnInsert(cb);
  }

  onDelete = (cb: (ctx: EventContext, row: GameCurrentTeam) => void) => {
    return this.tableCache.onDelete(cb);
  }

  removeOnDelete = (cb: (ctx: EventContext, row: GameCurrentTeam) => void) => {
    return this.tableCache.removeOnDelete(cb);
  }

  // Updates are only defined for tables with primary keys.
  onUpdate = (cb: (ctx: EventContext, oldRow: GameCurrentTeam, newRow: GameCurrentTeam) => void) => {
    return this.tableCache.onUpdate(cb);
  }

  removeOnUpdate = (cb: (ctx: EventContext, onRow: GameCurrentTeam, newRow: GameCurrentTeam) => void) => {
    return this.tableCache.removeOnUpdate(cb);
  }}
