import 'react-native-reanimated';
import { useEffect, useRef } from "react";
import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { hideSplashSafe, keepSplashVisible } from "@/lib/splash-screen";
import { ProPaywallModal } from "@/components/access/ProPaywallModal";
import { GuestAdPreviewModal } from "@/components/access/GuestAdPreviewModal";
import { AccessFlowProvider } from "@/contexts/AccessFlowContext";
import { AppMenuProvider } from "@/contexts/AppMenuContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { GuestPreviewProvider } from "@/contexts/GuestPreviewContext";
import { LocaleProvider, useLocale } from "@/contexts/LocaleContext";
import { FavoriteTeamProvider } from "@/contexts/FavoriteTeamContext";
import { AppSideMenu } from "@/components/app-menu/AppSideMenu";
import { FavoriteTeamOnboarding } from "@/components/favorite-team/FavoriteTeamOnboarding";
import { ForceUpdateGate } from "@/components/ForceUpdateGate";
import { PushNotificationsBootstrap } from "@/components/notifications/PushNotificationsBootstrap";
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
        name="referees/index"
        options={{ headerShown: false, title: t("referees.title") }}
      />
      <Stack.Screen
        name="your-team/index"
        options={{ headerShown: false, title: t("yourTeam.sectionTitle") }}
      />
      <Stack.Screen name="fanta/index" options={{ headerShown: false, title: t("fanta.title") }} />
      <Stack.Screen name="fanta/scout" options={{ headerShown: false, title: t("fanta.scout") }} />
      <Stack.Screen name="fanta/scout/[playerId]" options={{ headerShown: false, title: t("fanta.scout") }} />
      <Stack.Screen name="fanta/lineup" options={{ headerShown: false, title: t("fanta.lineup") }} />
      <Stack.Screen name="fanta/matchups" options={{ headerShown: false, title: t("fanta.matchup") }} />
      <Stack.Screen name="fanta/matchups/[matchupId]" options={{ headerShown: false, title: t("fanta.matchup") }} />
      <Stack.Screen name="fanta/trends" options={{ headerShown: false, title: t("fanta.trends") }} />
      <Stack.Screen name="fanta/ranking" options={{ headerShown: false, title: t("fanta.ranking") }} />
      <Stack.Screen name="marking/[matchupId]" options={{ headerShown: false, title: t("markings.title") }} />
      <Stack.Screen name="match-radar/index" options={{ headerShown: false }} />
      <Stack.Screen name="match-radar/[matchId]" options={{ headerShown: false }} />
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
        <ForceUpdateGate>
        <FavoriteTeamProvider>
        <GuestPreviewProvider>
          <AccessFlowProvider>
            <EntitlementsProvider>
              <AppMenuProvider>
                <ThemeProvider value={navTheme}>
                  <RootNavigation>
                    <StatusBar style="light" />
                    <LocalizedStack />
                    <AppSideMenu />
                    <FavoriteTeamOnboarding />
                    <ProPaywallModal />
                    <GuestAdPreviewModal />
                    <PushNotificationsBootstrap />
                  </RootNavigation>
                </ThemeProvider>
              </AppMenuProvider>
            </EntitlementsProvider>
          </AccessFlowProvider>
        </GuestPreviewProvider>
        </FavoriteTeamProvider>
        </ForceUpdateGate>
      </LocaleProvider>
    </AuthProvider>
  );
}
