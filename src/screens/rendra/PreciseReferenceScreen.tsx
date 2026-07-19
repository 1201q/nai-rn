import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useAppSheet } from "../../context/AppSheetContext";
import {
  RendraAddReferenceButton,
  RendraReferenceDetailLayout,
  RendraReferenceImageCard,
  RendraReferenceUsageNotice,
} from "../../components/rendra/RendraReferenceDetail";
import { RendraParameterSlider } from "../../components/rendra/RendraFormControls";
import {
  MAX_PRECISE_REFERENCES,
  type PreciseReferenceType,
  resolvePreciseReferenceImageUri,
  resolvePreciseReferenceThumbnailUri,
} from "../../lib/preciseReferences";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

const MODES: readonly { label: string; value: PreciseReferenceType }[] = [
  { label: "Both", value: "character&style" },
  { label: "Character", value: "character" },
  { label: "Style", value: "style" },
];

function isSupportedModel(model: string) {
  return (
    model === "nai-diffusion-4-5-full" || model === "nai-diffusion-4-5-curated"
  );
}

function formatValue(value: number) {
  return Number(value.toFixed(2)).toString();
}

function modeLabel(value: PreciseReferenceType) {
  return MODES.find((item) => item.value === value)?.label ?? "Both";
}

function ModeSelector({
  value,
  onPress,
}: {
  value: PreciseReferenceType;
  onPress: () => void;
}) {
  return (
    <View style={styles.modeBlock}>
      <Text style={styles.controlLabel}>Mode</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mode, ${modeLabel(value)}`}
        accessibilityHint="Mode 선택 바텀시트 열기"
        onPress={onPress}
        style={({ pressed }) => [
          styles.modeSelector,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.modeValue}>{modeLabel(value)}</Text>
        <Ionicons
          name="chevron-forward"
          size={17}
          color={tokens.color.textMuted}
        />
      </Pressable>
    </View>
  );
}

export function PreciseReferenceScreen() {
  const { openPreciseMode } = useAppSheet();
  const references = useGenerationStore((state) => state.preciseReferences);
  const model = useGenerationStore((state) => state.model);
  const activeVibeCount = useGenerationStore(
    (state) => state.vibeReferences.filter((item) => item.enabled).length,
  );
  const addReference = useGenerationStore((state) => state.addPreciseReference);
  const replaceReference = useGenerationStore(
    (state) => state.replacePreciseReference,
  );
  const removeReference = useGenerationStore(
    (state) => state.removePreciseReference,
  );
  const setEnabled = useGenerationStore(
    (state) => state.setPreciseReferenceEnabled,
  );
  const setStrength = useGenerationStore(
    (state) => state.setPreciseReferenceStrength,
  );
  const setFidelity = useGenerationStore(
    (state) => state.setPreciseReferenceFidelity,
  );
  const expandedIds = useGenerationStore(
    (state) => state.preciseReferenceExpandedIds,
  );
  const setExpandedIds = useGenerationStore(
    (state) => state.setPreciseReferenceExpandedIds,
  );
  const setMessage = useGenerationStore((state) => state.setMessage);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const modelSupported = isSupportedModel(model);
  const enabled = references.some((item) => item.enabled);
  const canAdd = references.length < MAX_PRECISE_REFERENCES;
  const enableBlocked = activeVibeCount > 0 || !modelSupported;

  async function pickImage(targetId?: string) {
    if (adding || busyId) return;
    if (!targetId && !modelSupported) {
      setMessage("Precise Reference는 V4.5 모델에서 사용할 수 있습니다.");
      return;
    }
    if (!targetId && activeVibeCount > 0) {
      setMessage(
        "Precise Reference는 Vibe Transfer와 함께 사용할 수 없습니다.",
      );
      return;
    }

    try {
      if (targetId) setBusyId(targetId);
      else setAdding(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      const input = {
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      };
      const reference = targetId
        ? await replaceReference(targetId, input)
        : await addReference(input);
      if (!reference) return;

      const current = useGenerationStore.getState().preciseReferenceExpandedIds;
      setExpandedIds(
        current.includes(reference.id) ? current : [...current, reference.id],
      );
    } catch {
      setMessage("Precise Reference 이미지를 선택하지 못했습니다.");
    } finally {
      setAdding(false);
      setBusyId(null);
    }
  }

  function toggleAll(value: boolean) {
    if (value && references.length === 0) {
      setMessage("Precise Reference 이미지를 먼저 추가해 주세요.");
      return;
    }
    if (value && !modelSupported) {
      setMessage("Precise Reference는 V4.5 모델에서 사용할 수 있습니다.");
      return;
    }
    if (value && activeVibeCount > 0) {
      setMessage(
        "Precise Reference는 Vibe Transfer와 함께 사용할 수 없습니다.",
      );
      return;
    }
    references.forEach((reference) => {
      if (reference.enabled !== value) setEnabled(reference.id, value);
    });
  }

  function toggleExpanded(id: string) {
    const current = useGenerationStore.getState().preciseReferenceExpandedIds;
    setExpandedIds(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <RendraReferenceDetailLayout
      title="Precise Reference"
      enabled={enabled}
      unavailableReason={
        activeVibeCount > 0
          ? "Vibe Transfer와 동시에 켤 수 없습니다."
          : undefined
      }
      onToggle={toggleAll}
    >
      <Text style={styles.sectionTitle}>
        Reference Images ({references.length})
      </Text>
      <View style={styles.cards}>
        {references.map((reference, index) => {
          const imageUri = resolvePreciseReferenceImageUri(reference);
          const thumbnailUri =
            resolvePreciseReferenceThumbnailUri(reference) ?? imageUri;
          return (
            <RendraReferenceImageCard
              key={reference.id}
              index={index}
              imageUri={imageUri}
              thumbnailUri={thumbnailUri}
              subtitle={`${modeLabel(reference.referenceType)} · F ${formatValue(reference.fidelity)} · S ${formatValue(reference.strength)}`}
              status={
                reference.enabled
                  ? { label: "5 Anlas", tone: "cost" }
                  : undefined
              }
              enabled={reference.enabled}
              expanded={expandedIds.includes(reference.id)}
              busy={busyId === reference.id}
              enableDisabled={enableBlocked}
              onToggleExpanded={() => toggleExpanded(reference.id)}
              onToggleEnabled={(value) => setEnabled(reference.id, value)}
              onReplace={() => void pickImage(reference.id)}
              onRemove={() => void removeReference(reference.id)}
            >
              <ModeSelector
                value={reference.referenceType}
                onPress={() => openPreciseMode(reference.id)}
              />
              <RendraParameterSlider
                label="Fidelity"
                value={reference.fidelity}
                min={0}
                max={1}
                step={0.01}
                precision={2}
                onChange={(value) => setFidelity(reference.id, value)}
              />
              <RendraParameterSlider
                label="Strength"
                value={reference.strength}
                min={0}
                max={1}
                step={0.01}
                precision={2}
                onChange={(value) => setStrength(reference.id, value)}
              />
              {reference.enabled ? (
                <RendraReferenceUsageNotice
                  tone="cost"
                  title="5 Anlas per generation"
                  description="활성화된 Precise Reference는 생성할 때마다 5 Anlas를 사용합니다."
                />
              ) : null}
            </RendraReferenceImageCard>
          );
        })}
      </View>

      <RendraAddReferenceButton
        disabled={!canAdd}
        busy={adding}
        onPress={() => void pickImage()}
      />
    </RendraReferenceDetailLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type["3xs"],
    letterSpacing: tokens.tracking.wide,
  },
  cards: {
    gap: 12,
    marginBottom: 12,
  },
  modeBlock: {
    gap: 10,
  },
  controlLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.base,
  },
  modeSelector: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    backgroundColor: tokens.color.sunken,
  },
  modeValue: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  pressed: {
    opacity: 0.68,
  },
});
