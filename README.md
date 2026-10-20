# Degen Pig

A push-your-luck dice game for 2–6 players. You can play pass-and-play on one phone or online, with everyone on their own phone.

## How it's built

- `public/` is the game page, the wooden table and the achievement badges. It is served as a static site.
- `shared/engine.js` holds the rules: dice, scoring, every setting, computer players, stats and achievements. Online games run it on the server, so the server is the one that rolls the dice.
- `worker/` is the Cloudflare Worker and its Durable Objects:
  - `Table` is one live table. It holds the seats, the game, the turn timer, the computer stand-ins and the play-again votes.
  - `Lobby` is the list of tables waiting for players.
  - `Accounts` holds each signed-in player's record: achievements, rivals and table history.
- `dev/server.mjs` is a local stand-in for Cloudflare that needs no installs: `node dev/server.mjs`, then open http://localhost:8787.

## Sign-in

Online play needs a Google sign-in through Supabase. The page sends players to Supabase's Google sign-in, which returns them with an access token. The worker checks every token with Supabase (`/auth/v1/user`), so a player's id always comes from Supabase and never from the phone. `SUPABASE_URL` and `SUPABASE_KEY` (the publishable key) are set in `wrangler.toml`. To make "Delete my account" also remove the sign-in itself, add the Supabase secret key as a Cloudflare secret named `SUPABASE_SECRET`.

In the local dev server, the token `dev-<name>` stands in for a signed-in user.

## Online rules

- **Lobby:** a host opens a public or private (password) table with 2–6 seats. The game starts by itself when every seat fills. The host can also start early, and computer players fill the empty seats.
- **Turn timer:** 15 s, 30 s or 1 min, from Settings. When it runs out, the player's turn total is locked in and the dice pass on.
- **Disconnects:** if a phone drops, a computer plays that seat until the player reconnects. Reopening the page rejoins the table.
- **Leaving:** if anyone leaves, the table ends for everyone. Every finished game is saved to each player's record.

## Deploy

Connect this repository to Cloudflare Workers (Workers Builds). It deploys `wrangler.toml` on every push to `main`, and needs no build step or packages.

## Tests

- `node test/engine-sim.mjs` runs 1,800 computer-only games through the engine.
- `test/protocol.mjs` and `test/phones.py` play scripted games against the dev server. To run them, start the server first with `DP_SPEED=0.05 node dev/server.mjs 8790`.
