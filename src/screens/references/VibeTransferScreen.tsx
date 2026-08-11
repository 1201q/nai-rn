import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";

import {
  ReferenceDetailLayout,
  ReferenceImageCard,
  ReferenceUsageNotice,
} from "../../components/references/ReferenceDetail";
import { ParameterSlider, Toggle } from "../../components/forms/FormControls";
import {
  MAX_VIBE_REFERENCES,
  canUseCachedVibeEncoding,
  resolveVibeReferenceImageUri,
  resolveVibeReferenceThumbnailUri,
} from "../../lib/vibeReferences";
import { useGenerationStore } from "../../store/generationStore";
import { tokens } from "../../styles/tokens";

function formatValue(value: number) {
  return Number(value.toFixed(2)).toString();
}

export function VibeTransferScreen() {
  const references = useGenerationStore((state) => state.vibeReferences);
  const activePreciseCount = useGenerationStore(
    (state) => state.preciseReferences.filter((item) => item.enabled).length,
  );
  const normalize = useGenerationStore((state) => state.normalizeVibeStrengths);
  const setNormalize = useGenerationStore(
    (state) => state.setNormalizeVibeStrengths,
  );
  const addReference = useGenerationStore((state) => state.addVibeReference);
  const removeReference = useGenerationStore(
    (state) => state.removeVibeReference,
  );
  const setEnabled = useGenerationStore(
    (state) => state.setVibeReferenceEnabled,
  );
  const setAllEnabled = useGenerationStore(
    (state) => state.setVibeReferencesEnabled,
  );
  const setStrength = useGenerationStore(
    (state) => state.setVibeReferenceStrength,
  );
  const setInformation = useGenerationStore(
    (state) => state.setVibeReferenceInformationExtracted,
  );
  const expandedIds = useGenerationStore(
    (state) => state.vibeReferenceExpandedIds,
  );
  const setExpandedIds = useGenerationStore(
    (state) => state.setVibeReferenceExpandedIds,
  );
  const setMessage = useGenerationStore((state) => state.setMessage);
  const [adding, setAdding] = useState(false);

  const enabled = references.some((item) => item.enabled);
  const canAdd = references.length < MAX_VIBE_REFERENCES;

  async function pickImage() {
    if (adding) return;
    if (activePreciseCount > 0) {
      setMessage(
        "Vibe Transfer는 Precise Reference와 함께 사용할 수 없습니다.",
      );
      return;
    }

    try {
      setAdding(true);

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
      const reference = await addReference(input);
      if (!reference) return;

      const current = useGenerationStore.getState().vibeReferenceExpandedIds;
      setExpandedIds(
        current.includes(reference.id) ? current : [...current, reference.id],
      );
      toast.success("Vibe 이미지를 추가했습니다.");
    } catch {
      setMessage("Vibe 이미지를 선택하지 못했습니다.");
    } finally {
      setAdding(false);
    }
  }

  function toggleAll(value: boolean) {
    if (value && references.length === 0) {
      setMessage("Vibe 이미지를 먼저 추가해 주세요.");
      return;
    }
    if (value && activePreciseCount > 0) {
      setMessage(
        "Vibe Transfer는 Precise Reference와 함께 사용할 수 없습니다.",
      );
      return;
    }
    setAllEnabled(value);
  }

  async function handleRemove(id: string) {
    await removeReference(id);
    const removed = !useGenerationStore
      .getState()
      .vibeReferences.some((reference) => reference.id === id);
    if (removed) toast.success("Vibe 이미지를 삭제했습니다.");
  }

  function toggleExpanded(id: string) {
    const current = useGenerationStore.getState().vibeReferenceExpandedIds;
    setExpandedIds(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <ReferenceDetailLayout
      title="Vibe Transfer"
      enabled={enabled}
      unavailableReason={
        activePreciseCount > 0
          ? "Precise Reference와 동시에 켤 수 없습니다."
          : undefined
      }
      onToggle={toggleAll}
      onAdd={() => void pickImage()}
      addDisabled={!canAdd || adding}
    >
      <View style={styles.normalizeCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Normalize Reference Strength Values"
          onPress={() => setNormalize(!normalize)}
          style={({ pressed }) => [
            styles.normalizeCopy,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.normalizeTitle}>
            Normalize Reference Strength Values
          </Text>
          <Text style={styles.normalizeDescription}>
            이미지 개수와 무관하게 전체 강도 합이 일정하게 유지되도록 값을
            재조정합니다
          </Text>
        </Pressable>
        <Toggle
          value={normalize}
          label="Normalize Reference Strength Values"
          onChange={setNormalize}
        />
      </View>

      <Text style={styles.sectionTitle}>
        이미지 ({references.length})
      </Text>
      <View style={styles.cards}>
        {references.map((reference, index) => {
          const imageUri = resolveVibeReferenceImageUri(reference);
          const thumbnailUri =
            resolveVibeReferenceThumbnailUri(reference) ?? imageUri;
          const cached = canUseCachedVibeEncoding(reference);
          return (
            <ReferenceImageCard
              key={reference.id}
              index={index}
              imageUri={imageUri}
              thumbnailUri={thumbnailUri}
              subtitle={`S ${formatValue(reference.strength)} · I ${formatValue(reference.informationExtracted)}`}
              status={{
                label: cached ? "Cached" : "2 Anlas",
                tone: cached ? "cached" : "cost",
              }}
              enabled={reference.enabled}
              expanded={expandedIds.includes(reference.id)}
              enableDisabled={activePreciseCount > 0}
              onToggleExpanded={() => toggleExpanded(reference.id)}
              onToggleEnabled={(value) => setEnabled(reference.id, value)}
              onRemove={() => void handleRemove(reference.id)}
            >
              <ParameterSlider
                label="Reference Strength"
                value={reference.strength}
                min={0.01}
                max={1}
                step={0.01}
                precision={2}
                onChange={(value) => setStrength(reference.id, value)}
                settingsCard
              />
              <ParameterSlider
                label="Information Extracted"
                value={reference.informationExtracted}
                min={0.01}
                max={1}
                step={0.01}
                precision={2}
                onChange={(value) => setInformation(reference.id, value)}
                settingsCard
              />
              <ReferenceUsageNotice
                tone={cached ? "cached" : "cost"}
                title={cached ? "Encoded vibe cached" : "2 Anlas"}
                description={
                  cached
                    ? "현재 Information Extracted 값의 인코딩 캐시를 사용합니다."
                    : "활성화한 다음 생성에서 Vibe 인코딩에 2 Anlas가 사용됩니다."
                }
              />
            </ReferenceImageCard>
          );
        })}
      </View>

    </ReferenceDetailLayout>
  );
}

const styles = StyleSheet.create({
  normalizeCard: {
    minHeight: 76,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: tokens.radius["2xl"],
    backgroundColor: tokens.color.card,
  },
  normalizeCopy: {
    flex: 1,
    minWidth: 0,
  },
  normalizeTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: 17,
    lineHeight: 22,
  },
  normalizeDescription: {
    marginTop: 4,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.bold,
    fontSize: tokens.type.xs,
    letterSpacing: tokens.tracking.wide,
  },
  cards: {
    gap: 12,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.68,
  },
});
