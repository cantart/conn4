use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};

#[table(name = player, public)]
pub struct Player {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[unique]
    identity: Identity,
    name: Option<String>,
    online: bool,
}

const ROWS: usize = 6;
const COLS: usize = 20;

#[table(name = game, public)]
pub struct Game {
    #[primary_key]
    room_id: u32,
    cells: Vec<Vec<Option<u32>>>, // cells that may have player IDs in them
    rows: u32,
}

#[table(name = join_game, public)]
pub struct JoinGame {
    #[index(btree)]
    room_id: u32,
    #[primary_key]
    joiner_id: u32,
}

#[reducer]
pub fn join_or_create_game(ctx: &ReducerContext) -> Result<(), String> {
    let player = find_sender_player(ctx);

    // check if the player is in a room
    let Some(jr) = ctx.db.join_room().joiner_id().find(player.id) else {
        return Err("Cannot join the game when not in a room".to_string());
    };

    // check if the player is already in a game
    if ctx.db.join_game().joiner_id().find(player.id).is_some() {
        return Err("Cannot join the game when already in one".to_string());
    }

    // if there is no game in the room, create one
    if ctx.db.game().room_id().find(jr.room_id).is_none() {
        ctx.db.game().try_insert(Game {
            room_id: jr.room_id,
            cells: vec![vec![None; COLS]; ROWS],
            rows: ROWS as u32,
        })?;
    }

    ctx.db.join_game().try_insert(JoinGame {
        room_id: jr.room_id,
        joiner_id: player.id,
    })?;

    Ok(())
}

#[table(name = room, public)]
pub struct Room {
    #[primary_key]
    #[auto_inc]
    id: u32,
    title: String,
    #[unique]
    owner_id: u32,
    created_at: Timestamp,
}

#[table(name = message, public)]
pub struct Message {
    #[index(btree)]
    room_id: u32,
    sender_id: u32,
    #[index(btree)]
    sent_at: Timestamp,
    text: String,
}

#[table(name = join_room, public)]
pub struct JoinRoom {
    #[index(btree)]
    room_id: u32,
    #[primary_key]
    joiner_id: u32,
    #[unique]
    joiner_identity: Identity,
    joined_at: Timestamp,
}

fn find_sender_player(ctx: &ReducerContext) -> Player {
    ctx.db.player().identity().find(ctx.sender).unwrap()
}

#[reducer]
pub fn send_message(ctx: &ReducerContext, text: String) -> Result<(), String> {
    validate_message_text(&text)?;
    let player = find_sender_player(ctx);
    if let Some(jr) = ctx.db.join_room().joiner_id().find(player.id) {
        ctx.db.message().try_insert(Message {
            room_id: jr.room_id,
            sender_id: player.id,
            sent_at: ctx.timestamp,
            text,
        })?;
        Ok(())
    } else {
        Err("Cannot send message when not in a room".to_string())
    }
}

fn validate_message_text(text: &str) -> Result<(), String> {
    if text.is_empty() {
        Err("Message must not be empty".to_string())
    } else {
        Ok(())
    }
}

fn validate_room_title(title: &str) -> Result<(), String> {
    if title.is_empty() {
        Err("Room title must not be empty".to_string())
    } else {
        Ok(())
    }
}

#[reducer]
pub fn create_room(ctx: &ReducerContext, title: String) -> Result<(), String> {
    validate_room_title(&title)?;
    let player = find_sender_player(ctx);
    if player.name.is_none() {
        return Err("Cannot create a room without a name".to_string());
    }
    let room = ctx.db.room().try_insert(Room {
        id: 0,
        title,
        created_at: ctx.timestamp,
        owner_id: player.id,
    })?;
    join_to_room(ctx, room.id)
}

#[reducer]
pub fn join_to_room(ctx: &ReducerContext, room_id: u32) -> Result<(), String> {
    if ctx
        .db
        .join_room()
        .joiner_identity()
        .find(&ctx.sender)
        .is_some()
    {
        Err("Cannot join to a room when already in one".to_string())
    } else {
        if ctx.db.room().id().find(room_id).is_none() {
            return Err("Room does not exist".to_string());
        }
        let player = find_sender_player(ctx);
        if player.name.is_none() {
            return Err("Cannot join to a room without a name".to_string());
        }
        ctx.db.join_room().try_insert(JoinRoom {
            joiner_id: player.id,
            room_id,
            joiner_identity: ctx.sender,
            joined_at: ctx.timestamp,
        })?;
        Ok(())
    }
}

#[reducer]
fn delete_room(ctx: &ReducerContext, room_id: u32) {
    ctx.db.room().id().delete(room_id);
    // Cascade delete messages
    for m in ctx.db.message().room_id().filter(room_id) {
        ctx.db.message().room_id().delete(m.room_id);
    }
}

#[reducer]
pub fn leave_room(ctx: &ReducerContext) {
    ctx.db.join_room().joiner_identity().delete(ctx.sender);
    let player = find_sender_player(ctx);
    if let Some(room) = ctx.db.room().owner_id().find(player.id) {
        if let Some(other_jr) = ctx.db.join_room().room_id().filter(room.id).next() {
            // Promote the next player to owner
            ctx.db.room().id().update(Room {
                owner_id: other_jr.joiner_id,
                ..room
            });
        } else {
            // Case: the owner of the room who is leaving is the last player in the room
            delete_room(ctx, room.id);
        }
    }
}

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    // Called when the module is initially published
}

#[reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    // Called every time a new client connects
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        ctx.db.player().identity().update(Player {
            online: true,
            ..player
        });
    } else {
        ctx.db.player().insert(Player {
            id: 0,
            identity: ctx.sender,
            name: None,
            online: true,
        });
    }
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    // Called every time a client disconnects
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        ctx.db.player().identity().update(Player {
            online: false,
            ..player
        });
    } else {
        log::warn!(
            "Disconnected player not found in database with identity {:?}",
            ctx.sender
        );
    }
}

#[reducer]
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = validate_name(name)?;
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        ctx.db.player().identity().update(Player {
            name: Some(name),
            ..player
        });
        Ok(())
    } else {
        Err("Cannot set name for an unknown player".to_string())
    }
}

/// Takes a name and checks if it's acceptable as a player's name.
fn validate_name(name: String) -> Result<String, String> {
    if name.is_empty() {
        Err("Names must not be empty".to_string())
    } else {
        Ok(name)
    }
}

#[reducer]
pub fn hello(ctx: &ReducerContext) -> Result<(), String> {
    log::info!("Hello from {:?}", ctx.sender);
    Ok(())
}

#[reducer]
pub fn hello_with_text(ctx: &ReducerContext, text: String) -> Result<(), String> {
    if text.is_empty() {
        return Err("Text must not be empty".to_string());
    }

    log::info!("Hello from {:?} with text: {}", ctx.sender, text);
    Ok(())
}
