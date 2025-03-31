<script lang="ts">
	import { type EventContext, JoinRoom, Message } from '../../module_bindings';
	import type { RoomData } from './types';
	import { UseRoom } from './UseRoom.svelte';

	let { allJoinRoomHandle, conn, players, roomId, initialRoomTitle, you, leaveRoom }: RoomData =
		$props();

	let roomTitle = $state(initialRoomTitle);
	let joinRooms = $state<JoinRoom[]>(Array.from(conn.db.joinRoom.iter()));
	let messages = $state<Message[]>([]);

	const messageOnInsert = (ctx: EventContext, msg: Message) => {
		let existingMessage = messages.find((m) => m.sentAt === msg.sentAt);
		if (existingMessage) {
			existingMessage = msg;
			return;
		}
		messages.push(msg);
		messages.sort((a, b) => b.sentAt.toDate().getTime() - a.sentAt.toDate().getTime());
	};

	let messageSubHandle = conn
		.subscriptionBuilder()
		.onApplied(() => {
			messages = Array.from(conn.db.message.iter()).sort(
				(a, b) => b.sentAt.toDate().getTime() - a.sentAt.toDate().getTime()
			);
			conn.db.message.onInsert(messageOnInsert);
		})
		.onError((ctx) => {
			console.error('Error fetching messages:', ctx.event);
		})
		.subscribe(`SELECT * FROM message WHERE room_id = '${roomId}'`);

	const useRoom = new UseRoom(conn, roomId);
	$effect(() => {
		if (useRoom.room?.title) {
			roomTitle = useRoom.room.title;
		}
	});

	const joinRoomOnInsert = (_: EventContext, jr: JoinRoom) => {
		joinRooms.push(jr);
	};
	const joinRoomOnDelete = (_: EventContext, jr: JoinRoom) => {
		const index = joinRooms.findIndex((j) => j.joinerId === jr.joinerId);
		if (index !== -1) {
			joinRooms.splice(index, 1);
		} else {
			throw new Error(`Join room not found for deletion: ${jr.joinerId}`);
		}
	};
	const joinRoomOnUpdate = (_: EventContext, o: JoinRoom, n: JoinRoom) => {
		const index = joinRooms.findIndex((j) => j.joinerId === o.joinerId);
		if (index !== -1) {
			joinRooms[index] = n;
		} else {
			throw new Error(`Join room not found for update: ${o.joinerId}`);
		}
	};

	conn.db.joinRoom.onInsert(joinRoomOnInsert);
	conn.db.joinRoom.onDelete(joinRoomOnDelete);
	conn.db.joinRoom.onUpdate(joinRoomOnUpdate);

	let leaving = $state(false);
	const leave = () => {
		leaving = true;
		conn.reducers.leaveRoom();
		conn.reducers.onLeaveRoom((ctx) => {
			if (ctx.event.status.tag === 'Committed') {
				if (allJoinRoomHandle.isActive()) {
					try {
						allJoinRoomHandle.unsubscribe();
					} catch (e) {
						console.error('Error unsubscribing from all join room handle:', e);
					}
				}
				conn.db.message.removeOnInsert(messageOnInsert);
				if (messageSubHandle.isActive()) {
					try {
						messageSubHandle.unsubscribe();
					} catch (e) {
						console.error('Error unsubscribing from message handle:', e);
					}
				}
				useRoom.stop();
				conn.db.joinRoom.removeOnInsert(joinRoomOnInsert);
				conn.db.joinRoom.removeOnDelete(joinRoomOnDelete);
				conn.db.joinRoom.removeOnUpdate(joinRoomOnUpdate);
				leaveRoom();
			} else {
				console.error('Error leaving room:', ctx.event);
			}
			leaving = false;
		});
	};
</script>

<div class="space-y-8">
	<div class="flex items-center gap-4 justify-self-center">
		{@render title()}

		<button onclick={leave} class="btn btn-xs btn-error" disabled={leaving}>Leave</button>
	</div>
	<div class="flex gap-4">
		{@render playerList()}
		{@render chat()}
	</div>
</div>

{#snippet title()}
	{#if roomTitle}
		<h1 class="text-center">{roomTitle}</h1>
	{:else}
		<span class="loading loading-spinner loading-sm"></span>
	{/if}
{/snippet}

{#snippet playerList()}
	<ul>
		{#each joinRooms as jr (jr.joinerId)}
			{@const player = players.get(jr.joinerId)}
			<li>
				{#if player}
					{player.name}
					{#if player.id === you.id}
						(You)
					{/if}
				{:else}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet chat()}
	<div class="space-y-4 rounded">
		<div>
			<!-- message input area -->
			<form
				class="flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					const text = new FormData(e.currentTarget).get('text') as string;
					if (!text) {
						return;
					}
					conn.reducers.sendMessage(text);
					e.currentTarget.reset();
				}}
			>
				<input autocomplete="off" type="text" name="text" placeholder="Message" class="input" />
				<button class="btn-primary btn" type="submit">&gt;</button>
			</form>
		</div>

		<ol class="h-48 overflow-auto">
			<!-- message display area -->
			{#each messages as msg (msg.sentAt)}
				{@const isYours = msg.senderId === you.id}
				<div class="chat {isYours ? 'chat-end' : 'chat-start'}">
					<div class="chat-header">
						{#if msg.senderId === you.id}
							You
						{:else if players.has(msg.senderId)}
							{@const player = players.get(msg.senderId)!}
							<div class="flex items-center gap-1 overflow-visible">
								{#if !player.online}
									<div class="tooltip tooltip-right" data-tip="Offline">
										<div class="status bg-red-500"></div>
									</div>
								{/if}
								<span>{player.name}</span>
							</div>
						{:else}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						<time class="text-xs opacity-50"
							>{msg.sentAt
								.toDate()
								.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</time
						>
					</div>
					<div
						class={[
							'chat-bubble',
							{
								'chat-bubble-accent': isYours
							}
						]}
					>
						{msg.text}
					</div>
					<!-- <div class="chat-footer opacity-50">Delivered</div> -->
				</div>
			{:else}
				<p class="text-center">No messages</p>
			{/each}
		</ol>
	</div>
{/snippet}
