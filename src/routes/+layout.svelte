<script lang="ts">
	import '../app.css';
	let { children } = $props();
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';

	const pages = [
		{ pathname: '/offline', label: m.this_teary_hyena_value(), icon: '😪' },
		{ pathname: '/online', label: m.sleek_strong_turtle_pat(), icon: '✈️' },
		{ pathname: '/theme', label: m.cool_plain_elk_pull(), icon: '🎨' },
		{ pathname: '/feedback', label: m.this_aware_larva_fry(), icon: '💬' }
	] as const;
	const languages = [
		{
			code: 'en',
			label: m.language_label(
				{},
				{
					locale: 'en'
				}
			)
		},
		{ code: 'jp', label: m.language_label({}, { locale: 'jp' }) },
		{ code: 'th', label: m.language_label({}, { locale: 'th' }) }
	] as const;

	const currentLanguageLabel = languages.find((lang) => lang.code === getLocale())?.label;
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
							<a href={p.pathname} class:active={page.url.pathname.includes(p.pathname)}>
								{p.icon}
								{p.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
		<div class="navbar-center hidden gap-2 sm:flex">
			<ul class="menu menu-horizontal rounded-box bg-base-200">
				{#each pages as p (p.pathname)}
					{@const active = page.url.pathname.includes(p.pathname)}
					<li>
						<a href={p.pathname} class:active>
							{p.icon}
							{#if active}
								{p.label}
							{/if}
						</a>
					</li>
				{/each}
			</ul>
			{@render languageSwitcher()}
		</div>
		<div class="navbar-end">
			<div class="sm:hidden">{@render languageSwitcher()}</div>
		</div>
	</div>

	<div class="flex grow flex-col items-center justify-center">{@render children()}</div>
</div>

{#snippet languageSwitcher()}
	<div class="dropdown dropdown-hover dropdown-end sm:dropdown-start text-sm">
		<div tabindex="0" role="button">🌐 {currentLanguageLabel}</div>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-1 w-32 p-2 shadow-sm">
			{#each languages as lang (lang.code)}
				<li><button onclick={() => setLocale(lang.code)}>{lang.label}</button></li>
			{/each}
		</ul>
	</div>
{/snippet}
