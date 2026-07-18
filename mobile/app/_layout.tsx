import 'react-native-reanimated';
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ProPaywallModal } from "@/components/access/ProPaywallModal";
import { GuestAdPreviewModal } from "@/components/access/GuestAdPreviewModal";
import { AccessFlowProvider } from "@/contexts/AccessFlowContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { GuestPreviewProvider } from "@/contexts/GuestPreviewContext";
import { colors } from "@/lib/theme";

export { ErrorBoundary } from "expo-router";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surfaceAlt,
    border: colors.border,
    primary: colors.cyan,
    text: colors.text
  }
};

function RootNavigation({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const splashHiddenRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (session && onLogin) {
      router.replace("/");
    }
  }, [session, loading, segments, router]);

  useEffect(() => {
    if (loading || splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.cyan} size="large" />
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <GuestPreviewProvider>
        <AccessFlowProvider>
          <EntitlementsProvider>
            <ThemeProvider value={navTheme}>
              <RootNavigation>
                <StatusBar style="light" />
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="login"
                    options={{
                      title: "Accedi",
                      presentation: "modal",
                      headerStyle: { backgroundColor: colors.surfaceAlt },
                      headerTintColor: colors.cyan
                    }}
                  />
                  <Stack.Screen
                    name="match/[eventId]"
                    options={{
                      title: "Analisi partita",
                      headerStyle: { backgroundColor: colors.surfaceAlt },
                      headerTintColor: colors.cyan
                    }}
                  />
                </Stack>
                <ProPaywallModal />
                <GuestAdPreviewModal />
              </RootNavigation>
            </ThemeProvider>
          </EntitlementsProvider>
        </AccessFlowProvider>
      </GuestPreviewProvider>
    </AuthProvider>
  );
}
