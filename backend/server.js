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

const Redlock = require("redlock");
const redlock = new Redlock([redis], {
  // don’t retry acquiring the lock
  retryCount: 0,
  // optional back-off settings
  retryDelay: 200,
  retryJitter: 200,
});

redis
  .config("SET", "notify-keyspace-events", "Ex")
  .then(() => console.log("✅ Redis keyspace notifications enabled"))
  .catch(console.error);

const subscriber = new Redis({ host: process.env.REDIS_HOST, port: 6379 });
subscriber
  .config("SET", "notify-keyspace-events", "Ex")
  .then(() => subscriber.subscribe("__keyevent@0__:expired"))
  .catch(console.error);

async function finalizeVotingIfDone(pin) {
  // Only relevant during VOTE phase
  const phase = await redis.get(`game:${pin}:phase`);
  if (phase !== "VOTE") return;

  // Use current round in the lock key so concurrent rounds don’t collide
  const round = Number(await redis.get(`game:${pin}:currentRound`)) || 1;
  const lockKey = `lock:game:${pin}:vote:${round}:finalize`;

  let lock;
  try {
    lock = await redlock.lock(lockKey, 5_000);
  } catch {
    // Someone else is finalizing or just finalized
    return;
  }

  try {
    // Re-read inside the lock to avoid TOCTOU races
    const [authorId, live, votes] = await Promise.all([
      redis.get(`game:${pin}:currentAuthor`),
      redis.hkeys(`game:${pin}:players`),
      redis.hgetall(`game:${pin}:votes`),
    ]);

    // All *current live* non-authors must have a vote
    const voterIds = live.filter((id) => id !== authorId);
    const allVoted = voterIds.every((id) => votes[id]);
    if (!allVoted) return;

    // Tally (same logic you already use)
    for (const voter of voterIds) {
      if (votes[voter] === authorId) {
        await redis.hincrby(`game:${pin}:scores`, voter, 2);
      }
    }
    const wrongCount =
      voterIds.length - voterIds.filter((v) => votes[v] === authorId).length;
    if (wrongCount > 0) {
      await redis.hincrby(`game:${pin}:scores`, authorId, wrongCount);
    }

    await redis.set(`game:${pin}:phase`, "REVEAL");
    const finalScores = await redis.hgetall(`game:${pin}:scores`);
    io.to(pin).emit("voteResult", { votes, scores: finalScores });
  } finally {
    try {
      await lock.unlock();
    } catch {}
  }
}

subscriber.on("message", async (_chan, expiredKey) => {
  // only handle our disconnect‐TTL keys:
  const m = expiredKey.match(/^game:(.+):dc:(.+)$/);
  if (!m) return;
  console.log(m);
  const [, pin, userId] = m;

  console.log(
    `⏲ ----------- TTL expired → purging ${userId} from game ${pin} ----------- ⏲`
  );

  // 1) delete their live‐game data (but NOT initialPlayers):
  await Promise.all([
    redis.hdel(`game:${pin}:players`, userId),
    redis.hdel(`game:${pin}:stories`, userId),
    redis.srem(`game:${pin}:submissions`, userId),
  ]);

  // 2) if they were host, pick a new one:
  const oldHost = await redis.get(`game:${pin}:host`);
  if (oldHost === userId) {
    const remaining = await redis.hkeys(`game:${pin}:players`);
    const newHost = remaining[0] || "";
    await redis.set(`game:${pin}:host`, newHost);
    for (const rid of remaining) {
      const rp = JSON.parse(await redis.hget(`game:${pin}:players`, rid));
      rp.isHost = rid === newHost;
      await redis.hset(`game:${pin}:players`, rid, JSON.stringify(rp));
    }
  }

  // 3) broadcast the updated roster:
  const raw = await redis.hgetall(`game:${pin}:players`);
  console.log("raw updated players: ", raw);
  const updatedList = Object.entries(raw).map(([id, str]) => {
    const p = JSON.parse(str);
    return {
      id,
      username: p.username,
      isHost: p.isHost,
      ready: p.ready,
      isConnected: p.isConnected,
    };
  });
  io.to(pin).emit("playersUpdate", updatedList);
  await finalizeVotingIfDone(pin);
});

// Helpers
function makePin(length = 5) {
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
  console.log("Setting phase: LOBBY !!!!!!!!!");

  await redis.set(`game:${pin}:phase`, "LOBBY");
});

app.get("/health", (_, res) => res.send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 60_000, // default is 25 000

  // how long without a pong before we consider the client disconnected (ms):
  pingTimeout: 120_000, // default is 5000

  // WAS ABLE TO GOT 127 second in background while in lobby, disconnected cuz i saved this comment
  // WAS ABLE TO GOT 127 second in background while in lobby
});

io.on("connection", (socket) => {
  console.log(
    "↔️ User connected:",
    socket.handshake.auth.userId,
    " with socket id ",
    socket.id
  );

  socket.on("joinGame", async ({ gameCode, username }, cb) => {
    await redis.del(`game:${gameCode}:dc:${socket.handshake.auth.userId}`);
    const { userId } = socket.handshake.auth;
    console.log("User ID:", userId);
    console.log("Auth Data:", socket.handshake.auth);

    // 1. Validate game existence and status
    const reply = typeof cb === "function" ? cb : () => {};
    console.log("step 1");
    const gameExists = await redis.exists(
      `game:${gameCode.toUpperCase()}:host`
    );
    console.log("step 2");
    console.log("FGAME CODE", gameCode);

    if (!gameExists) return reply({ ok: false, error: "Game not found" });
    console.log("step 3: rip?");

    const inProgress = await redis.exists(`game:${gameCode}:storyList`);
    console.log("step 4: idk");

    // If game is in progress, allow only known user to rejoin, block new players
    const wasInitial = await redis.hexists(
      `game:${gameCode.toUpperCase()}:initialPlayers`,
      userId
    );

    console.log("in progress:", inProgress);
    console.log("wasInitial:", wasInitial);
    if (inProgress && !wasInitial) {
      return reply({ ok: false, error: "Game already in progress" });
    }

    // Enforce 10 player limit
    const currentCount = await redis.hlen(`game:${gameCode}:players`);

    console.log(
      "----------------------------------------------current count: ",
      currentCount,
      "------------------------------------------------"
    );
    const raw = await redis.hgetall(`game:${gameCode.toUpperCase()}:players`);
    console.log("raw updated players: ", raw);

    if (!wasInitial && currentCount >= 11) {
      console.log(`Rejecting join: ${username} (${userId}) as game is full`);
      // respond via callback if present
      reply({ ok: false, error: "Game is full (10 players max)" });
      // also notify socket in case no callback was provided
      socket.emit("errorMessage", "Game is full (10 players max)");
      return;
    }

    console.log(
      `${
        wasInitial ? "RE" : ""
      }JOINING: -- ${username} with userID ${userId}to game ${gameCode}`
    );

    // 2. Assign host if none, using userId as host identifier
    let hostId = await redis.get(`game:${gameCode.toUpperCase()}:host`);
    if (!hostId) {
      await redis.set(`game:${gameCode.toUpperCase()}:host`, userId);
      hostId = userId;
    }

    // 3. Join socket to the game room and tag it with userId for later use
    socket.join(gameCode.toUpperCase());
    socket.data.userId = userId;

    // 4. Add or update player info in Redis using userId as the key
    const playerKey = `game:${gameCode.toUpperCase()}:players`;
    const existingData = await redis.hget(playerKey, userId);
    if (!existingData) {
      const playerObj = {
        username,
        isHost: userId === hostId,
        ready: inProgress,
        isConnected: true,
      };
      await redis.hset(playerKey, userId, JSON.stringify(playerObj));
      // await redis.hset(`game:${gameCode}:scores`, userId, 0);
      await redis.hsetnx(`game:${gameCode.toUpperCase()}:scores`, userId, 0);
    } else {
      // Player rejoining – update username if it changed (keep isHost/ready flags)
      const playerObj = JSON.parse(existingData);
      if (playerObj.username !== username) {
        playerObj.username = username;
      }
      playerObj.isConnected = true;
      await redis.hset(playerKey, userId, JSON.stringify(playerObj));
    }
    // 5. Broadcast updated lobby state to all players
    const playersRaw = await redis.hgetall(playerKey);
    const playerList = Object.entries(playersRaw).map(([id, data]) => {
      const p = JSON.parse(data);
      return {
        id,
        username: p.username,
        isHost: p.isHost,
        ready: p.ready,
        isConnected: p.isConnected,
      };
    });
    console.log(
      "playerList:\n" +
        playerList
          .map(
            (p, i) =>
              `${i + 1}. ${p.username} (id: ${p.id}, host: ${
                p.isHost
              }, ready: ${p.ready}, connected: ${p.isConnected})`
          )
          .join("\n")
    );
    io.to(gameCode.toUpperCase()).emit("playersUpdate", playerList);

    // 6) Now send full state back *just* to this socket for rehydration:
    const [
      hasStarted,
      roundRaw,
      authorId,
      votesRaw,
      scoresRaw,
      initialRaw,
      rawStoryList,
      phaseValue,
    ] = await Promise.all([
      redis.exists(`game:${gameCode.toUpperCase()}:storyList`),
      redis.get(`game:${gameCode.toUpperCase()}:currentRound`),
      redis.get(`game:${gameCode.toUpperCase()}:currentAuthor`),
      redis.hgetall(`game:${gameCode.toUpperCase()}:votes`),
      redis.hgetall(`game:${gameCode.toUpperCase()}:scores`),
      redis.hgetall(`game:${gameCode.toUpperCase()}:initialPlayers`),
      redis.get(`game:${gameCode.toUpperCase()}:storyList`),
      redis.get(`game:${gameCode.toUpperCase()}:phase`),
    ]);

    // parse out the current story text if the game’s started
    let storyText = null;
    if (inProgress && rawStoryList) {
      const list = JSON.parse(rawStoryList);
      const idx = Number(roundRaw) || 0;
      if (list[idx]) {
        storyText = list[idx].text;
      }
      // console.log("order", list);
      // console.log("story", storyText);
    }

    const initialPlayers = Object.entries(initialRaw).map(([id, json]) => {
      const p = JSON.parse(json);
      // p already has { username, isHost, ready, isConnected }
      return { id, ...p };
    });

    console.log("SYNCING STATE ", phaseValue);
    socket.emit("syncState", {
      players: playerList,
      initialPlayers: initialPlayers || [],
      phase: phaseValue,
      round: roundRaw ? Number(roundRaw) : 0,
      authorId,
      story: storyText,
      votes: votesRaw || {},
      scores: scoresRaw || {},
    });

    //  7) Final ack for success
    reply({ ok: true });
  });

  socket.on("submitStories", async ({ pin, stories }) => {
    await redis.hset(
      `game:${pin.toUpperCase()}:stories`,
      socket.data.userId,
      JSON.stringify(stories)
    );
    await redis.sadd(
      `game:${pin.toUpperCase()}:submissions`,
      socket.data.userId
    );

    const playerData = JSON.parse(
      await redis.hget(`game:${pin.toUpperCase()}:players`, socket.data.userId)
    );
    playerData.ready = true;
    await redis.hset(
      `game:${pin.toUpperCase()}:players`,
      socket.data.userId,
      JSON.stringify(playerData)
    );

    // re-broadcast playersUpdate
    const playersRaw2 = await redis.hgetall(
      `game:${pin.toUpperCase()}:players`
    );
    // console.log(playersRaw2);
    const updatedList = Object.entries(playersRaw2).map(([id, str]) => {
      const p = JSON.parse(str);
      return {
        id,
        username: p.username,
        isHost: p.isHost,
        ready: p.ready,
        isConnected: p.isConnected,
      };
    });
    io.to(pin.toUpperCase()).emit("playersUpdate", updatedList);

    // optional storiesSubmitted
    const subCount = await redis.scard(`game:${pin.toUpperCase()}:submissions`);
    const totalPlayers = Object.keys(playersRaw2).length;
    if (subCount === totalPlayers) {
      io.to(pin.toUpperCase()).emit("storiesSubmitted");
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
    pin = pin.toUpperCase();
    // Only the host may start the game
    const host = await redis.get(`game:${pin}:host`);
    if (socket.data.userId !== host) return;

    // --- 1) snapshot current players for this game ---
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const initial = Object.keys(playersRaw); // [userId1, userId2, …]

    // also build full player objects for client-side voting/scoreboard
    const playerList = Object.entries(playersRaw).map(([id, str]) => {
      const p = JSON.parse(str);
      return {
        id,
        username: p.username,
        isHost: p.isHost,
        ready: p.ready,
        isConnected: p.isConnected,
      };
    });

    await redis.del(`game:${pin}:initialPlayers`);
    const multi = redis.multi();
    for (const p of playerList) {
      multi.hset(`game:${pin}:initialPlayers`, p.id, JSON.stringify(p));
    }
    await multi.exec();

    for (const id of playerList.map((p) => p.id)) {
      await redis.hsetnx(`game:${pin}:scores`, id, 0);
    }
    // Enforce a minimum of 3 players
    const playerCount = initial.length;
    if (playerCount < 3) {
      return socket.emit(
        "errorMessage",
        `Need at least 3 players to start (currently ${playerCount}).`
      );
    }

    await redis.set(`game:${pin}:inProgress`, "1");

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
    console.log("Setting phase: ROUND !!!!!!!!!");

    await redis.set(`game:${pin}:phase`, "ROUND");

    io.to(pin).emit("gameStarted", {
      round: 1,
      authorId,
      text,
      // initialPlayers: initial,
      initialPlayers: playerList,
    });
  });

  socket.on("nextRound", async ({ pin, roundKey }) => {
    // const current = Number(await redis.get(`game:${pin}:currentRound`)) || 1;
    const lockKey = `lock:game:${pin}:advance:${roundKey}`;

    console.log("KEY: ", roundKey);
    let lock;
    try {
      // grab a 10s lock (throws if already locked)
      lock = await redlock.lock(lockKey, 10_000);
    } catch {
      return; // someone else is already advancing the round
    }

    const list = JSON.parse(await redis.get(`game:${pin}:storyList`));
    const next = roundKey + 1;

    if (next >= list.length) {
      await redis.set(`game:${pin}:phase`, "FINAL");
      await lock.unlock();
      return io.to(pin).emit("gameEnded");
    }

    // clear votes, bump round & author, broadcast
    await redis.del(`game:${pin}:votes`);
    const { authorId, text } = list[next];
    await Promise.all([
      redis.set(`game:${pin}:currentRound`, next),
      redis.set(`game:${pin}:currentAuthor`, authorId),
    ]);
    io.to(pin).emit("nextRound", { round: next, authorId, text });

    // release the lock so others can advance
    await lock.unlock();
    console.log("Setting phase: ROUND !!!!!!!!!");

    await redis.set(`game:${pin}:phase`, "ROUND");
  });

  // socket.on("nextRound", async (pin) => {
  //   // only the host can trigger the next round
  //   // const host = await redis.get(`game:${pin}:host`);
  //   // if (socket.data.userId !== host) return;
  //   const current = Number(await redis.get(`game:${pin}:currentRound`)) || 1;
  //   const lockKey = `game:${pin}:round:${current}:advance`;
  //   // NX means “only set if not already set”, EX 10 gives it a 10s TTL
  //   const gotLock = await redis.set(lockKey, "1", "NX", "EX", 10);
  //   if (!gotLock) {
  //     // someone else already advanced us
  //     return;
  //   }
  //   console.log("-------------------------------RAN ", current);
  //   // pull down your pre‐shuffled storyList and current round
  //   const list = JSON.parse(await redis.get(`game:${pin}:storyList`));
  //   // const current = Number(await redis.get(`game:${pin}:currentRound`)) || 1;
  //   const next = current + 1;

  //   // if we’ve exhausted the list, end the game
  //   if (next >= list.length) {
  //     return io.to(pin).emit("gameEnded");
  //   }

  //   // —— NEW: clear out last round’s votes ——
  //   await redis.del(`game:${pin}:votes`);

  //   // advance the round pointer and set the new author
  //   await redis.set(`game:${pin}:currentRound`, next);
  //   const { authorId, text } = list[next];
  //   await redis.set(`game:${pin}:currentAuthor`, authorId);

  //   // tell everyone to move into the next round
  //   io.to(pin).emit("nextRound", { round: next, authorId, text });
  // });

  socket.on("resetGame", async (pin) => {
    // only the host may reset
    const hostId = await redis.get(`game:${pin}:host`);
    if (socket.data.userId !== hostId) return; // Only host (by userId) can start

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
        `game:${pin}:currentAuthor`,
        `game:${pin}:inProgress`,
        `game:${pin}:initialPlayers`
      )
      .set(`game:${pin}:phase`, "LOBBY");

    // 3) clear any per‐user disconnect TTL keys: game:<pin>:dc:<userId>
    const dcKeys = await redis.keys(`game:${pin}:dc:*`);
    for (const key of dcKeys) {
      multi.del(key);
    }

    // 4) clear your lock keys too
    if (lockKeys.length) {
      lockKeys.forEach((lk) => multi.del(lk));
      console.log("clearing old locks:", lockKeys);
    }

    await multi.exec();

    // 2) force every socket to leave the room so the lobby is empty
    //    (requires Socket.IO v4+)
    await io.in(pin).socketsLeave(pin);
  });

  socket.on("startVote", async (pin) => {
    await redis.set(`game:${pin}:phase`, "VOTE");
    io.to(pin).emit("startVote");
  });

  socket.on("vote", async ({ pin, choiceId }) => {
    await redis.hset(`game:${pin}:votes`, socket.data.userId, choiceId);
    const votes = await redis.hgetall(`game:${pin}:votes`);
    io.to(pin).emit("votesUpdate", votes);

    // Can replace code below here with finalizeVotingIfDone function
    // Determine if all non-authors have voted
    const authorId = await redis.get(`game:${pin}:currentAuthor`);
    const live = await redis.hkeys(`game:${pin}:players`);
    const voterIds = live.filter((id) => id !== authorId);

    console.log("live after vote cast", live);
    console.log("voterIds derived from live after vote cast", voterIds);

    if (voterIds.every((id) => votes[id])) {
      // Everyone has voted – tally scores
      for (const voter of voterIds) {
        if (votes[voter] === authorId) {
          await redis.hincrby(`game:${pin}:scores`, voter, 2);
        }
      }
      const wrongCount =
        voterIds.length - voterIds.filter((v) => votes[v] === authorId).length;
      if (wrongCount > 0) {
        await redis.hincrby(`game:${pin}:scores`, authorId, wrongCount);
      }
      console.log("Setting phase: REVEAL !!!!!!!!!");

      await redis.set(`game:${pin}:phase`, "REVEAL");
      const finalScores = await redis.hgetall(`game:${pin}:scores`);
      io.to(pin).emit("voteResult", { votes, scores: finalScores });
    }
  });

  socket.on("disconnect", async () => {
    // find every game where this user was in the players hash
    const keys = await redis.keys("game:*:players");
    console.log(
      "User disconnected: ",
      socket.data.userId,
      " with socket id: ",
      socket.id
    );
    for (const key of keys) {
      const pin = key.split(":")[1];
      // skip games where they weren’t a player
      if (!(await redis.hexists(key, socket.data.userId))) continue;

      const hasStarted = await redis.exists(`game:${pin}:storyList`);
      if (!hasStarted) {
        await Promise.all([
          redis.hdel(`game:${pin}:players`, socket.data.userId),
          redis.hdel(`game:${pin}:stories`, socket.data.userId),
          redis.hdel(`game:${pin}:scores`, socket.data.userId),
          redis.srem(`game:${pin}:submissions`, socket.data.userId),
        ]);

        // 1b) if they were host, pick a new one
        const oldHost = await redis.get(`game:${pin}:host`);
        let newHost = oldHost;
        if (socket.data.userId === oldHost) {
          const remaining = await redis.hkeys(`game:${pin}:players`);
          newHost = remaining[0] || "";
          await redis.set(`game:${pin}:host`, newHost);
        }

        // 1c) update isHost flags for everyone left
        const playersRaw = await redis.hgetall(`game:${pin}:players`);
        for (const [id, str] of Object.entries(playersRaw)) {
          const p = JSON.parse(str);
          p.isHost = id === newHost;
          await redis.hset(`game:${pin}:players`, id, JSON.stringify(p));
        }
      } else {
        // 1) mark them offline instead of deleting
        console.log(
          `Marking user ${socket.data.userId} offline in game ${pin}`
        );

        await redis.set(`game:${pin}:dc:${socket.data.userId}`, "1", "EX", 30);

        const raw = JSON.parse(await redis.hget(key, socket.data.userId));
        raw.isConnected = false;
        await redis.hset(key, socket.data.userId, JSON.stringify(raw));
      }

      // 1d) broadcast the new lobby
      const updatedPlayersRaw = await redis.hgetall(`game:${pin}:players`);
      const updatedList = Object.entries(updatedPlayersRaw).map(([id, str]) => {
        const p = JSON.parse(str);
        return {
          id,
          username: p.username,
          isHost: p.isHost,
          ready: p.ready,
          isConnected: p.isConnected,
        };
      });
      io.to(pin).emit("playersUpdate", updatedList);

      break; // found the game, no need to keep looping
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🚀 Backend listening on http://localhost:${PORT}`)
);
