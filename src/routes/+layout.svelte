<script lang="ts">
	import { onGoogleScriptLoad } from '$lib/google';
	import '../app.css';
	let { children, data } = $props();

	$effect(() => {
		console.log('data', data);

		onGoogleScriptLoad();
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
	<div class="my-auto text-center">{@render children()}</div>
	<footer class="mb-2 space-x-4">
		{#if import.meta.env.DEV}
			{#if data.user}
				<form method="post" action="/login?/logout" class="inline">
					<button type="submit" class="opacity-40 transition-all hover:opacity-100">logout</button>
				</form>
			{:else}
				<a href="/login" class="opacity-40 transition-all hover:opacity-100">login</a>
			{/if}
		{/if}
		<a href="/" class="opacity-40 transition-all hover:opacity-100">offline</a>
		<a href="/multiplayer" class="opacity-40 transition-all hover:opacity-100">online</a>
	</footer>
</div>
