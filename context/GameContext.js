// context/GameContext.js

import React, {
  createContext,
  useReducer,
  useContext,
  useEffect,
  useState,
} from "react";
import { connectSocket, disconnectSocket } from "../services/socket";
import {
  useLocalSearchParams,
  useGlobalSearchParams,
  useRouter,
} from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const initialState = {
  players: [], // [{ id, username, isHost, ready }]
  phase: "LOBBY", // "LOBBY" → "ROUND" → "VOTE" → "REVEAL" → "FINAL"
  round: 0,
  story: null,
  authorId: null,
  votes: {}, // { voterId: choiceId }
  scores: {}, // { playerId: score }
  initialPlayers: [],
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
        votes: {},
        initialPlayers: action.initialPlayers,
      };

    case "REHYDRATE":
      return {
        ...state,
        players: action.state.players,
        initialPlayers: action.state.initialPlayers,
        phase: action.state.phase,
        round: action.state.round,
        authorId: action.state.authorId,
        votes: action.state.votes,
        scores: action.state.scores,
        story: action.state.story,
      };

    case "NEXT_ROUND":
      return {
        ...state,
        phase: "ROUND",
        round: action.round,
        story: action.text,
        authorId: action.authorId,
        votes: {},
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

    case "END_GAME":
      return { ...state, phase: "FINAL" };

    case "RESET":
      return {
        ...state,
        phase: "LOBBY",
        round: 0,
        story: null,
        authorId: null,
        votes: {},
        scores: {},
      };

    default:
      return state;
  }
}

const GameContext = createContext();

export function GameProvider({ children }) {
  const { gameCode } = useLocalSearchParams();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user } = useGlobalSearchParams();

  // Hold the socket instance in state so components can use it safely
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const s = await connectSocket();
      if (!isMounted) return;
      setUserId(s.auth.userId);
      if (!isMounted) return;

      setSocket(s);

      // const existingUserId = await AsyncStorage.getItem("userId");
      // console.log(
      //   `navigating user ${user} with ${existingUserId} to game ${gameCode}`
      // );
      s.emit("joinGame", {
        pin: gameCode,
        username: user,
        // userId: existingUserId,
      });

      // Register event listeners
      s.on("playersUpdate", (players) =>
        dispatch({ type: "PLAYERS_UPDATE", players })
      );

      s.on("gameStarted", ({ round, authorId, text, initialPlayers }) => {
        dispatch({
          type: "GAME_STARTED",
          round,
          authorId,
          text,
          initialPlayers,
        });
        router.replace(`/${gameCode}/play?user=${encodeURIComponent(user)}`);
      });

      s.on("nextRound", ({ round, authorId, text }) =>
        dispatch({ type: "NEXT_ROUND", round, authorId, text })
      );

      s.on("votesUpdate", (votes) => dispatch({ type: "VOTES_UPDATE", votes }));

      s.on("voteResult", ({ votes, scores }) =>
        dispatch({ type: "VOTE_RESULT", votes, scores })
      );

      s.on("errorMessage", (msg) => {
        alert(msg);
        router.replace("/");
      });

      s.on("roundPrepared", ({ round, authorId, text }) =>
        dispatch({ type: "ROUND_PREPARED", round, authorId, text })
      );

      s.on("syncState", (fullState) => {
        dispatch({ type: "REHYDRATE", state: fullState });

        // if the game is already in progress, navigate into Play:
        if (fullState.phase !== "LOBBY" || fullState.round !== 0) {
          router.replace(`/${gameCode}/play?user=${encodeURIComponent(user)}`);
        }
      });

      s.on("gameEnded", () => dispatch({ type: "END_GAME" }));
    })();

    return () => {
      isMounted = false;
      disconnectSocket();
      setSocket(null);
    };
  }, [gameCode]);

  return (
    <GameContext.Provider value={{ state, dispatch, socket, userId }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
