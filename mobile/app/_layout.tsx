import 'react-native-reanimated';
import { useEffect, useRef } from "react";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { hideSplashSafe, keepSplashVisible } from "@/lib/splash-screen";
import { ProPaywallModal } from "@/components/access/ProPaywallModal";
import { GuestAdPreviewModal } from "@/components/access/GuestAdPreviewModal";
import { AccessFlowProvider } from "@/contexts/AccessFlowContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { GuestPreviewProvider } from "@/contexts/GuestPreviewContext";
import { LocaleProvider, useLocale } from "@/contexts/LocaleContext";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

export { ErrorBoundary } from "expo-router";

keepSplashVisible();

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

function LocalizedStack() {
  const { t } = useLocale();
  return (
    <Stack>
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false, title: t("matches.title") }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: t("login.title"),
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
          title: t("login.newPassword"),
          headerStyle: { backgroundColor: pitchbrainColors.bg },
          headerTintColor: pitchbrainColors.green,
          headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: pitchbrainColors.bg }
        }}
      />
      <Stack.Screen name="match/[eventId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="simulator/[eventId]"
        options={{ headerShown: false, title: t("simulator.title") }}
      />
      <Stack.Screen
        name="match-radar/index"
        options={{
          title: t("radar.title"),
          headerStyle: { backgroundColor: pitchbrainColors.bg },
          headerTintColor: pitchbrainColors.green,
          headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: pitchbrainColors.bg }
        }}
      />
      <Stack.Screen
        name="match-radar/[matchId]"
        options={{ headerShown: false, title: t("radar.title") }}
      />
    </Stack>
  );
}

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
    hideSplashSafe();
  }, [loading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (splashHiddenRef.current) return;
      splashHiddenRef.current = true;
      hideSplashSafe();
    }, 2_500);
    return () => clearTimeout(timer);
  }, []);

  return children;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocaleProvider>
        <GuestPreviewProvider>
          <AccessFlowProvider>
            <EntitlementsProvider>
              <ThemeProvider value={navTheme}>
                <RootNavigation>
                  <StatusBar style="light" />
                  <LocalizedStack />
                  <ProPaywallModal />
                  <GuestAdPreviewModal />
                </RootNavigation>
              </ThemeProvider>
            </EntitlementsProvider>
          </AccessFlowProvider>
        </GuestPreviewProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}
