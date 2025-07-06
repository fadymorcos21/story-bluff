import { useGame } from "../../../../context/GameContext";

export default function RevealView() {
  const { state, socket } = useGame();

  const next = () => {
    socket.emit("nextRound", state.round + 1);
    // reducer handles increment & resetting votes
  };

  return (
    <View>
      <Text>
        It was {state.players.find((p) => p.id === state.authorId).username}’s
        story!
      </Text>
      <Text>Scores:</Text>
      {Object.entries(state.scores).map(([id, score]) => {
        const p = state.players.find((p) => p.id === id);
        return (
          <Text key={id}>
            {p.username}: {score}
          </Text>
        );
      })}
      <Button title="Next Round" onPress={next} />
    </View>
  );
}
