// context/GameContext.js

import React, { createContext, useReducer, useContext, useEffect } from "react";
import { connectSocket } from "../services/socket";
import { useLocalSearchParams, useRouter } from "expo-router";

const initialState = {
  // list of players in the lobby
  players: [], // [{ id, username, isHost }]
  // current phase: "LOBBY" → "ROUND" → "VOTE" → "REVEAL" → "FINAL"
  phase: "LOBBY",
  round: 0,
  story: null, // story text for the current round
  authorId: null, // who wrote this round’s story
  votes: {}, // { voterId: choiceId }
  scores: {}, // { playerId: score }
};

function reducer(state, action) {
  switch (action.type) {
    case "PLAYERS_UPDATE":
      return { ...state, players: action.players };

    case "GAME_STARTED":
      return {
        ...state,
        phase: "ROUND",
        round: action.round,
        story: action.text,
        authorId: action.authorId,
        votes: {}, // reset votes for new round
      };

    case "START_VOTE":
      return { ...state, phase: "VOTE" };

    case "VOTES_UPDATE":
      return { ...state, votes: action.votes };

    case "VOTE_RESULT":
      return {
        ...state,
        phase: "REVEAL",
        votes: action.votes,
        scores: action.scores,
      };

    case "NEXT_ROUND":
      return {
        ...state,
        phase: "ROUND",
        round: state.round + 1,
        votes: {},
      };

    case "END_GAME":
      return { ...state, phase: "FINAL" };

    default:
      return state;
  }
}

const GameContext = createContext();

export function GameProvider({ children }) {
  const { gameCode, user } = useLocalSearchParams();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  // single shared socket
  const socket = connectSocket();

  useEffect(() => {
    socket.connect();

    // join lobby
    socket.emit("joinGame", { pin: gameCode, username: user });

    // update players list whenever someone joins/leaves
    socket.on("playersUpdate", (players) =>
      dispatch({ type: "PLAYERS_UPDATE", players })
    );

    // when host starts, backend emits this
    socket.on("gameStarted", ({ round, authorId, text }) => {
      dispatch({ type: "GAME_STARTED", round, authorId, text });
      router.replace(`/${gameCode}/play?user=${encodeURIComponent(user)}`);
    });

    socket.on("votesUpdate", (votes) => {
      dispatch({ type: "VOTES_UPDATE", votes });
      console.log(votes);
    });

    // after everyone votes
    socket.on("voteResult", ({ votes, scores }) =>
      dispatch({ type: "VOTE_RESULT", votes, scores })
    );

    // handle errors (e.g. bad PIN)
    socket.on("errorMessage", (msg) => {
      alert(msg);
      router.replace("/");
    });

    return () => {
      socket.disconnect();
    };
  }, [gameCode]);

  return (
    <GameContext.Provider value={{ state, dispatch, socket }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
