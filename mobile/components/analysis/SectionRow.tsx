import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { analysisColors } from "@/components/analysis/analysis-theme";

export function SectionRow({
  title,
  description,
  expanded,
  onPress,
  children
}: {
  title: string;
  description: string;
  expanded: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.wrap, expanded && styles.wrapOpen]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={18}
          color={analysisColors.green}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    overflow: "hidden"
  },
  wrapOpen: {
    borderColor: analysisColors.borderStrong,
    shadowColor: analysisColors.green,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  title: {
    color: analysisColors.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  description: {
    color: analysisColors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 14
  }
});
