import { useEffect, useState } from "react";
import { FavoriteTeamPickerModal } from "@/components/favorite-team/FavoriteTeamPickerModal";
import { useFavoriteTeam } from "@/contexts/FavoriteTeamContext";
import { subscribeHomeCatalogSettled } from "@/lib/home-dashboard/catalog-boot";
import { useSegments } from "expo-router";

export function FavoriteTeamOnboarding() {
  const segments = useSegments();
  const { ready, onboardingCompleted } = useFavoriteTeam();
  const [homeSettled, setHomeSettled] = useState(false);

  useEffect(() => {
    const unsub = subscribeHomeCatalogSettled(() => setHomeSettled(true));
    const timer = setTimeout(() => setHomeSettled(true), 20_000);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  if (!ready || !homeSettled || onboardingCompleted) return null;
  if (segments[0] === "login" || segments[0] === "auth") return null;
  return <FavoriteTeamPickerModal visible onboarding onClose={() => undefined} />;
}
