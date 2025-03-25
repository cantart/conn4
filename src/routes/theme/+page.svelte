<script lang="ts">
	import { themes } from '$lib/themes';
</script>

<div class="flex max-w-[44rem] flex-wrap justify-center gap-2 transition-all">
	{#each themes as t (t)}
		<button
			data-theme={t}
			class="btn"
			onclick={() => {
				document.documentElement.setAttribute('data-theme', t);
				localStorage.setItem('theme', t);
			}}
		>
			<div class="flex -space-x-2">
				<div class="bg-neutral aspect-square w-4 rounded-full"></div>
				<div class="bg-accent aspect-square w-4 rounded-full"></div>
				<div class="bg-secondary aspect-square w-4 rounded-full"></div>
				<div class="bg-primary aspect-square w-4 rounded-full"></div>
			</div>
			{t}</button
		>
	{/each}
</div>
