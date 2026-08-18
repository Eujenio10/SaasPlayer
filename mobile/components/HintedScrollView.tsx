import { type ReactNode, useCallback, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View
} from "react-native";
import { SCROLL_MORE_HINT_LABEL, ScrollMoreHint } from "@/components/ScrollMoreHint";

const OVERFLOW_PX = 40;

export function HintedScrollView({
  children,
  hint = SCROLL_MORE_HINT_LABEL,
  onScroll,
  onContentSizeChange,
  style,
  ...rest
}: ScrollViewProps & { children?: ReactNode; hint?: string }) {
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const remaining = contentH - viewportH - offsetY;
  const showHint = contentH > viewportH + OVERFLOW_PX && remaining > OVERFLOW_PX;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setOffsetY(event.nativeEvent.contentOffset.y);
      onScroll?.(event);
    },
    [onScroll]
  );

  return (
    <View
      style={[styles.host, style]}
      onLayout={(event) => setViewportH(event.nativeEvent.layout.height)}
    >
      <ScrollView
        {...rest}
        style={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={rest.scrollEventThrottle ?? 16}
        onContentSizeChange={(width, height) => {
          setContentH(height);
          onContentSizeChange?.(width, height);
        }}
      >
        {children}
      </ScrollView>
      {showHint ? (
        <View style={styles.overlay} pointerEvents="none">
          <ScrollMoreHint compact label={hint} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0
  },
  scroll: {
    flex: 1
  },
  overlay: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8
  }
});
