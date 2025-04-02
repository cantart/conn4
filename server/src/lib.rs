use spacetimedb::{
    rand::Rng, reducer, table, Identity, ReducerContext, SpacetimeType, Table, Timestamp,
};

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

const PLAYERS_REQUIRED: u32 = 2;

const ROWS: usize = 6;
const COLS: usize = 20;

#[derive(SpacetimeType)]
struct Coord {
    x: u32,
    y: u32,
}

#[derive(SpacetimeType)]
struct WonPlayer {
    player_id: u32,
    coordinates: Vec<Coord>, // cells that are part of the winning line
}

#[table(name = game, public)]
pub struct Game {
    #[primary_key]
    room_id: u32,

    /// player that has won the game
    won_player: Option<WonPlayer>,
    /// table of the game
    table: Vec<Vec<Option<u32>>>,
    /// if true, the current turn is for the player with an even index
    sw: bool,
    /// last move made by a player
    latest_move: Option<Coord>,

    rows: u32,
    players_required: u32,
}

#[table(name = join_game, public)]
pub struct JoinGame {
    #[index(btree)]
    room_id: u32,
    #[primary_key]
    joiner_id: u32,
    #[auto_inc]
    index: u32,
}

fn check_win(game: &Game, player_id: u32) -> Option<Vec<Coord>> {
    todo!()
}

#[reducer]
pub fn drop_piece(ctx: &ReducerContext, column: u32) -> Result<(), String> {
    let player = find_sender_player(ctx);

    // check if the player is in a game
    let Some(jg) = ctx.db.join_game().joiner_id().find(player.id) else {
        return Err("Cannot drop piece if not in a game".to_string());
    };

    let Some(mut game) = ctx.db.game().room_id().find(jg.room_id) else {
        return Err("Cannot drop piece if game does not exist".to_string());
    };

    let col_usize = column as usize;
    if col_usize >= game.table[0].len() {
        return Err("Column index out of bounds".to_string());
    }

    if game.won_player.is_some() {
        return Err("Cannot drop piece if game is already won".to_string());
    }

    if (jg.index % 2 == 0) != game.sw {
        return Err("Cannot drop piece if it's not your turn".to_string());
    }

    // check if the column is full
    if game.table[0][col_usize].is_some() {
        return Err("Cannot drop piece in a full column".to_string());
    }

    for i in (0..game.table.len()).rev() {
        if game.table[i][col_usize].is_none() {
            game.table[i][col_usize] = Some(player.id);
            game.latest_move = Some(Coord {
                x: i as u32,
                y: column,
            });

            if let Some(coords) = check_win(&game, player.id) {
                game.won_player = Some(WonPlayer {
                    player_id: player.id,
                    coordinates: coords,
                });
            } else {
                game.sw = !game.sw;
            }
        }
    }

    Ok(())
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

    // check if game is full i.e. 2 players are already in the game
    if ctx.db.join_game().room_id().filter(jr.room_id).count() >= PLAYERS_REQUIRED as usize {
        return Err("Cannot join the game when it is full".to_string());
    }

    // if there is no game in the room, create one
    if ctx.db.game().room_id().find(jr.room_id).is_none() {
        ctx.db.game().try_insert(Game {
            room_id: jr.room_id,
            rows: ROWS as u32,

            won_player: None,
            table: vec![vec![None; COLS]; ROWS],
            latest_move: None,
            players_required: PLAYERS_REQUIRED,
            sw: ctx.rng().gen_bool(0.5),
        })?;
    }

    ctx.db.join_game().try_insert(JoinGame {
        room_id: jr.room_id,
        joiner_id: player.id,
        index: 0,
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
