// app/[gameCode]/play/index.jsx
import { useGame } from "../../../context/GameContext";
import RevealView from "./(views)/RevealView";
import RoundView from "./(views)/RoundView";
import VoteView from "./(views)/VoteView";
import FinalView from "./(views)/FinalView";
// … potentially FinalView later

export default function Play() {
  const { state } = useGame();
  console.log(`[PLAY ${state.phase}] rendering phase`, state.phase);

  switch (state.phase) {
    case "ROUND":
      return <RoundView />;
    case "VOTE":
      return <VoteView />;
    case "REVEAL":
      return <RevealView />;
    case "FINAL":
      return <FinalView />;
    default:
      return <Text style={{ color: "red" }}>The White Screen Error</Text>;
  }
}
