import { Stack } from "expo-router";
import { analysisColors } from "@/components/analysis/analysis-theme";

export default function MatchEventLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: analysisColors.bg },
        animation: "slide_from_right"
      }}
    />
  );
}
