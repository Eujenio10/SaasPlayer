import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue
} from "react-native-reanimated";
import { pickLoadingMessage } from "@/lib/loading-messages";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { useDeferredLoading } from "@/lib/use-deferred-loading";

const LOOP_MS = 2800;
const JOKE_INTERVAL_MS = 2000;
const JOKE_FADE_MS = 240;
const SCREEN_FADE_IN_MS = 220;
const SCREEN_FADE_OUT_MS = 200;
const PITCH_W = 220;
const PITCH_H = 142;
const DOT = 5;

type Point = { x: number; y: number };

const PLAYERS: Array<{ enter: Point; rest: Point; mid: Point; conv: Point }> = [
  { enter: { x: -8, y: 71 }, rest: { x: 22, y: 71 }, mid: { x: 30, y: 71 }, conv: { x: 88, y: 71 } },
  { enter: { x: 48, y: -10 }, rest: { x: 58, y: 28 }, mid: { x: 70, y: 36 }, conv: { x: 96, y: 58 } },
  { enter: { x: 48, y: 152 }, rest: { x: 58, y: 114 }, mid: { x: 70, y: 106 }, conv: { x: 96, y: 84 } },
  { enter: { x: 36, y: 40 }, rest: { x: 62, y: 52 }, mid: { x: 78, y: 58 }, conv: { x: 100, y: 66 } },
  { enter: { x: 36, y: 102 }, rest: { x: 62, y: 90 }, mid: { x: 78, y: 84 }, conv: { x: 100, y: 76 } },
  { enter: { x: 110, y: -8 }, rest: { x: 108, y: 44 }, mid: { x: 106, y: 54 }, conv: { x: 108, y: 66 } },
  { enter: { x: 110, y: 150 }, rest: { x: 108, y: 98 }, mid: { x: 106, y: 88 }, conv: { x: 108, y: 76 } },
  { enter: { x: 118, y: 71 }, rest: { x: 116, y: 71 }, mid: { x: 112, y: 71 }, conv: { x: 110, y: 71 } },
  { enter: { x: 228, y: 32 }, rest: { x: 172, y: 40 }, mid: { x: 148, y: 52 }, conv: { x: 128, y: 64 } },
  { enter: { x: 228, y: 110 }, rest: { x: 172, y: 102 }, mid: { x: 148, y: 90 }, conv: { x: 128, y: 78 } }
];

const LINKS: Array<[number, number]> = [
  [0, 7],
  [3, 5],
  [4, 6],
  [5, 8],
  [6, 9]
];

const T = [0, 0.18, 0.43, 0.72, 0.82, 1];

function axis(progress: number, enter: number, rest: number, mid: number, conv: number): number {
  "worklet";
  return interpolate(progress, T, [enter, rest, mid, mid, conv, enter], Extrapolation.CLAMP);
}

function playerOpacity(progress: number): number {
  "worklet";
  return interpolate(progress, [0, 0.1, 0.84, 1], [0, 1, 1, 0.12], Extrapolation.CLAMP);
}

function linkOpacity(progress: number): number {
  "worklet";
  return interpolate(progress, [0, 0.4, 0.48, 0.72, 0.84, 1], [0, 0, 0.38, 0.42, 0.1, 0], Extrapolation.CLAMP);
}

function PlayerDot({
  player,
  progress
}: {
  player: (typeof PLAYERS)[number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: playerOpacity(p),
      transform: [
        { translateX: axis(p, player.enter.x, player.rest.x, player.mid.x, player.conv.x) },
        { translateY: axis(p, player.enter.y, player.rest.y, player.mid.y, player.conv.y) }
      ]
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

function TacticalLink({
  a,
  b,
  progress
}: {
  a: (typeof PLAYERS)[number];
  b: (typeof PLAYERS)[number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const x1 = axis(p, a.enter.x, a.rest.x, a.mid.x, a.conv.x) + DOT / 2;
    const y1 = axis(p, a.enter.y, a.rest.y, a.mid.y, a.conv.y) + DOT / 2;
    const x2 = axis(p, b.enter.x, b.rest.x, b.mid.x, b.conv.x) + DOT / 2;
    const y2 = axis(p, b.enter.y, b.rest.y, b.mid.y, b.conv.y) + DOT / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      opacity: linkOpacity(p),
      width: length,
      left: (x1 + x2) / 2 - length / 2,
      top: (y1 + y2) / 2 - 0.5,
      transform: [{ rotate: `${angle}deg` }]
    };
  });

  return <Animated.View style={[styles.link, style]} />;
}

function ReduceMotionPulse() {
  const pulse = useSharedValue(0.16);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.32, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.pulse, style]} />;
}

function Pulse({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0.76, 0.82, 0.92], [0, 0.42, 0], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(p, [0.76, 0.82, 0.92], [0.45, 1.12, 1.55], Extrapolation.CLAMP)
        }
      ]
    };
  });

  return <Animated.View style={[styles.pulse, style]} />;
}

function PitchGraphic({ reduceMotion }: { reduceMotion: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0.45;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, reduceMotion]);

  return (
    <View style={styles.pitch} accessibilityElementsHidden>
      <View style={styles.halfway} />
      <View style={styles.centerCircle} />
      <View style={styles.centerSpot} />
      <View style={[styles.box, styles.boxLeft]} />
      <View style={[styles.box, styles.boxRight]} />
      <View style={[styles.six, styles.sixLeft]} />
      <View style={[styles.six, styles.sixRight]} />
      {reduceMotion ? (
        <>
          {PLAYERS.map((player, index) => (
            <View
              key={`static-${index}`}
              style={[styles.dot, { left: player.rest.x, top: player.rest.y, opacity: 0.85 }]}
            />
          ))}
          <ReduceMotionPulse />
        </>
      ) : (
        <>
          {LINKS.map(([i, j]) => (
            <TacticalLink key={`${i}-${j}`} a={PLAYERS[i]!} b={PLAYERS[j]!} progress={progress} />
          ))}
          {PLAYERS.map((player, index) => (
            <PlayerDot key={index} player={player} progress={progress} />
          ))}
          <Pulse progress={progress} />
        </>
      )}
    </View>
  );
}

export function PitchBrainLoading({
  visible,
  message = "Analisi in corso…",
  fullscreen = true
}: {
  visible: boolean;
  message?: string;
  fullscreen?: boolean;
}) {
  const shown = useDeferredLoading(visible);
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [joke, setJoke] = useState(() => pickLoadingMessage());
  const jokeRef = useRef(joke);
  const mountedRef = useRef(false);
  const fadeGenRef = useRef(0);
  const screenOpacity = useSharedValue(0);
  const jokeOpacity = useSharedValue(1);

  jokeRef.current = joke;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (shown) {
      fadeGenRef.current += 1;
      if (!mountedRef.current) {
        setJoke(pickLoadingMessage());
        jokeOpacity.value = 1;
        mountedRef.current = true;
        setMounted(true);
      }
      screenOpacity.value = withTiming(1, {
        duration: SCREEN_FADE_IN_MS,
        easing: Easing.out(Easing.quad)
      });
      return;
    }
    if (!mountedRef.current) return;
    const gen = fadeGenRef.current;
    screenOpacity.value = withTiming(
      0,
      { duration: SCREEN_FADE_OUT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (!finished || gen !== fadeGenRef.current) return;
        mountedRef.current = false;
        runOnJS(setMounted)(false);
      }
    );
  }, [shown, screenOpacity, jokeOpacity]);

  useEffect(() => {
    if (!mounted) return;
    const rotateJoke = () => {
      setJoke(pickLoadingMessage(jokeRef.current));
    };
    const id = setInterval(() => {
      jokeOpacity.value = withTiming(0, { duration: JOKE_FADE_MS }, (finished) => {
        if (!finished) return;
        runOnJS(rotateJoke)();
        jokeOpacity.value = withTiming(1, { duration: JOKE_FADE_MS });
      });
    }, JOKE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      cancelAnimation(jokeOpacity);
    };
  }, [mounted, jokeOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const jokeStyle = useAnimatedStyle(() => ({ opacity: jokeOpacity.value }));

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityRole="progressbar"
      accessibilityLabel={`${message} ${joke}`}
      accessibilityState={{ busy: true }}
      style={[fullscreen ? styles.overlay : styles.inline, overlayStyle]}
    >
      <View style={styles.stack}>
        <Text style={styles.brand} accessibilityRole="header">
          <Text style={styles.brandPitch}>Pitch</Text>
          <Text style={styles.brandBrain}>Brain</Text>
        </Text>
        <PitchGraphic reduceMotion={reduceMotion} />
        <Text style={styles.status}>{message}</Text>
        <Animated.Text style={[styles.joke, jokeStyle]} numberOfLines={2}>
          {joke}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const PITCH_LINE = "rgba(154,242,56,0.22)";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: pitchbrainColors.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    paddingHorizontal: 28
  },
  inline: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24
  },
  stack: {
    alignItems: "center",
    gap: 22,
    maxWidth: 320
  },
  brand: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  brandPitch: {
    color: pitchbrainColors.text
  },
  brandBrain: {
    color: pitchbrainColors.green
  },
  pitch: {
    width: PITCH_W,
    height: PITCH_H,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PITCH_LINE,
    backgroundColor: "rgba(9, 24, 14, 0.55)",
    overflow: "hidden"
  },
  halfway: {
    position: "absolute",
    left: PITCH_W / 2,
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: PITCH_LINE
  },
  centerCircle: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PITCH_LINE,
    left: PITCH_W / 2 - 22,
    top: PITCH_H / 2 - 22
  },
  centerSpot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(154,242,56,0.4)",
    left: PITCH_W / 2 - 1.5,
    top: PITCH_H / 2 - 1.5
  },
  box: {
    position: "absolute",
    width: 42,
    top: 28,
    bottom: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PITCH_LINE
  },
  boxLeft: {
    left: 0,
    borderLeftWidth: 0
  },
  boxRight: {
    right: 0,
    borderRightWidth: 0
  },
  six: {
    position: "absolute",
    width: 18,
    top: 48,
    bottom: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(154,242,56,0.16)"
  },
  sixLeft: {
    left: 0,
    borderLeftWidth: 0
  },
  sixRight: {
    right: 0,
    borderRightWidth: 0
  },
  dot: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: pitchbrainColors.green,
    left: 0,
    top: 0
  },
  link: {
    position: "absolute",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(154,242,56,0.38)"
  },
  pulse: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(154,242,56,0.22)",
    left: PITCH_W / 2 - 14,
    top: PITCH_H / 2 - 14
  },
  status: {
    color: pitchbrainColors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  joke: {
    color: pitchbrainColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    minHeight: 38
  }
});
