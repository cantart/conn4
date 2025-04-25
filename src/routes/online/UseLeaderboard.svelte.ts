import type { StatsOneMonth } from './../../module_bindings/stats_one_month_type'
import type { DbConnection, EventContext } from "../../module_bindings";
import type { SubscriptionHandle } from '$lib';

export class UseLeaderboard {
    public oneMonth = $state<{
        loading: true
    } | {
        loading: false, data: StatsOneMonth[]
    }>({ loading: true });

    private readonly oneMonthSubHandle: SubscriptionHandle
    private readonly oneMonthOnInsert: (ctx: EventContext, row: StatsOneMonth) => void = (ctx, row) => {
        if (this.oneMonth.loading) {
            console.error('One month stats not set yet')
            return
        }
        this.oneMonth.data.push(row)
    }
    private readonly oneMonthOnUpdate: (ctx: EventContext, oldRow: StatsOneMonth, newRow: StatsOneMonth) => void = (ctx, oldRow, newRow) => {
        if (this.oneMonth.loading) {
            console.error('One month stats not set yet')
            return
        }

        const idx = this.oneMonth.data.findIndex((r) => r.player.data === oldRow.player.data)
        if (idx !== -1) {
            this.oneMonth.data[idx] = newRow
        } else {
            console.error('Update for non-existing row??', oldRow, newRow)
        }
    }
    private readonly oneMonthOnDelete: (ctx: EventContext, row: StatsOneMonth) => void = (ctx, row) => {
        if (this.oneMonth.loading) {
            console.error('One month stats not set yet')
            return
        }
        const idx = this.oneMonth.data.findIndex((r) => r.player.data === row.player.data)
        if (idx === -1) {
            console.error('Delete for non-existing row??', row)
            return
        }
        this.oneMonth.data.splice(idx, 1)
    }

    constructor(private readonly conn: DbConnection) {
        this.oneMonthSubHandle = this.setupOneMonth()
    }

    private readonly setupOneMonth = () => {
        return this.conn.subscriptionBuilder().onApplied(() => {
            this.oneMonth = {
                loading: false, data: []
            }
            this.conn.db.statsOneMonth.onInsert(this.oneMonthOnInsert)
            this.conn.db.statsOneMonth.onUpdate(this.oneMonthOnUpdate)
            this.conn.db.statsOneMonth.onDelete(this.oneMonthOnDelete)
        }).onError(ctx => {
            console.error('Error subscribing to one month stats:', ctx.event);
        }).subscribe(`SELECT * FROM stats_one_month`)
    }

    private readonly removeOneMonthListeners = () => {
        this.conn.db.statsOneMonth.removeOnInsert(this.oneMonthOnInsert)
        this.conn.db.statsOneMonth.removeOnUpdate(this.oneMonthOnUpdate)
        this.conn.db.statsOneMonth.removeOnDelete(this.oneMonthOnDelete)
    }

    private stopOneMonth = () => {
        return new Promise<void>(resolve => {
            if (this.oneMonthSubHandle.isActive()) {
                this.oneMonthSubHandle.unsubscribeThen(() => {
                    this.removeOneMonthListeners()
                    resolve()
                })
            } else {
                this.removeOneMonthListeners()
                resolve()
            }
        })
    }

    public stop() {
        return Promise.all([
            this.stopOneMonth()
        ])

    }
}