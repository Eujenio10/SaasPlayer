import 'react-native-reanimated';
import { useEffect, useRef } from "react";
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
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

export { ErrorBoundary } from "expo-router";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: pitchbrainColors.bg,
    card: pitchbrainColors.card,
    border: pitchbrainColors.border,
    primary: pitchbrainColors.green,
    text: pitchbrainColors.text
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (splashHiddenRef.current) return;
      splashHiddenRef.current = true;
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 2_500);
    return () => clearTimeout(timer);
  }, []);

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
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false, title: "Analisi Partita" }}
                  />
                  <Stack.Screen
                    name="login"
                    options={{
                      title: "Account",
                      presentation: "modal",
                      headerStyle: { backgroundColor: pitchbrainColors.bg },
                      headerTintColor: pitchbrainColors.green,
                      headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800" },
                      headerShadowVisible: false,
                      contentStyle: { backgroundColor: pitchbrainColors.bg }
                    }}
                  />
                  <Stack.Screen
                    name="auth/callback"
                    options={{ headerShown: false, animation: "fade" }}
                  />
                  <Stack.Screen
                    name="auth/reset-password"
                    options={{
                      title: "Nuova password",
                      headerStyle: { backgroundColor: pitchbrainColors.bg },
                      headerTintColor: pitchbrainColors.green,
                      headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800" },
                      headerShadowVisible: false,
                      contentStyle: { backgroundColor: pitchbrainColors.bg }
                    }}
                  />
                  <Stack.Screen
                    name="match/[eventId]"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="simulator/[eventId]"
                    options={{ headerShown: false, title: "Simulatore match" }}
                  />
                  <Stack.Screen
                    name="match-radar/index"
                    options={{
                      title: "Match Radar",
                      headerStyle: { backgroundColor: pitchbrainColors.bg },
                      headerTintColor: pitchbrainColors.green,
                      headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800" },
                      headerShadowVisible: false,
                      contentStyle: { backgroundColor: pitchbrainColors.bg }
                    }}
                  />
                  <Stack.Screen
                    name="match-radar/[matchId]"
                    options={{ headerShown: false, title: "Match Radar" }}
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
