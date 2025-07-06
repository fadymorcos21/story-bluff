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
function makePin(length = 1) {
  return [...Array(length)].map(() => Math.random().toString(36)[2]).join("");
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create", async (req, res) => {
  console.log("A");
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

  socket.on("startGame", async (pin) => {
    const host = await redis.get(`game:${pin}:host`);
    if (socket.id !== host) return;

    // —— NEW: enforce 3‐player minimum ——
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const playerCount = Object.keys(playersRaw).length;
    if (playerCount < 3) {
      return socket.emit(
        "errorMessage",
        `Need at least 3 players to start (currently ${playerCount}).`
      );
    }

    await redis.del(`game:${pin}:votes`);

    await redis.set(`game:${pin}:currentRound`, 1);

    const storiesRaw = await redis.hgetall(`game:${pin}:stories`);
    const authors = Object.keys(storiesRaw);
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];

    await redis.set(`game:${pin}:currentAuthor`, randomAuthor);

    const firstStory = JSON.parse(storiesRaw[randomAuthor])[0];

    io.to(pin).emit("gameStarted", {
      round: 1,
      authorId: randomAuthor,
      text: firstStory,
    });
  });

  // socket.on("vote", async ({ pin, choiceId }) => {
  //   // 1) record this vote
  //   await redis.hset(`game:${pin}:votes`, socket.id, choiceId);

  //   // 2) fetch the up-to-the-moment votes map
  //   const votes = await redis.hgetall(`game:${pin}:votes`);

  //   // 3) broadcast intermediate update so everyone can stack initials
  //   console.log(votes);
  //   io.to(pin).emit("votesUpdate", votes);

  //   // 4) if everyone (except author) has voted, tally and emit final results
  //   const authorId = await redis.get(`game:${pin}:currentAuthor`);
  //   const allPlayers = await redis.hgetall(`game:${pin}:players`);
  //   const voterIds = Object.keys(allPlayers).filter((id) => id !== authorId);

  //   if (voterIds.every((id) => votes[id])) {
  //     // tally scores
  //     let correctCount = 0;
  //     for (const voter of voterIds) {
  //       if (votes[voter] === authorId) {
  //         correctCount++;
  //         // 2 points for a correct guess
  //         await redis.hincrby(`game:${pin}:scores`, voter, 2);
  //       }
  //     }
  //     // author gets 1 point for each wrong guess
  //     const wrongCount = voterIds.length - correctCount;
  //     if (wrongCount > 0) {
  //       await redis.hincrby(`game:${pin}:scores`, authorId, wrongCount);
  //     }

  //     const scores = await redis.hgetall(`game:${pin}:scores`);
  //     console.log(scores);
  //     // io.to(pin).emit("voteResult", { votes, scores });
  //   }
  // });

  socket.on("vote", async ({ pin, choiceId }) => {
    // 1) record this vote
    await redis.hset(`game:${pin}:votes`, socket.id, choiceId);

    // 2) fetch the up‐to‐the‐moment votes map
    const votes = await redis.hgetall(`game:${pin}:votes`);

    // 3) broadcast intermediate update so everyone can stack initials
    io.to(pin).emit("votesUpdate", votes);

    // 4) if everyone (except author) has voted, tally and emit final results
    const authorId = await redis.get(`game:${pin}:currentAuthor`);
    const allPlayers = await redis.hgetall(`game:${pin}:players`);
    const voterIds = Object.keys(allPlayers).filter((id) => id !== authorId);

    if (voterIds.every((id) => votes[id])) {
      // get this round number
      const round = await redis.get(`game:${pin}:currentRound`);
      // build a lock key for this round
      const lockKey = `game:${pin}:round:${round}:scored`;

      // attempt to acquire the lock—only the first caller will succeed
      const locked = await redis.setnx(lockKey, "1");
      if (locked === 1) {
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
        // io.to(pin).emit("voteResult", { votes, scores: finalScores });
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
