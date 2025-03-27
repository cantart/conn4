use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};

#[table(name = player, public)]
pub struct Player {
    #[primary_key]
    identity: Identity,
    name: Option<String>,
    online: bool,
}

#[table(name = game, public)]
pub struct Game {
    room_id: u64,
    cells: Vec<Vec<Identity>>,
    rows: u32,
}

#[table(name = room, public)]
pub struct Room {
    #[primary_key]
    #[auto_inc]
    id: u64,
}

#[table(name = message, public)]
pub struct Message {
    room_id: u64,
    sender: Identity,
    #[index(btree)]
    sent_at: Timestamp,
    text: String,
}

#[table(name = join_room, public, index(name = joiner_and_is_owner, btree(columns = [joiner, is_owner])))]
pub struct JoinRoom {
    #[unique]
    room_id: u64,
    #[unique]
    joiner: Identity,
    is_owner: bool,
}

#[table(name = global_message, public)]
pub struct GlobalMessage {
    sender: Identity,
    #[index(btree)]
    sent_at: Timestamp,
    text: String,
}

#[reducer]
pub fn send_global_message(ctx: &ReducerContext, text: String) -> Result<(), String> {
    validate_message_text(&text)?;
    ctx.db.global_message().try_insert(GlobalMessage {
        sender: ctx.sender,
        sent_at: ctx.timestamp,
        text,
    })?;
    Ok(())
}

#[reducer]
pub fn send_message(ctx: &ReducerContext, text: String) -> Result<(), String> {
    validate_message_text(&text)?;
    if let Some(jr) = ctx.db.join_room().joiner().find(&ctx.sender) {
        ctx.db.message().try_insert(Message {
            room_id: jr.room_id,
            sender: ctx.sender,
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

#[reducer]
pub fn create_room(ctx: &ReducerContext) -> Result<(), String> {
    if ctx
        .db
        .join_room()
        .joiner_and_is_owner()
        .filter((&ctx.sender, true))
        .count()
        > 0
    {
        Err("Cannot create a room when one already exists".to_string())
    } else {
        let room = ctx.db.room().try_insert(Room { id: 0 })?;
        ctx.db.join_room().try_insert(JoinRoom {
            room_id: room.id,
            joiner: ctx.sender,
            is_owner: true,
        })?;
        Ok(())
    }
}

#[reducer]
pub fn join_to_room(ctx: &ReducerContext, room_id: u64) -> Result<(), String> {
    if ctx.db.join_room().joiner().find(&ctx.sender).is_some() {
        Err("Cannot join to a room when already in one".to_string())
    } else {
        if ctx.db.room().id().find(room_id).is_none() {
            return Err("Room does not exist".to_string());
        }
        ctx.db.join_room().try_insert(JoinRoom {
            room_id,
            joiner: ctx.sender,
            is_owner: false,
        })?;
        Ok(())
    }
}

#[reducer]
pub fn leave_room(ctx: &ReducerContext) {
    if let Some(jr) = ctx.db.join_room().joiner().find(&ctx.sender) {
        ctx.db.join_room().joiner().delete(&ctx.sender);
        // remove room if no one is in it
        if ctx.db.join_room().room_id().find(jr.room_id).is_none() {
            ctx.db.room().id().delete(jr.room_id);
        }
    }
}

#[reducer(init)]
pub fn init(_ctx: &ReducerContext) {
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

    leave_room(&ctx);
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
