<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MouseEventHandler } from 'svelte/elements';

	let {
		onclick
	}: {
		onclick: MouseEventHandler<HTMLButtonElement>;
	} = $props();
</script>

<button {onclick} class="btn border-[#005fd8] bg-[#1A77F2] text-white">
	<svg
		aria-label="Facebook logo"
		width="16"
		height="16"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 32 32"
		><path fill="white" d="M8 12h5V8c0-6 4-7 11-6v5c-4 0-5 0-5 3v2h5l-1 6h-4v12h-6V18H8z"
		></path></svg
	>
	{m.login_with({ name: 'Facebook' })}
</button>
