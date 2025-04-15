<script lang="ts">
	import type { You } from '$lib';
	import { DbConnection, type ReducerEventContext, Room } from '../../module_bindings';
	import { onDestroy } from 'svelte';
	import { UseRooms } from './UseRooms.svelte';
	import { m } from '$lib/paraglide/messages';

	let {
		conn,
		you
	}: {
		conn: DbConnection;
		you: You;
	} = $props();

	let name = $state(you.name);
	let nameUpdating = $state(false);
	let nameEditing = $state(false);
	let creatingRoom = $state(false);

	const useRooms = new UseRooms(conn);
	export function stopUseRooms() {
		return useRooms.stop();
	}

	const onSetName = () => {
		console.log('Name updated');
		nameUpdating = false;
		nameEditing = false;
		conn.reducers.removeOnSetName(onSetName);
	};

	let joiningRoomTitle = $state('');

	function onNameSubmit(
		e: SubmitEvent & {
			currentTarget: EventTarget & HTMLFormElement;
		}
	) {
		e.preventDefault();
		const newName = new FormData(e.currentTarget).get('name') as string;
		if (!newName || newName === you.name) return;

		console.log('Setting name to', newName);
		conn.reducers.onSetName(onSetName);
		conn.reducers.setName(newName);
		nameUpdating = true;
	}

	const onCreateRoom: (ctx: ReducerEventContext, title: string) => void = (ctx) => {
		if (ctx.event.status.tag === 'Failed') {
			console.error('Failed to create room:', ctx.event.status.value);
		}
		creatingRoom = false;
		conn.reducers.removeOnCreateRoom(onCreateRoom);
	};

	function createRoom() {
		creatingRoom = true;
		conn.reducers.createRoom(joiningRoomTitle.trim() || (you.name ?? '???'));
		conn.reducers.onCreateRoom(onCreateRoom);
	}

	function joinRoom(room: Room) {
		joiningRoomTitle = room.title;
		conn.reducers.joinToRoom(room.id);
	}

	onDestroy(async () => {
		conn.reducers.removeOnSetName(onSetName);
		conn.reducers.removeOnCreateRoom(onCreateRoom);
		await stopUseRooms();
	});
</script>

{#snippet nameInputForm()}
	<form onsubmit={onNameSubmit} class="flex flex-col gap-4">
		<input
			class="input"
			name="name"
			type="text"
			placeholder={m.legal_cool_dolphin_cry()}
			bind:value={name}
			disabled={nameUpdating}
		/>
		<button type="submit" class="btn btn-primary">
			{#if nameUpdating}
				<span class="loading loading-spinner loading-md"></span>
			{:else}
				{m.save()}
			{/if}
		</button>
	</form>
{/snippet}

<div class="flex flex-col gap-4 text-center">
	{#if you.name}
		<div class="flex items-center justify-center gap-2">
			<h1>{m.awake_acidic_deer_swim()}<span class="font-bold">{you.name}</span>!</h1>
			<button
				onclick={() => {
					nameEditing = !nameEditing;
				}}
				class="btn btn-xs">{nameEditing ? m.cancel() : m.edit()}</button
			>
		</div>
	{/if}
	{#if !you.name}
		{@render nameInputForm()}
	{:else if nameEditing}
		{@render nameInputForm()}
	{/if}
	{#if you.name}
		<div class="space-y-8">
			<div>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						createRoom();
					}}
					class="dropdown dropdown-hover dropdown-center"
				>
					<button type="submit" class="btn btn-primary" disabled={creatingRoom}
						>{m.great_suave_dolphin_achieve()}{#if creatingRoom}
							<span class="loading loading-spinner loading-md"></span>
						{/if}</button
					>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						tabindex="0"
						class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
					>
						<input
							type="text"
							name="title"
							placeholder={m.room_name()}
							class="input input-bordered w-full max-w-xs"
							bind:value={joiningRoomTitle}
						/>
					</div>
				</form>
			</div>
			<div class={useRooms.rooms ? 'space-y-2' : 'hidden'}>
				<h2>{m.actual_gray_scallop_sway()} ({useRooms.rooms.length})</h2>
				<ol>
					{#each useRooms.rooms as room (room.id)}
						<li>
							<button
								class="btn btn-sm"
								onclick={() => joinRoom(room)}
								disabled={!!joiningRoomTitle}
							>
								{room.title}
							</button>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	{/if}
</div>
