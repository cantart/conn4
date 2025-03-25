<script lang="ts">
	import '../app.css';
	let { children } = $props();
	import { page } from '$app/state';

	const pages = [
		{ pathname: '/', label: 'offline', icon: '😪' },
		{ pathname: '/theme', label: 'theme', icon: '🎨' },
		{ pathname: '/feedback', label: 'feedback', icon: '💬' }
	] as const;
</script>

<div
	class="scrollbar-track-transparent scrollbar-thumb-white flex min-h-screen flex-col items-center justify-center gap-2"
>
	<div class="navbar bg-base-100">
		<div class="navbar-start">
			<div class="dropdown sm:hidden">
				<div tabindex="0" role="button" class="btn btn-circle btn-ghost">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h7"
						/>
					</svg>
				</div>
				<ul class="menu dropdown-content rounded-box bg-base-100 z-[1] w-40 p-2 shadow">
					{#each pages as p (p.pathname)}
						<li>
							<a href={p.pathname} class:active={page.url.pathname === p.pathname}>
								{p.icon}
								{p.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
		<div class="navbar-center hidden sm:flex">
			<ul class="menu menu-horizontal rounded-box bg-base-200">
				{#each pages as p (p.pathname)}
					<li>
						<a href={p.pathname} class:active={page.url.pathname === p.pathname}>
							{p.icon}
							{#if page.url.pathname === p.pathname}
								{p.label}
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</div>
		<div class="navbar-end"></div>
	</div>

	<div class="flex grow flex-col items-center justify-center">{@render children()}</div>
</div>
