import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  GENERATION_SHEET_HEADER_HEIGHT,
  SHEET_HANDLE_HEIGHT,
  useGenerationChromeMetrics,
} from "../../../../hooks/useGenerationChromeMetrics";
import { useBackHandler } from "../../../../native/useBackHandler";
import { tokens } from "../../../../styles/tokens";
import { PressableSurface } from "../SheetLayers";
import { MetadataImportContent } from "./MetadataImportContent";
import {
  MetadataSheetContent,
  type MetadataSheetSource,
} from "./MetadataSheetContent";

// Metadata를 먼저 보여주고, 하단 버튼으로 Import 화면에 들어간다.
export const MetadataSheet = memo(function MetadataSheet({
  generation,
  onClose,
}: {
  generation: MetadataSheetSource;
  onClose: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const openImport = useCallback(() => setImporting(true), []);
  const closeImport = useCallback(() => setImporting(false), []);
  const title = importing ? "Import" : "Metadata";
  // gorhom 콘텐츠 영역은 over-drag 여백만큼 화면 아래로 더 길다.
  // 하단 버튼이 보이는 영역 기준으로 놓이도록 실제 보이는 높이를 직접 준다.
  const { height: windowHeight } = useWindowDimensions();
  const { utilitySheetTop } = useGenerationChromeMetrics();
  const visibleHeight = Math.max(
    0,
    windowHeight - utilitySheetTop - SHEET_HANDLE_HEIGHT,
  );

  // Import에서의 뒤로가기는 시트를 닫지 않고 Metadata로 돌아간다.
  useBackHandler(importing, { onBack: closeImport });

  return (
    <View style={{ height: visibleHeight }}>
      <View style={styles.header}>
        {importing ? (
          <PressableSurface
            accessibilityLabel="Metadata로 돌아가기"
            onPress={closeImport}
            style={styles.backButton}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={tokens.color.textTertiary}
            />
          </PressableSurface>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <PressableSurface
          accessibilityLabel="Metadata 닫기"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={20} color={tokens.color.textPrimary} />
        </PressableSurface>
      </View>

      {importing ? (
        <MetadataImportContent generation={generation} onImported={onClose} />
      ) : (
        <MetadataSheetContent generation={generation} onImport={openImport} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    height: GENERATION_SHEET_HEADER_HEIGHT,
    paddingLeft: 18,
    paddingRight: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 28,
    height: 38,
    marginLeft: -4,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
});
