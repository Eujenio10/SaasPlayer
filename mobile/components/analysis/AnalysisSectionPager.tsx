import { ReactNode, useCallback, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { HintedScrollView } from "@/components/HintedScrollView";
import { colors, radii, spacing } from "@/lib/theme";

export type AnalysisSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function AnalysisSectionPager({
  sections,
  disclaimer
}: {
  sections: AnalysisSection[];
  disclaimer?: string;
}) {
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);

  const onPagerScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.min(Math.max(next, 0), sections.length - 1));
    },
    [pageWidth, sections.length]
  );

  if (!sections.length) return null;

  return (
    <View style={styles.root}>
      {disclaimer ? <Text style={styles.disclaimer}>{disclaimer}</Text> : null}

      <View
        style={styles.pagerHost}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width > 0 && width !== pageWidth) setPageWidth(width);
        }}
      >
        {pageWidth > 0 ? (
          <ScrollView
            horizontal
            style={styles.pager}
            contentContainerStyle={styles.pagerContent}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onPagerScroll}
            nestedScrollEnabled
          >
            {sections.map((section) => (
              <View key={section.id} style={[styles.page, { width: pageWidth }]}>
                <View style={styles.pageCard}>
                  <Text style={styles.pageTitle}>{section.title}</Text>
                  <HintedScrollView
                    style={styles.pageBody}
                    contentContainerStyle={styles.pageBodyContent}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    hint="Scorri in basso per vedere altro"
                  >
                    {section.content}
                  </HintedScrollView>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {sections.map((section, index) => (
            <View
              key={section.id}
              style={[styles.dot, index === pageIndex && styles.dotActive]}
            />
          ))}
        </View>
        <Text style={styles.footerHint}>
          {pageIndex + 1}/{sections.length} · scorri a destra per le altre sezioni
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.sm
  },
  disclaimer: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center"
  },
  pagerHost: {
    flex: 1,
    minHeight: 280
  },
  pager: { flex: 1 },
  pagerContent: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  page: {
    flexShrink: 0,
    paddingRight: spacing.xs
  },
  pageCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm
  },
  pageTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  pageBody: { flex: 1 },
  pageBodyContent: {
    paddingBottom: spacing.sm,
    gap: spacing.sm
  },
  footer: {
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: spacing.xs
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)"
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.cyan
  },
  footerHint: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "600"
  }
});
