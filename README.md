# conn4

<https://conn4.vercel.app/>

## Stack

### Frontend

- SvelteKit
- Tailwind CSS

### Backend

- SpacetimeDB

## TODO

### First

- Attempt to reconnect if connection is lost
- Room self-delete after some time after the last player went offline
- Message rate limit on the frontend

### Next

- Authentication: login, register, logout
- Leaderboard: last month, 6 months, all time
- Coin skins
- Money to buy skins
- Internationalization: 日本語, ภาษาไทย

### Later

- Add team mechanics to the game: Not just 1v1, any player in the team can drop piece on behalf of the team
  - Maybe add `team` field to `join_game` table
- Show warning modal when a player is about to leave but still in game
- Add new chat item: player joined/left the room
- Add the ability to select how many columns to play with
- Game history: show the last 10 games played, and the ability to replay them
  - Store moves in the game table (best if replace `table` field with this field, though check win logic will be changed completely)
- Invite to room via link
- Invite feature: when in a room, you can invite outside players to join the room
- Message TTL: messages self-delete after a certain time
- Advanced SEO: add meta tags for social media sharing
- Keyboard mode:
  - to drop, `d` -> `columnName`
  - to focus chat input, `c`
  - and more
- ???
