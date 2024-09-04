<script lang="ts">
	import { themes } from '$lib/themes';
</script>

<div class="flex max-w-96 flex-wrap justify-center gap-2 transition-all">
	{#each themes as t}
		<button data-theme={t} class="btn" data-set-theme={t} data-act-class="ACTIVECLASS">{t}</button>
	{/each}
</div>
