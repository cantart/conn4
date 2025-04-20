use std::time::Duration;

use log::info;
use spacetimedb::{
    rand::{seq::IteratorRandom, Rng},
    reducer, table, Identity, ReducerContext, ScheduleAt, SpacetimeType, Table, TimeDuration,
    Timestamp,
};

const STREAK_REQUIRED: usize = 4;

const ROWS: usize = 6;
/// Must be >= `STREAK_REQUIRED`` to not cause panic when checking for a win
const COLS: usize = 20;

#[table(name = player, public)]
pub struct Player {
    #[primary_key]
    identity: Identity,
    name: Option<String>,
    online: bool,
}

#[table(name = join_team, public)]
pub struct JoinTeam {
    #[index(btree)]
    /// TODO: Since a join_team belongs to a Team, we could delete this field and refactor???
    room_id: u32,
    #[primary_key]
    joiner: Identity,
    team_id: u32,
}

enum DeleteJoinTeamBy {
    Joiner(Identity),
    RoomId(u32),
}

fn delete_join_team(ctx: &ReducerContext, by: DeleteJoinTeamBy) {
    match by {
        DeleteJoinTeamBy::Joiner(joiner) => {
            ctx.db.join_team().joiner().delete(joiner);
        }
        DeleteJoinTeamBy::RoomId(room_id) => {
            ctx.db.join_team().room_id().delete(room_id);
        }
    }
}

#[derive(SpacetimeType)]
struct Coord {
    x: u32,
    y: u32,
}

#[derive(SpacetimeType)]
struct Winner {
    team_id: u32,
    coordinates: Vec<Coord>, // cells that are part of the winning line
}

type GameTable = Vec<Vec<Option<Identity>>>;

#[table(name = team, public)]
pub struct Team {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[index(btree)]
    game_id: u32,
    name: String,
}

enum DeleteTeamBy {
    GameId(u32),
}

fn delete_team(ctx: &ReducerContext, by: DeleteTeamBy) {
    match by {
        DeleteTeamBy::GameId(game_id) => {
            ctx.db.team().game_id().delete(game_id);
        }
    }
}

#[table(name = game_current_team, public)]
pub struct GameCurrentTeam {
    #[primary_key]
    game_id: u32,
    #[unique]
    team_id: u32,
}

enum DeleteGameCurrentTeamBy {
    GameId(u32),
}

fn delete_game_current_team(ctx: &ReducerContext, by: DeleteGameCurrentTeamBy) {
    match by {
        DeleteGameCurrentTeamBy::GameId(game_id) => {
            ctx.db.game_current_team().game_id().delete(game_id);
        }
    }
}

#[table(name = game, public)]
pub struct Game {
    #[primary_key]
    room_id: u32,

    /// player that has won the game
    winner: Option<Winner>,
    /// table of the game
    table: GameTable,
    /// last move made by a player
    latest_move: Option<Coord>,
}

impl Game {
    fn new(room_id: u32) -> Self {
        Self {
            room_id: room_id,
            winner: None,
            table: vec![vec![None; COLS]; ROWS],
            latest_move: None,
        }
    }
}

enum DeleteGameBy {
    RoomId(u32),
}

fn delete_game(ctx: &ReducerContext, by: DeleteGameBy) {
    match by {
        DeleteGameBy::RoomId(room_id) => {
            ctx.db.game().room_id().delete(room_id);
            delete_team(ctx, DeleteTeamBy::GameId(room_id));
            delete_game_current_team(ctx, DeleteGameCurrentTeamBy::GameId(room_id));
        }
    }
}

impl Game {
    fn is_table_full(&self) -> bool {
        self.table
            .iter()
            .all(|row| row.iter().all(|cell| cell.is_some()))
    }
}

#[table(name = room, public)]
pub struct Room {
    #[primary_key]
    #[auto_inc]
    id: u32,
    title: String,
    #[unique]
    owner: Identity,
    created_at: Timestamp,
}
enum DeleteRoomBy {
    RoomId(u32),
}

fn delete_room(ctx: &ReducerContext, by: DeleteRoomBy) {
    match by {
        DeleteRoomBy::RoomId(room_id) => {
            ctx.db.room().id().delete(room_id);

            delete_join_team(ctx, DeleteJoinTeamBy::RoomId(room_id));
            delete_game(ctx, DeleteGameBy::RoomId(room_id));
            delete_message(ctx, DeleteMessageBy::RoomId(room_id));
            delete_join_room(ctx, DeleteJoinRoomBy::RoomId(room_id));
        }
    }
}

#[table(name = message, public)]
pub struct Message {
    #[index(btree)]
    room_id: u32,
    sender: Identity,
    #[index(btree)]
    sent_at: Timestamp,
    text: String,
}

enum DeleteMessageBy {
    RoomId(u32),
}

fn delete_message(ctx: &ReducerContext, by: DeleteMessageBy) {
    match by {
        DeleteMessageBy::RoomId(room_id) => {
            ctx.db.message().room_id().delete(room_id);
        }
    }
}

#[table(name = join_room, public)]
pub struct JoinRoom {
    #[index(btree)]
    room_id: u32,
    #[primary_key]
    joiner: Identity,
    joined_at: Timestamp,
}

enum DeleteJoinRoomBy {
    Joiner(Identity),
    RoomId(u32),
}

fn delete_join_room(ctx: &ReducerContext, by: DeleteJoinRoomBy) {
    match by {
        DeleteJoinRoomBy::Joiner(joiner) => {
            ctx.db.join_room().joiner().delete(joiner);
        }
        DeleteJoinRoomBy::RoomId(room_id) => {
            ctx.db.join_room().room_id().delete(room_id);
        }
    }
}

#[spacetimedb::table(name = auto_delete_room_timer, scheduled(auto_delete_room_if_all_offline))]
pub struct AutoDeleteRoomTimer {
    #[primary_key]
    #[auto_inc]
    scheduled_id: u64,
    scheduled_at: spacetimedb::ScheduleAt,
}

#[reducer]
fn auto_delete_room_if_all_offline(ctx: &ReducerContext, _timer: AutoDeleteRoomTimer) {
    for room in ctx.db.room().iter() {
        let mut offline_statuses = ctx
            .db
            .join_room()
            .room_id()
            .filter(room.id)
            .filter_map(|jr| {
                ctx.db
                    .player()
                    .identity()
                    .find(jr.joiner)
                    .map(|p| !p.online)
            });
        if offline_statuses.all(|offline| offline) {
            delete_room(ctx, DeleteRoomBy::RoomId(room.id));
        }
    }
}

fn leave_team(ctx: &ReducerContext) {
    let Some(jt) = ctx.db.join_team().joiner().find(ctx.sender) else {
        // player was not in a game
        return;
    };

    delete_join_team(ctx, DeleteJoinTeamBy::Joiner(ctx.sender));

    // remove game if there are no player in all teams
    // TODO: Maybe in the future we could keep the game alive as long as there are players in the room.
    if ctx.db.join_team().room_id().filter(jt.room_id).count() == 0 {
        delete_game(ctx, DeleteGameBy::RoomId(jt.room_id));
    }
}

fn check_win(ctx: &ReducerContext, table: &GameTable) -> Option<Vec<Coord>> {
    let rows = table.len();
    let cols = table[0].len();

    // Check horizontal
    for row in 0..rows {
        for col in 0..=(cols - STREAK_REQUIRED) {
            let cols_to_check = col..col + STREAK_REQUIRED;
            let cells_to_check = &table[row][cols_to_check.clone()];
            if cells_to_check.iter().all(|&cell| cell == Some(ctx.sender)) {
                return Some(
                    cols_to_check
                        .map(|col| Coord {
                            x: row as u32,
                            y: col as u32,
                        })
                        .collect(),
                );
            }
        }
    }

    // Check vertical
    for col in 0..cols {
        for row in 0..=(rows - STREAK_REQUIRED) {
            let rows_to_check = row..row + STREAK_REQUIRED;
            let mut cells_to_check = rows_to_check.clone().map(|row| &table[row][col]);
            if cells_to_check.all(|&cell| cell == Some(ctx.sender)) {
                return Some(
                    rows_to_check
                        .map(|row| Coord {
                            x: row as u32,
                            y: col as u32,
                        })
                        .collect(),
                );
            }
        }
    }

    // Check diagonal (top-left to bottom-right)
    for row in 0..=(rows - STREAK_REQUIRED) {
        for col in 0..=(cols - STREAK_REQUIRED) {
            let mut cells_to_check = (0..STREAK_REQUIRED).map(|i| &table[row + i][col + i]);
            if cells_to_check.all(|&cell| cell == Some(ctx.sender)) {
                return Some(
                    (0..STREAK_REQUIRED)
                        .map(|i| Coord {
                            x: (row + i) as u32,
                            y: (col + i) as u32,
                        })
                        .collect(),
                );
            }
        }
    }

    // Check diagonal (bottom-left to top-right)
    for row in (STREAK_REQUIRED - 1)..rows {
        for col in 0..=(cols - STREAK_REQUIRED) {
            let mut cells_to_check = (0..STREAK_REQUIRED).map(|i| &table[row - i][col + i]);
            if cells_to_check.all(|&cell| cell == Some(ctx.sender)) {
                return Some(
                    (0..STREAK_REQUIRED)
                        .map(|i| Coord {
                            x: (row - i) as u32,
                            y: (col + i) as u32,
                        })
                        .collect(),
                );
            }
        }
    }

    None
}

fn game_random_team(ctx: &ReducerContext, game_id: u32) -> Result<Team, String> {
    let mut rng = ctx.rng();
    let random_team = ctx
        .db
        .team()
        .game_id()
        .filter(game_id)
        .choose(&mut rng)
        .ok_or("Cannot find a random team in the game")?;
    Ok(random_team)
}

fn game_of_sender(ctx: &ReducerContext) -> Result<Game, String> {
    let Some(jt) = ctx.db.join_team().joiner().find(ctx.sender) else {
        return Err("Player not in a team".to_string());
    };

    let Some(game) = ctx.db.game().room_id().find(jt.room_id) else {
        return Err("Game not found".to_string());
    };

    Ok(game)
}

/// TODO: Consider having this in Game impl
fn assign_random_team(ctx: &ReducerContext, game_id: u32) -> Result<(), String> {
    ctx.db
        .game_current_team()
        .game_id()
        .update(GameCurrentTeam {
            team_id: game_random_team(ctx, game_id)?.id,
            game_id: game_id,
        });
    Ok(())
}

#[reducer]
pub fn restart_game_table_full(ctx: &ReducerContext) -> Result<(), String> {
    let game = game_of_sender(ctx)?;

    if !game.is_table_full() {
        return Err("Cannot restart game if the table is not full".to_string());
    }

    ctx.db.game().room_id().update(Game::new(game.room_id));
    assign_random_team(ctx, game.room_id)?;

    Ok(())
}

#[reducer]
pub fn restart_game_has_winner(ctx: &ReducerContext) -> Result<(), String> {
    let game = game_of_sender(ctx)?;

    if game.winner.is_none() {
        return Err("Cannot restart game if there is no winner".to_string());
    }

    ctx.db.game().room_id().update(Game::new(game.room_id));
    assign_random_team(ctx, game.room_id)?;

    Ok(())
}

#[reducer]
pub fn drop_piece(ctx: &ReducerContext, column: u32) -> Result<(), String> {
    // check if the player is in a team
    let Some(jt) = ctx.db.join_team().joiner().find(ctx.sender) else {
        return Err("Cannot drop piece if not in a team".to_string());
    };

    let Some(mut game) = ctx.db.game().room_id().find(jt.room_id) else {
        return Err("Cannot drop piece if game does not exist".to_string());
    };

    let col_usize = column as usize;
    if col_usize >= game.table[0].len() {
        return Err("Column index out of bounds".to_string());
    }

    if game.winner.is_some() {
        return Err("Cannot drop piece if game is already won".to_string());
    }

    let Some(game_current_team) = ctx.db.game_current_team().game_id().find(game.room_id) else {
        log::error!("Game current team not found for game {}. It appears that no current team was created when the game was created.", game.room_id);
        return Err("Cannot drop piece if there is no current team in game".to_string());
    };

    if jt.team_id != game_current_team.team_id {
        return Err("Cannot drop piece if it's not your team's turn".to_string());
    }

    // check if the column is full
    if game.table[0][col_usize].is_some() {
        return Err("Cannot drop piece in a full column".to_string());
    }

    for i in (0..game.table.len()).rev() {
        // find the first topmost empty cell in the column
        if game.table[i][col_usize].is_none() {
            game.table[i][col_usize] = Some(ctx.sender);
            game.latest_move = Some(Coord {
                x: i as u32,
                y: column,
            });

            if let Some(coords) = check_win(ctx, &game.table) {
                game.winner = Some(Winner {
                    team_id: jt.team_id,
                    coordinates: coords,
                });
            } else {
                info!("Current team: {:?}", game_current_team.team_id);
                let another_team = ctx
                    .db
                    .team()
                    .game_id()
                    .filter(game.room_id)
                    .filter(|team| team.id != game_current_team.team_id)
                    .next()
                    .ok_or("Cannot find another team")?;
                info!("Another team: {:?}", another_team.id);
                ctx.db
                    .game_current_team()
                    .game_id()
                    .update(GameCurrentTeam {
                        team_id: another_team.id,
                        ..game_current_team
                    });
            }

            break;
        }
    }

    ctx.db.game().room_id().update(game);

    Ok(())
}

fn validate_can_join_or_create(ctx: &ReducerContext) -> Result<JoinRoom, String> {
    // check if the player is in a room
    let Some(jr) = ctx.db.join_room().joiner().find(ctx.sender) else {
        return Err("Cannot join the game when not in a room".to_string());
    };

    // check if the player is already in a team
    if ctx.db.join_team().joiner().find(ctx.sender).is_some() {
        return Err("Cannot join the game when already in one".to_string());
    }

    Ok(jr)
}

const FACIAL_EMOJIS: &str = "😀😃😄😁😆🥹😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😶‍🌫️😱😨😰😥😓🤗🤔🫣🤭🫢🫡🤫🫠🤥😶🫥😐🫤😑😬🙄😯😦😧😮😲🥱😴🤤😪😮‍💨😵😵‍💫🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀☠️👽👾🤖🎃😺😸😹😻😼😽🙀😿😾🙈🙉🙊";

#[reducer]
pub fn create_game(ctx: &ReducerContext) -> Result<(), String> {
    let jr = validate_can_join_or_create(ctx)?;

    if ctx.db.game().room_id().find(jr.room_id).is_some() {
        return Err("Cannot create a game when one already exists in a room".to_string());
    }

    let game = ctx.db.game().try_insert(Game::new(jr.room_id))?;

    let emojis = FACIAL_EMOJIS.chars().choose_multiple(&mut ctx.rng(), 2);
    let team1 = ctx.db.team().try_insert(Team {
        id: 0,
        game_id: game.room_id,
        name: emojis[0].into(),
    })?;
    let team2 = ctx.db.team().try_insert(Team {
        id: 0,
        game_id: game.room_id,
        name: emojis[1].into(),
    })?;

    let start_team_id = if ctx.rng().gen_bool(0.5) {
        team1.id
    } else {
        team2.id
    };

    ctx.db.game_current_team().try_insert(GameCurrentTeam {
        game_id: game.room_id,
        team_id: start_team_id,
    })?;

    ctx.db.join_team().try_insert(JoinTeam {
        room_id: jr.room_id,
        joiner: ctx.sender,
        team_id: team1.id,
    })?;

    Ok(())
}

#[reducer]
pub fn join_to_team(ctx: &ReducerContext, team_id: u32) -> Result<(), String> {
    let jr = validate_can_join_or_create(ctx)?;

    let Some(team) = ctx.db.team().id().find(team_id) else {
        return Err("Cannot join to a game when team does not exist".to_string());
    };

    if let Some(jt) = ctx.db.join_team().joiner().find(ctx.sender) {
        if jt.team_id == team.id {
            return Err("Cannot join to the same team".to_string());
        }
        ctx.db.join_team().joiner().update(JoinTeam {
            team_id: team.id,
            ..jt
        });
    } else {
        ctx.db.join_team().try_insert(JoinTeam {
            room_id: jr.room_id,
            joiner: ctx.sender,
            team_id: team.id,
        })?;
    }

    Ok(())
}

#[reducer]
pub fn send_message(ctx: &ReducerContext, text: String) -> Result<(), String> {
    validate_message_text(&text)?;
    if let Some(jr) = ctx.db.join_room().joiner().find(ctx.sender) {
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
    let player = ctx
        .db
        .player()
        .identity()
        .find(ctx.sender)
        .ok_or("Cannot find player")?;
    if player.name.is_none() {
        return Err("Cannot create a room without a name".to_string());
    }
    let room = ctx.db.room().try_insert(Room {
        id: 0,
        title,
        created_at: ctx.timestamp,
        owner: ctx.sender,
    })?;
    join_to_room(ctx, room.id)
}

#[reducer]
pub fn join_to_room(ctx: &ReducerContext, room_id: u32) -> Result<(), String> {
    if ctx.db.join_room().joiner().find(&ctx.sender).is_some() {
        Err("Cannot join to a room when already in one".to_string())
    } else {
        if ctx.db.room().id().find(room_id).is_none() {
            return Err("Room does not exist".to_string());
        }
        let player = ctx
            .db
            .player()
            .identity()
            .find(ctx.sender)
            .ok_or("Cannot find player")?;
        if player.name.is_none() {
            return Err("Cannot join to a room without a name".to_string());
        }
        ctx.db.join_room().try_insert(JoinRoom {
            room_id,
            joiner: ctx.sender,
            joined_at: ctx.timestamp,
        })?;
        Ok(())
    }
}

#[reducer]
pub fn leave_room(ctx: &ReducerContext) {
    delete_join_room(ctx, DeleteJoinRoomBy::Joiner(ctx.sender));
    leave_team(ctx);
    if let Some(room) = ctx.db.room().owner().find(ctx.sender) {
        if let Some(other_jr) = ctx.db.join_room().room_id().filter(room.id).next() {
            // Promote the next player to owner
            ctx.db.room().id().update(Room {
                owner: other_jr.joiner,
                ..room
            });
        } else {
            // Case: the owner of the room who is leaving is the last player in the room
            delete_room(ctx, DeleteRoomBy::RoomId(room.id));
        }
    }
}

#[reducer(init)]
pub fn init(ctx: &ReducerContext) -> Result<(), String> {
    // Called when the module is initially published

    ctx.db
        .auto_delete_room_timer()
        .try_insert(AutoDeleteRoomTimer {
            scheduled_id: 0,
            scheduled_at: ScheduleAt::Interval(
                TimeDuration::from_duration(Duration::from_secs(60 * 60 * 24)), // 1 day
            ),
        })?;

    Ok(())
}

#[reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    info!("Client connected: {:?}", ctx.sender);
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
