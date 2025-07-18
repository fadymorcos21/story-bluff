// backend/server.js

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const Redis = require("ioredis");
const Queue = require("bull");

// Redis client (connecting to your Pi)
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
});

// Bull queue for delayed removals
const removePlayerQueue = new Queue("remove-player", {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT || 6379 }
});
// Track scheduled removal jobs by userId
const disconnectJobs = new Map();

// Helpers
function makePin(length = 1) {
  return [...Array(length)]
    .map(() => Math.random().toString(36)[2])
    .join("")
    .toUpperCase();
}

async function removePlayerCompletely(pin, userId) {
  await Promise.all([
    redis.hdel(`game:${pin}:players`, userId),
    redis.hdel(`game:${pin}:scores`, userId),
    redis.srem(`game:${pin}:submissions`, userId),
    redis.hdel(`game:${pin}:socketMap`, userId),
  ]);
}

async function getPlayerList(pin) {
  const raw = await redis.hgetall(`game:${pin}:players`);
  return Object.entries(raw).map(([id, str]) => {
    const p = JSON.parse(str);
    return { id, username: p.username, isHost: p.isHost, ready: p.ready, connected: p.connected };
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create", async (req, res) => {
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

  res.json({ pin });
});
app.get("/health", (_, res) => res.send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 60_000,
  pingTimeout: 120_000,
});

io.on("connection", socket => {
  console.log("↔️ socket connected:", socket.id);

  // Handle join (or reconnect) and cancel any pending removal
  socket.on("joinGame", async ({ pin, username }, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const { userId } = socket.handshake.auth;
    if (!userId) {
      return reply({ ok: false, error: "Missing userId. Please reconnect." });
    }

    // cancel delayed removal if queued
    if (disconnectJobs.has(userId)) {
      const jobId = disconnectJobs.get(userId);
      try {
        await removePlayerQueue.removeJobs(jobId);
      } catch (e) {
        console.warn(`Failed to cancel remove-player job ${jobId}:`, e);
      }
      disconnectJobs.delete(userId);
    }

    // 1) does the game exist?
    if (!(await redis.exists(`game:${pin}:host`))) {
      return reply({ ok: false, error: "Game not found" });
    }

    // 2) in progress?
    const inProgress = await redis.exists(`game:${pin}:storyList`);
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const isReconnecting = !!playersRaw[userId];
    
    // if reconnecting, mark them alive again
    if (isReconnecting) {
      const existing = JSON.parse(playersRaw[userId]);
      existing.connected = true;
      await redis.hset(`game:${pin}:players`, userId, JSON.stringify(existing));
    }

    // if in progress and not one of the originals, reject
    if (inProgress && !isReconnecting) {
      return reply({ ok: false, error: "Game already in progress" });
    }

    // 3) assign host if needed
    let hostId = await redis.get(`game:${pin}:host`);
    if (!hostId) {
      await redis.set(`game:${pin}:host`, userId);
      hostId = userId;
    }

    // 4) record (or reconnect) this player as alive
    const playerObj = { username, isHost: userId === hostId, ready: false, connected: true };
    await redis.hset(`game:${pin}:players`, userId, JSON.stringify(playerObj));
    await redis.hset(`game:${pin}:scores`, userId, 0);
    await redis.hset(`game:${pin}:socketMap`, userId, socket.id);
    socket.join(pin);

    // 5) broadcast lobby
    const playerList = await getPlayerList(pin);
    io.to(pin).emit("playersUpdate", playerList);

    // 6) ack
    reply({ ok: true }); = typeof cb === "function" ? cb : () => {};
    const { userId } = socket.handshake.auth;
    if (!userId) {
      return reply({ ok: false, error: "Missing userId. Please reconnect." });
    }

    // cancel delayed removal if queued
    if (disconnectJobs.has(userId)) {
      const jobId = disconnectJobs.get(userId);
      try {
        await removePlayerQueue.removeJobs(jobId);
      } catch (e) {
        console.warn(`Failed to cancel remove-player job ${jobId}:`, e);
      }
      disconnectJobs.delete(userId);
    }

    // 1) does the game exist?
    if (!(await redis.exists(`game:${pin}:host`))) {
      return reply({ ok: false, error: "Game not found" });
    }

    // 2) in progress?
    const inProgress = await redis.exists(`game:${pin}:storyList`);
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const isReconnecting = !!playersRaw[userId];
    if (inProgress && !isReconnecting) {
      return reply({ ok: false, error: "Game already in progress" });
    }

    // 3) assign host if needed
    let hostId = await redis.get(`game:${pin}:host`);
    if (!hostId) {
      await redis.set(`game:${pin}:host`, userId);
      hostId = userId;
    }

    // 4) record/connect player
    const playerObj = { username, isHost: userId === hostId, ready: false, connected: true };
    await redis.hset(`game:${pin}:players`, userId, JSON.stringify(playerObj));
    await redis.hset(`game:${pin}:scores`, userId, 0);
    await redis.hset(`game:${pin}:socketMap`, userId, socket.id);
    socket.join(pin);

    // 5) broadcast lobby
    const playerList = await getPlayerList(pin);
    io.to(pin).emit("playersUpdate", playerList);

    // 6) ack
    reply({ ok: true });

    // Handle story submissions keyed by userId
  socket.on("submitStories", async ({ pin, stories }) => {
    const { userId } = socket.handshake.auth;
    // store the user's story list
    await redis.hset(`game:${pin}:stories`, userId, JSON.stringify(stories));
    await redis.sadd(`game:${pin}:submissions`, userId);

    // mark player ready
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const meRaw = playersRaw[userId];
    if (meRaw) {
      const me = JSON.parse(meRaw);
      me.ready = true;
      await redis.hset(`game:${pin}:players`, userId, JSON.stringify(me));
    }

    // broadcast updated lobby
    const playerList = await getPlayerList(pin);
    io.to(pin).emit("playersUpdate", playerList);

    // if all original players have submitted, notify clients
    const totalCount = playerList.length;
    const subCount = await redis.scard(`game:${pin}:submissions`);
    if (subCount === totalCount) {
      io.to(pin).emit("storiesSubmitted");
    }
  });

  // Handle voting keyed by userId
  socket.on("vote", async ({ pin, choiceId }) => {
    const { userId } = socket.handshake.auth;
    // record the vote
    await redis.hset(`game:${pin}:votes`, userId, choiceId);

    // broadcast interim votes
    const votes = await redis.hgetall(`game:${pin}:votes`);
    io.to(pin).emit("votesUpdate", votes);

    // tally if all alive have voted
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const aliveIds = Object.entries(playersRaw)
      .filter(([_, str]) => JSON.parse(str).connected)
      .map(([id]) => id);

    if (aliveIds.every(id => votes[id])) {
      const round = Number(await redis.get(`game:${pin}:currentRound`) || 0);
      const authorId = await redis.get(`game:${pin}:currentAuthor`);

      // prevent double-scoring using a lock key
      const lockKey = `game:${pin}:round:${round}:scored`;
      const locked = await redis.setnx(lockKey, "1");
      if (locked === 1) {
        let correct = 0;
        for (const voter of aliveIds) {
          if (votes[voter] === authorId) {
            correct++;
            await redis.hincrby(`game:${pin}:scores`, voter, 2);
          }
        }
        const wrong = aliveIds.length - correct;
        if (wrong > 0) {
          await redis.hincrby(`game:${pin}:scores`, authorId, wrong);
        }
        const finalScores = await redis.hgetall(`game:${pin}:scores`);
        io.to(pin).emit("voteResult", { votes, scores: finalScores });
      }
    }
  });

  // Handle voting keyed by userId
  socket.on("vote", async ({ pin, choiceId }) => {
    const { userId } = socket.handshake.auth;
    // record the vote
    await redis.hset(`game:${pin}:votes`, userId, choiceId);

    // broadcast interim votes
    const votes = await redis.hgetall(`game:${pin}:votes`);
    io.to(pin).emit("votesUpdate", votes);

    // tally if all alive have voted
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const aliveIds = Object.entries(playersRaw)
      .filter(([_, str]) => JSON.parse(str).connected)
      .map(([id]) => id);

    if (aliveIds.every(id => votes[id])) {
      const round = Number(await redis.get(`game:${pin}:currentRound`) || 0);
      const authorId = await redis.get(`game:${pin}:currentAuthor`);

      // prevent double-scoring using a lock key
      const lockKey = `game:${pin}:round:${round}:scored`;
      const locked = await redis.setnx(lockKey, "1");
      if (locked === 1) {
        let correct = 0;
        for (const voter of aliveIds) {
          if (votes[voter] === authorId) {
            correct++;
            await redis.hincrby(`game:${pin}:scores`, voter, 2);
          }
        }
        const wrong = aliveIds.length - correct;
        if (wrong > 0) {
          await redis.hincrby(`game:${pin}:scores`, authorId, wrong);
        }
        const finalScores = await redis.hgetall(`game:${pin}:scores`);
        io.to(pin).emit("voteResult", { votes, scores: finalScores });
      }
    }
  });
  });

  // Handle submissions, startGame, nextRound, vote, etc. (unchanged)
  // … your existing event handlers here …

  // Disconnect: immediate removal in lobby, delayed via Bull when in-game
  socket.on("disconnect", async () => {
    const { userId } = socket.handshake.auth;
    const keys = await redis.keys("game:*:players");
    for (const key of keys) {
      const pin = key.split(":")[1];
      if (!(await redis.hexists(key, userId))) continue;

      const round = Number(await redis.get(`game:${pin}:currentRound`) || 0);
      if (round === 0) {
        // immediate lobby removal
        await removePlayerCompletely(pin, userId);
        io.to(pin).emit("playersUpdate", await getPlayerList(pin));
      } else {
        // mark offline & broadcast
        const raw = await redis.hget(`game:${pin}:players`, userId);
        if (raw) {
          const p = JSON.parse(raw);
          p.connected = false;
          await redis.hset(`game:${pin}:players`, userId, JSON.stringify(p));
          io.to(pin).emit("playersUpdate", await getPlayerList(pin));
        }
        // schedule hard delete
        const job = await removePlayerQueue.add({ pin, userId }, { delay: 75_000 });
        disconnectJobs.set(userId, job.id);
      }
      break;
    }
  });
});

// Process delayed removals
removePlayerQueue.process(async job => {
  const { pin, userId } = job.data;
  await removePlayerCompletely(pin, userId);
  const list = await getPlayerList(pin);
  io.to(pin).emit("playersUpdate", list);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Backend listening on http://localhost:${PORT}`)
);
