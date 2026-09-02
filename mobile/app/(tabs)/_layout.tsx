import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notifyAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { useAuth } from "@/contexts/AuthContext";
import { canViewDifficultMarkings } from "@/lib/difficult-markings/visibility";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";
import { colors } from "@/lib/theme";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { useRefetchOnAppActive } from "@/lib/use-refetch-on-app-active";
import { useLocale } from "@/contexts/LocaleContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { access } = useAuth();
  const showMarkings = canViewDifficultMarkings(access);
  useRefetchOnAppActive(() => notifyAdminCatalogRefresh());
  const tabBarBottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceAlt },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: "#020704",
          borderTopColor: "rgba(124,255,58,0.18)",
          height: 52 + tabBarBottom,
          paddingTop: 6,
          paddingBottom: tabBarBottom
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700"
        },
        tabBarActiveTintColor: "#7CFF3A",
        tabBarInactiveTintColor: "#8B9690"
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t("tabs.analysis"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="football" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="markings"
        options={{
          title: t("tabs.markings"),
          headerShown: false,
          href: showMarkings ? "/markings" : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-half-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: t("tabs.trends"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          title: t("tabs.simulator"),
          headerShown: false,
          href: MATCH_SIMULATOR_ENABLED ? "/simulator" : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: pitchbrainColors.bg },
          headerTintColor: pitchbrainColors.text,
          headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800", fontSize: 17 },
          headerShadowVisible: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
