import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { homeColors } from "@/components/home/home-theme";
import { useAppMenu } from "@/contexts/AppMenuContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { canViewDifficultMarkings } from "@/lib/difficult-markings/visibility";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";
import { spacing } from "@/lib/theme";

type MenuIcon = keyof typeof Ionicons.glyphMap;

interface MenuItem {
  key: string;
  href: Href;
  icon: MenuIcon;
  titleKey: string;
}

export function AppSideMenu() {
  const { open, closeMenu } = useAppMenu();
  const { t } = useLocale();
  const { access } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.82));
  const slide = useRef(new Animated.Value(0)).current;

  const items = useMemo<MenuItem[]>(() => {
    const next: MenuItem[] = [
      { key: "home", href: "/", icon: "home-outline", titleKey: "menu.home" },
      { key: "yourTeam", href: "/your-team" as Href, icon: "shirt-outline", titleKey: "menu.yourTeam" },
      { key: "matches", href: "/matches", icon: "football-outline", titleKey: "menu.matches" },
      { key: "live", href: "/live" as Href, icon: "notifications-outline", titleKey: "menu.live" }
    ];
    if (canViewDifficultMarkings(access)) {
      next.push({
        key: "markings",
        href: "/markings",
        icon: "shield-half-outline",
        titleKey: "menu.markings"
      });
    }
    next.push({ key: "trends", href: "/trends", icon: "trending-up-outline", titleKey: "menu.trends" });
    if (MATCH_SIMULATOR_ENABLED) {
      next.push({
        key: "simulator",
        href: "/simulator",
        icon: "analytics-outline",
        titleKey: "menu.simulator"
      });
    }
    next.push(
      { key: "referees", href: "/referees" as Href, icon: "flag-outline", titleKey: "menu.referees" },
      { key: "fanta", href: "/fanta" as Href, icon: "flash-outline", titleKey: "menu.fanta" },
      { key: "profile", href: "/profile", icon: "person-outline", titleKey: "menu.profile" }
    );
    return next;
  }, [access]);

  useEffect(() => {
    if (!open) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [open, slide]);

  const go = (href: Href) => {
    closeMenu();
    router.push(href);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={closeMenu}
          accessibilityRole="button"
          accessibilityLabel={t("menu.close")}
        />
        <Animated.View
          style={[
            styles.panelWrap,
            {
              width: panelWidth,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-panelWidth, 0]
                  })
                }
              ]
            }
          ]}
        >
          <SafeAreaView style={styles.panel} edges={["top", "bottom", "left"]}>
            <View style={styles.header}>
              <Text style={styles.brand} accessibilityRole="header">
                <Text style={styles.pitch}>Pitch</Text>
                <Text style={styles.brain}>Brain</Text>
              </Text>
              <Pressable
                onPress={closeMenu}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("menu.close")}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
              >
                <Ionicons name="close" size={22} color={homeColors.text} />
              </Pressable>
            </View>
            <Text style={styles.section}>{t("menu.title")}</Text>
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => go(item.href)}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.titleKey)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name={item.icon} size={20} color={homeColors.green} />
                  </View>
                  <Text style={styles.itemLabel}>{t(item.titleKey)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={homeColors.textMuted} />
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row"
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  panelWrap: {
    height: "100%",
    backgroundColor: homeColors.bg,
    borderRightWidth: 1,
    borderRightColor: homeColors.borderStrong,
    zIndex: 2
  },
  panel: {
    flex: 1,
    backgroundColor: homeColors.bg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  brand: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  pitch: {
    color: homeColors.textPitch
  },
  brain: {
    color: homeColors.green
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  section: {
    color: homeColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm
  },
  list: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
    gap: 4
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14
  },
  itemPressed: {
    backgroundColor: "rgba(23,53,26,0.55)"
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card
  },
  itemLabel: {
    flex: 1,
    color: homeColors.text,
    fontSize: 16,
    fontWeight: "700"
  }
});
