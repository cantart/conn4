<script lang="ts">
	let { name, online }: { name: string; online: boolean } = $props();
</script>

<div class="flex items-center gap-1">
	<div class="status transition-colors {online ? 'status-success' : 'status-error'}"></div>
	<span class="text-sm md:text-base">{name}</span>
</div>
