import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/lib/theme";

interface TeamAvatarProps {
  initials: string;
  color: string;
  size?: number;
}

export function TeamAvatar({ initials, color, size = 48 }: TeamAvatarProps) {
  const fontSize = size < 40 ? 12 : 14;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: `${color}66`,
          backgroundColor: `${color}22`
        }
      ]}
    >
      <Text style={[styles.text, { fontSize, color }]} numberOfLines={1}>
        {initials || "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5
  },
  text: {
    fontWeight: "900",
    letterSpacing: 0.5
  }
});
