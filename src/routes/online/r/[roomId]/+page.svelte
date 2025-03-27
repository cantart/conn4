<script lang="ts">
	import { getContext } from 'svelte';
	import { DbConnection } from '../../../../module_bindings';
	import { SubscriptionBuilderImpl } from '@clockworklabs/spacetimedb-sdk';
	import { goto } from '$app/navigation';

	type SubscriptionHandle = ReturnType<SubscriptionBuilderImpl['subscribe']>;

	const conn = getContext<DbConnection>('conn');
	const allJoinRoomHandle = getContext<SubscriptionHandle>('allJoinRoomHandle');
	if (!conn || !allJoinRoomHandle) {
		goto('/online');
	}
</script>
