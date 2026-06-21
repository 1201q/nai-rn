import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";

import { renderPromptHighlights } from "../../components/highlightPromptSpans";
import { MODELS, NOISE_SCHEDULES, SAMPLERS } from "../../constants/generation";
import type { GenerationRecord } from "../../lib/generationHistory";
import { parseNaiMetadata, type ParsedNaiMetadata } from "../../lib/naiMetadata";
import { BaseSheet } from "./BaseSheet";
import { light, styles as homeStyles } from "./styles";

export type MetadataSheetHandle = {
  open: (record: GenerationRecord) => void;
  close: () => void;
  // 열려있으면 닫고 true 반환 (Modal 내부 onRequestClose 가로채기용).
  requestCloseIfOpen: () => boolean;
};

function labelFor(
  list: ReadonlyArray<{ label: string; value: string }>,
  value: string | undefined,
) {
  if (!value) return value;
  return list.find((item) => item.value === value)?.label ?? value;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={ms.card}>
      <Text style={ms.cardLabel}>{label}</Text>
      <Text style={ms.cardInput}>{renderPromptHighlights(value)}</Text>
    </View>
  );
}

export const MetadataSheet = forwardRef<MetadataSheetHandle>(
  function MetadataSheet(_props, ref) {
    const sheetRef = useRef<BottomSheet>(null);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const openRef = useRef(false);
    const pendingExpandRef = useRef(false);
    const { height } = useWindowDimensions();
    const [record, setRecord] = useState<GenerationRecord | null>(null);
    // open() 마다 증가 → 컨텐츠 remount 키. onLayout 발화를 보장한다.
    const [openSeq, setOpenSeq] = useState(0);

    // 새 record 컨텐츠 레이아웃 완료 신호. 측정이 gorhom 에 반영되도록 한 프레임
    // 양보한 뒤 펼친다 (이중 측정 방지). pendingExpandRef 로 open 당 1회만.
    const handleContentLayout = useCallback(() => {
      if (!pendingExpandRef.current) return;
      pendingExpandRef.current = false;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        sheetRef.current?.expand();
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        open: (next) => {
          setRecord(next);
          // expand 는 open() 에서 직접 호출하지 않는다. openSeq 를 올려 컨텐츠를
          // remount → 새 record 가 레이아웃된 뒤 onLayout 에서 측정 완료 시점에
          // 펼친다 (blind rAF 의 "작게 열렸다 커짐" 이중 측정 깜빡임 제거).
          pendingExpandRef.current = true;
          setOpenSeq((n) => n + 1);
        },
        close: () => sheetRef.current?.close(),
        requestCloseIfOpen: () => {
          if (!openRef.current) return false;
          sheetRef.current?.close();
          return true;
        },
      }),
      [],
    );

    // 안드로이드 하드웨어 백: 시트 열려있으면 닫음 (Modal 밖 = 메인페이지 경로).
    useEffect(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!openRef.current) return false;
        sheetRef.current?.close();
        return true;
      });
      return () => sub.remove();
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      [],
    );

    const parsed = useMemo<ParsedNaiMetadata | null>(() => {
      if (!record) return null;
      try {
        const raw = JSON.parse(record.metadataJson) as Record<string, string>;
        return parseNaiMetadata(raw);
      } catch {
        return null;
      }
    }, [record]);

    const settingRows = useMemo(() => {
      if (!parsed) return [];
      const rows: { label: string; value: string }[] = [];
      if (parsed.model) {
        rows.push({ label: "Model", value: labelFor(MODELS, parsed.model)! });
      }
      if (parsed.resolution) {
        rows.push({
          label: "Resolution",
          value: `${parsed.resolution.width} × ${parsed.resolution.height}`,
        });
      }
      if (parsed.steps !== undefined) {
        rows.push({ label: "Steps", value: String(parsed.steps) });
      }
      if (parsed.promptGuidance !== undefined) {
        rows.push({
          label: "Prompt Guidance",
          value: String(parsed.promptGuidance),
        });
      }
      if (parsed.promptGuidanceRescale !== undefined) {
        rows.push({
          label: "Prompt Guidance Rescale",
          value: String(parsed.promptGuidanceRescale),
        });
      }
      if (parsed.noiseSchedule) {
        rows.push({
          label: "Noise Schedule",
          value: labelFor(NOISE_SCHEDULES, parsed.noiseSchedule)!,
        });
      }
      if (parsed.sampler) {
        rows.push({
          label: "Sampler",
          value: labelFor(SAMPLERS, parsed.sampler)!,
        });
      }
      if (parsed.varietyPlus !== undefined) {
        rows.push({
          label: "Variety+",
          value: parsed.varietyPlus ? "켜짐" : "꺼짐",
        });
      }
      if (parsed.seed !== undefined) {
        rows.push({ label: "Seed", value: String(parsed.seed) });
      }
      return rows;
    }, [parsed]);

    const hasPrompts = Boolean(
      parsed &&
        (parsed.prompt ||
          parsed.negativePrompt ||
          (parsed.characters && parsed.characters.length > 0)),
    );
    const isEmpty = !parsed || (!hasPrompts && settingRows.length === 0);

    return (
      <BaseSheet
        sheetRef={sheetRef}
        scrollRef={scrollRef}
        sheetKey="metadata"
        onSheetChange={(_key, index) => {
          openRef.current = index >= 0;
        }}
        renderBackdrop={renderBackdrop}
        enableDynamicSizing
        maxDynamicContentSize={height * 0.9}
        stickyHeaderIndices={[0]}
      >
        <View style={ms.stickyHeader}>
          <Text style={homeStyles.sheetTitle}>메타데이터</Text>
        </View>

        <View key={openSeq} onLayout={handleContentLayout}>
          {isEmpty ? (
            <Text style={ms.emptyText}>메타데이터가 없습니다.</Text>
          ) : (
            <>
              {hasPrompts ? (
                <View style={ms.section}>
                  <Text style={ms.sectionLabel}>프롬프트</Text>
                  {parsed!.prompt ? (
                    <Field label="Prompt" value={parsed!.prompt} />
                  ) : null}
                  {parsed!.negativePrompt ? (
                    <Field
                      label="Undesired Content (UC)"
                      value={parsed!.negativePrompt}
                    />
                  ) : null}
                  {parsed!.characters?.map((character, index) => (
                    <View key={character.id} style={ms.character}>
                      <Text style={ms.characterLabel}>캐릭터 {index + 1}</Text>
                      {character.prompt ? (
                        <Field label="Prompt" value={character.prompt} />
                      ) : null}
                      {character.negativePrompt ? (
                        <Field label="UC" value={character.negativePrompt} />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {settingRows.length > 0 ? (
                <View style={ms.section}>
                  <Text style={ms.sectionLabel}>설정</Text>
                  {settingRows.map((row) => (
                    <View key={row.label} style={ms.settingRow}>
                      <Text style={ms.settingLabel}>{row.label}</Text>
                      <Text style={ms.settingValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      </BaseSheet>
    );
  },
);

const ms = StyleSheet.create({
  stickyHeader: {
    backgroundColor: light.bg,
  },
  emptyText: {
    paddingVertical: 24,
    textAlign: "center",
    color: light.textHint,
    fontSize: 15,
    fontWeight: "500",
  },
  section: {
    marginTop: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    color: light.purple,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.input,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13,
    color: light.textSecondary,
  },
  cardInput: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    color: light.textPrimary,
    padding: 0,
  },
  character: {
    marginTop: 4,
  },
  characterLabel: {
    color: light.textHint,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  settingLabel: {
    color: light.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  settingValue: {
    flexShrink: 1,
    textAlign: "right",
    color: light.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
});
