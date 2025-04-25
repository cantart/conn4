<script lang="ts">
	import {
		signInWithPopup,
		signOut,
		type AuthProvider,
		FacebookAuthProvider,
		GithubAuthProvider,
		TwitterAuthProvider,
		OAuthProvider,
		getAuth
	} from 'firebase/auth';
	import { GoogleAuthProvider } from 'firebase/auth';
	import { type EventContext, type JoinRoom } from '../../module_bindings';
	import type { SubscriptionHandle, You } from '$lib';
	import Home from './Home.svelte';
	import type { CustomContext, RoomData } from './types';
	import Room from './Room.svelte';
	import GoogleLoginButton from './GoogleLoginButton.svelte';
	import { m } from '$lib/paraglide/messages';
	import FacebookLoginButton from './FacebookLoginButton.svelte';
	import GitHubLoginButton from './GitHubLoginButton.svelte';
	import XLoginButton from './XLoginButton.svelte';
	import YahooLoginButton from './YahooLoginButton.svelte';
	import { getContext } from 'svelte';

	const getConnected = getContext<CustomContext['connected']>('connected');
	let you = $derived(getContext<CustomContext['you']>('you')());
	let players = $derived(getContext<CustomContext['players']>('players')());
	let conn = $derived(getContext<CustomContext['conn']>('conn')());
	const postSignIn = getContext<CustomContext['postSignIn']>('postSignIn');
	let firebaseUser = $derived(getContext<CustomContext['firebaseUser']>('firebaseUser')());

	let s = $state<
		| {
				page: 'home';
		  }
		| ({
				page: 'room';
		  } & Omit<RoomData, 'players' | 'you' | 'leaveRoom' | 'conn'>)
		| {
				page: 'loading';
		  }
	>({
		page: 'loading'
	});

	$effect(() => {
		if (you && getConnected()) {
			setupYourJoinRoom(you).then(() => {
				s = {
					page: 'home'
				};
			});
		}
	});

	let yourJoinRoom = $state<JoinRoom | null>(null);
	let yourJoinRoomHandle: SubscriptionHandle | null = null;

	let youJoinRoomOnInsert: (ctx: EventContext, jr: JoinRoom) => void = (ctx, jr) => {
		if (you === null) {
			throw new Error('You are not set yet');
		}
		if (!conn) {
			throw new Error('Connection is not set yet');
		}

		if (jr.joiner.data === you.identity.data) {
			yourJoinRoom = jr;
			conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
		} else {
			console.error('Room of another user', jr);
		}
	};

	const setupYourJoinRoom = async (y: You) => {
		return new Promise<void>((resolve) => {
			if (!conn) {
				throw new Error('Connection is not set yet');
			}

			yourJoinRoomHandle = conn
				.subscriptionBuilder()
				.onApplied(() => {
					if (!conn) {
						throw new Error('Connection is not set yet');
					}

					for (const jr of conn.db.joinRoom.iter()) {
						if (jr.joiner.data === you?.identity.data) {
							yourJoinRoom = jr;
							return;
						}
					}
					conn.db.joinRoom.onInsert(youJoinRoomOnInsert);
					resolve();
				})
				.onError((ctx) => {
					console.error('Error fetching your join room:', ctx.event);
				})
				.subscribe(`SELECT * FROM join_room WHERE joiner = '${y.identity.toHexString()}'`);
		});
	};

	$effect(() => {
		console.log('getConnected()', $state.snapshot(getConnected()));
	});

	$effect(() => {
		if (!getConnected()) {
			s = {
				page: 'loading'
			};
		}
	});

	let home: Home | null = $state(null);
	$effect(() => {
		if (yourJoinRoom) {
			const toRoomData: Extract<typeof s, { page: 'room' }> = {
				page: 'room',
				initialRoomTitle: null,
				roomId: yourJoinRoom.roomId
			};
			yourJoinRoom = null;
			if (yourJoinRoomHandle?.isActive()) {
				yourJoinRoomHandle.unsubscribeThen(async () => {
					if (!conn) {
						throw new Error('Connection is not set yet');
					}

					conn.db.joinRoom.removeOnInsert(youJoinRoomOnInsert);
					yourJoinRoomHandle = null;
					await home?.stopUseRooms();
					s = toRoomData;
				});
			}
		}
	});

	const signInWithProvider = async (provider: AuthProvider) => {
		// TODO: set language
		return signInWithPopup(getAuth(), provider)
			.then(async (result) => {
				postSignIn(await result.user.getIdToken());
			})
			.catch((error) => {
				console.error('Error signing in provider', error);
			});
	};

	let signInModal = $state<HTMLDialogElement | null>(null);
</script>

<div class="space-y-4 text-center">
	{#if firebaseUser.ready && s.page === 'home'}
		<!-- content here -->
		{#if firebaseUser.value}
			{@render logoutButton()}
		{:else}
			{@render loginModal()}
		{/if}
	{/if}

	{#if s.page === 'loading' || !you || !conn}
		<h1>{m.connecting()}</h1>
	{:else if s.page === 'home'}
		<Home bind:this={home} {conn} {you} />
	{:else if s.page === 'room'}
		<Room
			{conn}
			initialRoomTitle={s.initialRoomTitle}
			roomId={s.roomId}
			{players}
			{you}
			leaveRoom={(y) => {
				s = {
					page: 'home'
				};
				setupYourJoinRoom(y);
			}}
		/>
	{:else}
		<h1>Not implemented yet</h1>
	{/if}
</div>

{#snippet loginModal()}
	<button
		class="btn btn-accent btn-xs"
		onclick={() => {
			signInModal?.showModal();
		}}>{m.sign_in()}</button
	>
	<dialog bind:this={signInModal} class="modal">
		<div class="modal-box flex flex-wrap justify-center gap-2">
			<GoogleLoginButton
				onclick={() => {
					signInWithProvider(new GoogleAuthProvider());
				}}
			/><XLoginButton
				onclick={() => {
					signInWithProvider(new TwitterAuthProvider());
				}}
			/>
			<YahooLoginButton
				onclick={() => {
					signInWithProvider(new OAuthProvider('yahoo.com'));
				}}
			/>
			<GitHubLoginButton
				onclick={() => {
					signInWithProvider(new GithubAuthProvider());
				}}
			/>
			<FacebookLoginButton
				onclick={() => {
					signInWithProvider(new FacebookAuthProvider());
				}}
			/>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>{m.close()}</button>
		</form>
	</dialog>
{/snippet}

{#snippet logoutButton()}
	<button
		class="btn btn-warning btn-xs"
		onclick={() => {
			signOut(getAuth());
		}}
	>
		{m.sign_out()}
	</button>
{/snippet}
