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
	{#if import.meta.env.DEV}
		<footer class="mb-2 opacity-40 transition-all hover:opacity-100">
			<a href="/login">login</a>
		</footer>
	{/if}
</div>
