import { Stack } from "expo-router";
import { ComingSoonScreen } from "@/components/ComingSoonScreen";

export default function SimulatorDetailScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Simulatore match" }} />
      <ComingSoonScreen title="Simulatore match" />
    </>
  );
}
