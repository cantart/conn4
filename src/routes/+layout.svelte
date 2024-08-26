<script>
	import { onGoogleScriptLoad } from '$lib/google';
	import '../app.css';
	let { children } = $props();

	$effect(() => {
		onGoogleScriptLoad();
	});
</script>

<div class="flex min-h-screen flex-col justify-center">
	{@render children()}
</div>
