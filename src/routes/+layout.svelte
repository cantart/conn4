<script>
	import { onGoogleScriptLoad } from '$lib/google';
	import '../app.css';
	let { children } = $props();

	$effect(() => {
		onGoogleScriptLoad();
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
	{@render children()}
</div>
