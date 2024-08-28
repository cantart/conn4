<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="flex gap-8">
	<form method="post" action="?/login" class="flex flex-col gap-2">
		<input type="text" name="username" placeholder="Username" />
		<input type="password" name="password" placeholder="Password" />
		<input type="hidden" name="redirect" value={$page.url.searchParams.get('redirect')} />
		<button type="submit">Login</button>
	</form>

	<form method="post" action="?/signup" class="flex flex-col gap-2">
		<input type="text" name="username" placeholder="Username" />
		<input type="password" name="password" placeholder="Password" />
		<button type="submit">Sign up</button>
	</form>
</div>
