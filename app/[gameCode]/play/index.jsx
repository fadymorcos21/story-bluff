// app/[gameCode]/play/index.jsx
import { useGame } from "../../../context/GameContext";
import RevealView from "./(views)/RevealView";
import RoundView from "./(views)/RoundView";
import VoteView from "./(views)/VoteView";
// … potentially FinalView later

export default function Play() {
  const { state } = useGame();

  switch (state.phase) {
    case "ROUND":
      return <RoundView />;
    case "VOTE":
      return <VoteView />;
    case "REVEAL":
      return <RevealView />;
    // case "FINAL":
    //   return <FinalView />;
    default:
      return null; // or a spinner
  }
}
