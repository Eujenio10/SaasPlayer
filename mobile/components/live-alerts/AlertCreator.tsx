import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { homeColors } from "@/components/home/home-theme";
import { useLocale } from "@/contexts/LocaleContext";
import type { LiveAlertType, LiveHubDetail, LiveStatisticName } from "@/lib/live-alerts/types";
import { spacing } from "@/lib/theme";

const TEAM_EVENTS: LiveStatisticName[] = ["goal_scored", "goal_conceded", "red_card", "penalty"];
const TEAM_STATS: LiveStatisticName[] = ["shots", "shots_on_target", "corners", "fouls", "yellow_cards"];
const PLAYER_EVENTS: LiveStatisticName[] = ["goal", "assist", "card"];
const PLAYER_STATS: LiveStatisticName[] = ["shots", "shots_on_target", "fouls", "fouls_received", "saves"];

const RANGES: Record<string, { min: number; max: number }> = {
  team_shots: { min: 0, max: 30 },
  team_shots_on_target: { min: 0, max: 15 },
  team_corners: { min: 0, max: 15 },
  team_fouls: { min: 0, max: 25 },
  team_yellow_cards: { min: 0, max: 10 },
  player_shots: { min: 0, max: 10 },
  player_shots_on_target: { min: 0, max: 5 },
  player_fouls: { min: 0, max: 10 },
  player_fouls_received: { min: 0, max: 10 },
  player_saves: { min: 0, max: 15 },
  default: { min: 1, max: 5 }
};

const LABEL: Record<LiveStatisticName, string> = {
  goal_scored: "liveAlerts.goalScored",
  goal_conceded: "liveAlerts.goalConceded",
  red_card: "liveAlerts.redCard",
  penalty: "liveAlerts.penalty",
  shots: "liveAlerts.shots",
  shots_on_target: "liveAlerts.shotsOnTarget",
  corners: "liveAlerts.corners",
  fouls: "liveAlerts.fouls",
  yellow_cards: "liveAlerts.yellowCards",
  goal: "liveAlerts.goal",
  assist: "liveAlerts.assist",
  card: "liveAlerts.card",
  fouls_received: "liveAlerts.foulsReceived",
  saves: "liveAlerts.saves"
};

function rangeFor(alertType: LiveAlertType, stat: LiveStatisticName) {
  return RANGES[`${alertType}_${stat}`] ?? RANGES.default;
}

export function AlertCreator({
  detail,
  onSubmit,
  onClose
}: {
  detail: LiveHubDetail;
  onSubmit: (input: {
    alertType: LiveAlertType;
    statisticName: LiveStatisticName;
    targetValue: number;
    teamId?: number | null;
    playerId?: number | null;
    subjectName?: string | null;
  }) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [alertType, setAlertType] = useState<LiveAlertType>("team");
  const [stat, setStat] = useState<LiveStatisticName>("shots");
  const [teamId, setTeamId] = useState<number | null>(detail.match.homeTeamId);
  const [playerId, setPlayerId] = useState<number | null>(detail.players[0]?.playerId ?? null);
  const range = rangeFor(alertType, stat);
  const [target, setTarget] = useState(Math.max(range.min, 1));

  const options = alertType === "team" ? [...TEAM_EVENTS, ...TEAM_STATS] : [...PLAYER_EVENTS, ...PLAYER_STATS];
  const teams = useMemo(
    () =>
      [
        { id: detail.match.homeTeamId, name: detail.match.homeTeamName ?? t("liveAlerts.team") },
        { id: detail.match.awayTeamId, name: detail.match.awayTeamName ?? t("liveAlerts.team") }
      ].filter((row) => row.id),
    [detail.match.awayTeamId, detail.match.awayTeamName, detail.match.homeTeamId, detail.match.homeTeamName, t]
  );

  const pickStat = (next: LiveStatisticName) => {
    setStat(next);
    const nextRange = rangeFor(alertType, next);
    setTarget(Math.max(nextRange.min, Math.min(nextRange.max, target)));
  };

  const subject =
    alertType === "player"
      ? detail.players.find((row) => row.playerId === playerId)?.playerName
      : teams.find((row) => row.id === teamId)?.name;

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>{t("liveAlerts.create")}</Text>
      <Text style={styles.label}>{t("liveAlerts.category")}</Text>
      <View style={styles.row}>
        {(["team", "player"] as const).map((id) => (
          <Pressable key={id} onPress={() => setAlertType(id)} style={[styles.chip, alertType === id && styles.chipOn]}>
            <Text style={[styles.chipText, alertType === id && styles.chipTextOn]}>
              {id === "team" ? t("liveAlerts.team") : t("liveAlerts.player")}
            </Text>
          </Pressable>
        ))}
      </View>

      {alertType === "team" ? (
        <View style={styles.row}>
          {teams.map((team) => (
            <Pressable key={team.id} onPress={() => setTeamId(team.id)} style={[styles.chip, teamId === team.id && styles.chipOn]}>
              <Text style={[styles.chipText, teamId === team.id && styles.chipTextOn]}>{team.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {detail.players.map((player) => (
            <Pressable
              key={player.playerId}
              onPress={() => setPlayerId(player.playerId)}
              style={[styles.chip, playerId === player.playerId && styles.chipOn]}
            >
              <Text style={[styles.chipText, playerId === player.playerId && styles.chipTextOn]}>
                {player.playerName ?? `#${player.playerId}`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Text style={styles.label}>{t("liveAlerts.events")}</Text>
      <View style={styles.wrap}>
        {(alertType === "team" ? TEAM_EVENTS : PLAYER_EVENTS).map((item) => (
          <Pressable key={item} onPress={() => pickStat(item)} style={[styles.chip, stat === item && styles.chipOn]}>
            <Text style={[styles.chipText, stat === item && styles.chipTextOn]}>{t(LABEL[item])}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("liveAlerts.stats")}</Text>
      <View style={styles.wrap}>
        {(alertType === "team" ? TEAM_STATS : PLAYER_STATS).map((item) => (
          <Pressable key={item} onPress={() => pickStat(item)} style={[styles.chip, stat === item && styles.chipOn]}>
            <Text style={[styles.chipText, stat === item && styles.chipTextOn]}>{t(LABEL[item])}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>
        {t("liveAlerts.target")}: {target}
      </Text>
      <View style={styles.slider}>
        <Pressable onPress={() => setTarget((value) => Math.max(range.min, value - 1))} style={styles.step}>
          <Text style={styles.stepText}>-</Text>
        </Pressable>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.max(8, ((target - range.min) / Math.max(1, range.max - range.min)) * 100)}%` }
            ]}
          />
        </View>
        <Pressable onPress={() => setTarget((value) => Math.min(range.max, value + 1))} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() =>
          onSubmit({
            alertType,
            statisticName: options.includes(stat) ? stat : options[0]!,
            targetValue: target,
            teamId: alertType === "team" ? teamId : null,
            playerId: alertType === "player" ? playerId : null,
            subjectName: subject ?? null
          })
        }
        style={styles.save}
      >
        <Text style={styles.saveText}>{t("liveAlerts.save")}</Text>
      </Pressable>
      <Pressable onPress={onClose}>
        <Text style={styles.cancel}>{t("liveAlerts.cancel")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { color: homeColors.text, fontSize: 20, fontWeight: "800" },
  label: { color: homeColors.green, fontSize: 12, fontWeight: "800", textTransform: "uppercase", marginTop: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.cardAlt
  },
  chipOn: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  chipText: { color: homeColors.textMuted, fontSize: 13, fontWeight: "700" },
  chipTextOn: { color: homeColors.ctaText },
  slider: { flexDirection: "row", alignItems: "center", gap: 10 },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeColors.cardAlt,
    borderWidth: 1,
    borderColor: homeColors.border
  },
  stepText: { color: homeColors.green, fontSize: 20, fontWeight: "800" },
  track: { flex: 1, height: 8, borderRadius: 99, backgroundColor: homeColors.cardAlt, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: homeColors.green },
  save: { marginTop: spacing.sm, backgroundColor: homeColors.green, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  saveText: { color: homeColors.ctaText, fontWeight: "800", fontSize: 15 },
  cancel: { color: homeColors.textMuted, textAlign: "center", paddingVertical: 8, fontWeight: "700" }
});
