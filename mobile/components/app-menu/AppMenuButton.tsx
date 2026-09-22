import { Pressable, StyleSheet, View } from "react-native";
import { useAppMenu } from "@/contexts/AppMenuContext";
import { useLocale } from "@/contexts/LocaleContext";
import { homeColors } from "@/components/home/home-theme";

export function AppMenuButton() {
  const { openMenu } = useAppMenu();
  const { t } = useLocale();

  return (
    <Pressable
      onPress={openMenu}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("menu.open")}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    marginLeft: -6
  },
  line: {
    height: 2,
    width: 22,
    borderRadius: 1,
    backgroundColor: homeColors.green
  }
});
