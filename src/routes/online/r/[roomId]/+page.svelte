<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db.svelte';

	$effect(() => {
		if (!db.conn || !db.r) {
			console.error('No connection or room found');
			goto('/online');
		}
	});
</script>
