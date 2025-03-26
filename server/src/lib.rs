use spacetimedb::{table, Identity, ReducerContext, Table};

#[table(name = player, public)]
pub struct Player {
    #[primary_key]
    identity: Identity,
    name: Option<String>,
    online: bool,
}

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {
    // Called when the module is initially published
}

#[spacetimedb::reducer(client_connected)]
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

#[spacetimedb::reducer(client_disconnected)]
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

#[spacetimedb::reducer]
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

#[spacetimedb::reducer]
pub fn hello(ctx: &ReducerContext) -> Result<(), String> {
    log::info!("Hello from {:?}", ctx.sender);
    Ok(())
}

#[spacetimedb::reducer]
pub fn hello_with_text(ctx: &ReducerContext, text: String) -> Result<(), String> {
    if text.is_empty() {
        return Err("Text must not be empty".to_string());
    }

    log::info!("Hello from {:?} with text: {}", ctx.sender, text);
    Ok(())
}
