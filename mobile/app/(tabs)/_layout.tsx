import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceAlt },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: "#060D18",
          borderTopColor: "rgba(103,232,249,0.12)",
          height: 62,
          paddingTop: 6,
          paddingBottom: 8
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700"
        },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textDim
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Analisi Partita",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="football" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="markings"
        options={{
          title: "Marcature",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-half-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: "Trend",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          title: "Simulatore",
          headerShown: false,
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
          title: "Profilo",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
