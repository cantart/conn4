<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MouseEventHandler } from 'svelte/elements';

	let {
		onclick
	}: {
		onclick: MouseEventHandler<HTMLButtonElement>;
	} = $props();
</script>

<button {onclick} class="btn border-white bg-white text-black">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		aria-label="Yahoo!"
		role="img"
		viewBox="0 0 512 512"
		fill="#000000"
		width="16"
		height="16"
		><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
			id="SVGRepo_tracerCarrier"
			stroke-linecap="round"
			stroke-linejoin="round"
		></g><g id="SVGRepo_iconCarrier">
			<rect width="512" height="512" rx="15%" fill="#5f01d1"></rect>
			<g fill="#ffffff">
				<path d="M203 404h-62l25-59-69-165h63l37 95 37-95h62m58 76h-69l62-148h69"></path>
				<circle cx="303" cy="308" r="38"></circle>
			</g>
		</g></svg
	>
	{m.login_with({ name: 'Yahoo!' })}
</button>
