<script>
	import { onGoogleScriptLoad } from '$lib/google';
	import '../app.css';
	let { children } = $props();

	$effect(() => {
		onGoogleScriptLoad();
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
	<div class="my-auto text-center">{@render children()}</div>
	<footer class="mb-2 space-x-4">
		{#if import.meta.env.DEV}
			<a href="/login" class="opacity-40 transition-all hover:opacity-100">login</a>
		{/if}
		<a href="/" class="opacity-40 transition-all hover:opacity-100">offline</a>
		<a href="/multiplayer" class="opacity-40 transition-all hover:opacity-100">online</a>
	</footer>
</div>
