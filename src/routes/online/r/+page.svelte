<script lang="ts">
	import type { You } from '$lib';
	import { getContext } from 'svelte';

	const you = getContext<() => You | null>('you');
	$inspect('you', you());
</script>
