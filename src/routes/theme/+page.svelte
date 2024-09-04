<script lang="ts">
	import { themes } from '$lib/themes';
</script>

<div class="flex max-w-[44rem] flex-wrap justify-center gap-2 transition-all">
	{#each themes as t}
		<button
			data-theme={t}
			class="btn"
			onclick={() => {
				document.documentElement.setAttribute('data-theme', t);
				localStorage.setItem('theme', t);
			}}
		>
			<div class="flex -space-x-2">
				<div class="aspect-square w-4 rounded-full bg-neutral"></div>
				<div class="aspect-square w-4 rounded-full bg-accent"></div>
				<div class="aspect-square w-4 rounded-full bg-secondary"></div>
				<div class="aspect-square w-4 rounded-full bg-primary"></div>
			</div>
			{t}</button
		>
	{/each}
</div>
