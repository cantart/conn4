<script lang="ts">
	import { themes, theme } from '$lib/theme.svelte';
</script>

<div class="flex max-w-96 flex-wrap justify-center gap-2 transition-all">
	{#each themes as t}
		<button
			class="btn"
			disabled={theme.value === t}
			aria-label={t}
			data-theme={t}
			onclick={() => {
				theme.value = t;
				localStorage.setItem('theme', theme.value);
			}}
		>
			{t}
		</button>
	{/each}
</div>
