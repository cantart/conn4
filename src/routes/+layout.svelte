<script>
	import { onGoogleScriptLoad } from '$lib/google';
	import '../app.css';
	let { children } = $props();

	$effect(() => {
		onGoogleScriptLoad();
	});
</script>

{@render children()}
