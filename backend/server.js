// backend/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const Redis = require("ioredis");
require("dotenv").config();

// Redis client (connecting to your Pi)
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
});

// Helpers
function makePin(length = 3) {
  return [...Array(length)]
    .map(() => Math.random().toString(36)[2])
    .join("")
    .toUpperCase();
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create", async (req, res) => {
  console.log("CREATED");
  let pin;
  do {
    pin = makePin();
  } while (await redis.exists(`game:${pin}:host`));

  await redis
    .multi()
    .set(`game:${pin}:host`, "")
    .del(`game:${pin}:players`)
    .del(`game:${pin}:stories`)
    .del(`game:${pin}:submissions`)
    .del(`game:${pin}:scores`)
    .exec();

  console.log(`Game ${pin} created`);
  res.json({ pin });
});

app.get("/health", (_, res) => res.send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("↔️ socket connected:", socket.id);

  socket.on("joinGame", async ({ pin, username }) => {
    const exists = await redis.exists(`game:${pin}:host`);
    if (!exists) return socket.emit("errorMessage", "Game not found");

    let hostId = await redis.get(`game:${pin}:host`);
    if (!hostId) {
      await redis.set(`game:${pin}:host`, socket.id);
      hostId = socket.id;
    }

    // include ready:false
    const playerObj = { username, isHost: socket.id === hostId, ready: false };
    await redis.hset(
      `game:${pin}:players`,
      socket.id,
      JSON.stringify(playerObj)
    );
    await redis.hset(`game:${pin}:scores`, socket.id, 0);

    socket.join(pin);

    // broadcast playersUpdate
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const playerList = Object.entries(playersRaw).map(([id, str]) => {
      const p = JSON.parse(str);
      return { id, username: p.username, isHost: p.isHost, ready: p.ready };
    });
    io.to(pin).emit("playersUpdate", playerList);
  });

  socket.on("submitStories", async ({ pin, stories }) => {
    await redis.hset(`game:${pin}:stories`, socket.id, JSON.stringify(stories));
    await redis.sadd(`game:${pin}:submissions`, socket.id);

    // mark ready=true
    const playersRaw1 = await redis.hgetall(`game:${pin}:players`);
    const meRaw = playersRaw1[socket.id];
    if (meRaw) {
      const me = JSON.parse(meRaw);
      me.ready = true;
      await redis.hset(`game:${pin}:players`, socket.id, JSON.stringify(me));
    }

    // re-broadcast playersUpdate
    const playersRaw2 = await redis.hgetall(`game:${pin}:players`);
    const updatedList = Object.entries(playersRaw2).map(([id, str]) => {
      const p = JSON.parse(str);
      return { id, username: p.username, isHost: p.isHost, ready: p.ready };
    });
    io.to(pin).emit("playersUpdate", updatedList);

    // optional storiesSubmitted
    const subCount = await redis.scard(`game:${pin}:submissions`);
    const totalPlayers = Object.keys(playersRaw2).length;
    if (subCount === totalPlayers) {
      io.to(pin).emit("storiesSubmitted");
    }
  });

  /**
   * Pick `count` distinct random items from `array`.
   * Does not mutate the original.
   */
  function sample(array, count) {
    const arr = array.slice(); // copy so we don’t destroy the original
    const n = arr.length;
    const k = Math.min(count, n); // in case count > length

    // Fisher–Yates only up to the k-th position:
    for (let i = 0; i < k; i++) {
      // pick a random index from [i…n-1]
      const j = i + Math.floor(Math.random() * (n - i));
      // swap element i ↔ j
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    // the first k elements are now a random sample
    return arr.slice(0, k);
  }

  // In your server.js (ensure shuffle() is defined above this handler):

  socket.on("startGame", async (pin) => {
    // Only the host may start the game
    const host = await redis.get(`game:${pin}:host`);
    if (socket.id !== host) return;

    // Enforce a minimum of 3 players
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const playerCount = Object.keys(playersRaw).length;
    if (playerCount < 3) {
      return socket.emit(
        "errorMessage",
        `Need at least 3 players to start (currently ${playerCount}).`
      );
    }

    // Flatten all submitted stories into [{ authorId, text }, ...]
    const storiesRaw = await redis.hgetall(`game:${pin}:stories`);
    let allStories = Object.entries(storiesRaw).flatMap(([authorId, json]) =>
      JSON.parse(json).map((text) => ({ authorId, text }))
    );

    console.log("storiesRaw", storiesRaw);
    console.log("All: ", allStories);
    // Shuffle and pick exactly 8 stories
    allStories = sample(allStories, 8);

    console.log("Shuffled", allStories);
    // Prepend a dummy null entry so we can index by 1…8
    allStories.unshift(null);

    // Store the story list and initialize currentRound to 1
    await redis.set(`game:${pin}:storyList`, JSON.stringify(allStories));
    await redis.set(`game:${pin}:currentRound`, 1);

    // Emit the first round using allStories[1]
    const { authorId, text } = allStories[1];
    await redis.set(`game:${pin}:currentAuthor`, authorId);
    io.to(pin).emit("gameStarted", {
      round: 1,
      authorId,
      text,
    });
  });

  // server.js (inside io.on("connection", …))
  socket.on("nextRound", async (pin) => {
    // only the host can trigger the next round
    const host = await redis.get(`game:${pin}:host`);
    if (socket.id !== host) return;

    // pull down your pre‐shuffled storyList and current round
    const list = JSON.parse(await redis.get(`game:${pin}:storyList`));
    const current = Number(await redis.get(`game:${pin}:currentRound`)) || 1;
    const next = current + 1;

    // if we’ve exhausted the list, end the game
    if (next >= list.length) {
      return io.to(pin).emit("gameEnded");
    }

    // —— NEW: clear out last round’s votes ——
    await redis.del(`game:${pin}:votes`);

    // advance the round pointer and set the new author
    await redis.set(`game:${pin}:currentRound`, next);
    const { authorId, text } = list[next];
    await redis.set(`game:${pin}:currentAuthor`, authorId);

    // tell everyone to move into the next round
    io.to(pin).emit("nextRound", { round: next, authorId, text });
  });

  socket.on("prepareNextRound", async ({ pin, nextRound }) => {
    // 1) Load your stored 1-based story list
    const raw = await redis.get(`game:${pin}:storyList`);
    if (!raw) {
      console.log("end1");
      return io.to(pin).emit("endGame");
    }
    const list = JSON.parse(raw);

    // 2) Validate the requested round
    const idx = Number(nextRound);
    if (isNaN(idx) || idx < 1 || idx >= list.length) {
      console.log("end2");
      return socket.emit("errorMessage", `Invalid round: ${nextRound}`);
    }

    // 3) Grab the story for this round
    const { authorId, text } = list[idx];

    // 4) Update Redis so server-state stays in sync
    await redis.set(`game:${pin}:currentRound`, idx);
    await redis.set(`game:${pin}:currentAuthor`, authorId);

    // 5) Emit back to **that** client (or to all if you prefer)
    //    Here we target just the requester so each RevealView can fetch on mount

    console.log(`sending back round ${idx}`);
    socket.emit("roundPrepared", {
      round: idx,
      authorId,
      text,
    });
  });

  // inside io.on("connection", socket => { … })

  socket.on("resetGame", async (pin) => {
    // only the host may reset
    const hostId = await redis.get(`game:${pin}:host`);
    if (socket.id !== hostId) return;

    // 1) gather any leftover lock keys for all rounds
    const lockKeys = await redis.keys(`game:${pin}:round:*:scored`);

    // 1) delete all per‐game state (except the host key)
    const multi = redis
      .multi()
      .del(
        `game:${pin}:players`,
        `game:${pin}:scores`,
        `game:${pin}:stories`,
        `game:${pin}:submissions`,
        `game:${pin}:votes`,
        `game:${pin}:storyList`,
        `game:${pin}:currentRound`,
        `game:${pin}:currentAuthor`
      );

    if (lockKeys.length) {
      lockKeys.forEach((lk) => multi.del(lk));
      console.log("clearing old locks:", lockKeys);
    }

    await multi.exec();

    // 2) force every socket to leave the room so the lobby is empty
    //    (requires Socket.IO v4+)
    await io.in(pin).socketsLeave(pin);
  });

  socket.on("vote", async ({ pin, choiceId }) => {
    console.log("voted");

    // 1) record this vote
    await redis.hset(`game:${pin}:votes`, socket.id, choiceId);

    // 2) fetch the up‐to‐the‐moment votes map
    const votes = await redis.hgetall(`game:${pin}:votes`);
    console.log("VOTES: ", votes);
    // 3) broadcast intermediate update so everyone can stack initials
    io.to(pin).emit("votesUpdate", votes);

    // 4) if everyone (except author) has voted, tally and emit final results
    const authorId = await redis.get(`game:${pin}:currentAuthor`);
    const allPlayers = await redis.hgetall(`game:${pin}:players`);
    console.log("All players", allPlayers);
    const voterIds = Object.keys(allPlayers).filter(() => true);
    console.log("voterIds", voterIds);

    if (voterIds.every((id) => votes[id])) {
      console.log("all players voted");
      // get this round number
      const round = await redis.get(`game:${pin}:currentRound`);
      // build a lock key for this round
      const lockKey = `game:${pin}:round:${round}:scored`;

      // attempt to acquire the lock—only the first caller will succeed
      const locked = await redis.setnx(lockKey, "1");
      if (locked === 1) {
        console.log("entered lock");
        // tally correct guesses
        let correctCount = 0;
        for (const voter of voterIds) {
          if (votes[voter] === authorId) {
            correctCount++;
            // 2 points for a correct guess
            await redis.hincrby(`game:${pin}:scores`, voter, 2);
          }
        }
        // author earns 1 point for each wrong guess
        const wrongCount = voterIds.length - correctCount;
        if (wrongCount > 0) {
          await redis.hincrby(`game:${pin}:scores`, authorId, wrongCount);
        }

        // fetch updated scores and emit final result
        const finalScores = await redis.hgetall(`game:${pin}:scores`);
        console.log(finalScores);
        io.to(pin).emit("voteResult", { votes, scores: finalScores });
      }
      // any other concurrent handlers will see locked===0 and skip scoring
    }
  });

  socket.on("disconnect", async () => {
    const keys = await redis.keys("game:*:players");
    for (const key of keys) {
      const pin = key.split(":")[1];
      if (!(await redis.hexists(key, socket.id))) continue;

      await Promise.all([
        redis.hdel(`game:${pin}:players`, socket.id),
        redis.hdel(`game:${pin}:stories`, socket.id),
        redis.hdel(`game:${pin}:scores`, socket.id),
        redis.srem(`game:${pin}:submissions`, socket.id),
      ]);

      const oldHost = await redis.get(`game:${pin}:host`);
      let newHost = oldHost;
      if (socket.id === oldHost) {
        const remaining = await redis.hkeys(`game:${pin}:players`);
        newHost = remaining[0] || "";
        await redis.set(`game:${pin}:host`, newHost);
      }

      const playersRaw3 = await redis.hgetall(`game:${pin}:players`);
      for (let [id, str] of Object.entries(playersRaw3)) {
        const p = JSON.parse(str);
        p.isHost = id === newHost;
        await redis.hset(`game:${pin}:players`, id, JSON.stringify(p));
      }

      const finalRaw = await redis.hgetall(`game:${pin}:players`);
      const finalList = Object.entries(finalRaw).map(([id, str]) =>
        JSON.parse(str)
      );
      io.to(pin).emit("playersUpdate", finalList);
      break;
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Backend listening on http://localhost:${PORT}`)
);
