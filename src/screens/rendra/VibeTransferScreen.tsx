import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import {
  RendraAddReferenceButton,
  RendraReferenceDetailLayout,
  RendraReferenceImageCard,
} from "../../components/rendra/RendraReferenceDetail";
import {
  RendraParameterSlider,
  RendraToggle,
} from "../../components/rendra/RendraFormControls";
import {
  MAX_VIBE_REFERENCES,
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
  const normalize = useGenerationStore(
    (state) => state.normalizeVibeStrengths,
  );
  const setNormalize = useGenerationStore(
    (state) => state.setNormalizeVibeStrengths,
  );
  const addReference = useGenerationStore(
    (state) => state.addVibeReference,
  );
  const replaceReference = useGenerationStore(
    (state) => state.replaceVibeReference,
  );
  const removeReference = useGenerationStore(
    (state) => state.removeVibeReference,
  );
  const setEnabled = useGenerationStore(
    (state) => state.setVibeReferenceEnabled,
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const enabled = references.some((item) => item.enabled);
  const canAdd = references.length < MAX_VIBE_REFERENCES;

  async function pickImage(targetId?: string) {
    if (adding || busyId) return;
    if (!targetId && activePreciseCount > 0) {
      setMessage("Vibe Transfer는 Precise Reference와 함께 사용할 수 없습니다.");
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

      const current =
        useGenerationStore.getState().vibeReferenceExpandedIds;
      setExpandedIds(
        current.includes(reference.id) ? current : [...current, reference.id],
      );
    } catch {
      setMessage("Vibe 이미지를 선택하지 못했습니다.");
    } finally {
      setAdding(false);
      setBusyId(null);
    }
  }

  function toggleAll(value: boolean) {
    if (value && references.length === 0) {
      setMessage("Vibe 이미지를 먼저 추가해 주세요.");
      return;
    }
    if (value && activePreciseCount > 0) {
      setMessage("Vibe Transfer는 Precise Reference와 함께 사용할 수 없습니다.");
      return;
    }
    references.forEach((reference) => {
      if (reference.enabled !== value) setEnabled(reference.id, value);
    });
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
    <RendraReferenceDetailLayout
      title="Vibe Transfer"
      enabled={enabled}
      onToggle={toggleAll}
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
        <RendraToggle
          value={normalize}
          label="Normalize Reference Strength Values"
          onChange={setNormalize}
        />
      </View>

      <Text style={styles.sectionTitle}>Reference Images ({references.length})</Text>
      <View style={styles.cards}>
        {references.map((reference, index) => {
          const imageUri = resolveVibeReferenceImageUri(reference);
          const thumbnailUri =
            resolveVibeReferenceThumbnailUri(reference) ?? imageUri;
          return (
            <RendraReferenceImageCard
              key={reference.id}
              index={index}
              imageUri={imageUri}
              thumbnailUri={thumbnailUri}
              subtitle={`I ${formatValue(reference.informationExtracted)} · S ${formatValue(reference.strength)}`}
              enabled={reference.enabled}
              expanded={expandedIds.includes(reference.id)}
              busy={busyId === reference.id}
              enableDisabled={activePreciseCount > 0}
              onToggleExpanded={() => toggleExpanded(reference.id)}
              onToggleEnabled={(value) => setEnabled(reference.id, value)}
              onReplace={() => void pickImage(reference.id)}
              onRemove={() => void removeReference(reference.id)}
            >
              <RendraParameterSlider
                label="Information Extracted"
                value={reference.informationExtracted}
                min={0}
                max={1}
                step={0.01}
                precision={2}
                onChange={(value) => setInformation(reference.id, value)}
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
  normalizeCard: {
    minHeight: 80,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  normalizeCopy: {
    flex: 1,
    minWidth: 0,
  },
  normalizeTitle: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.sm,
  },
  normalizeDescription: {
    marginTop: 4,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    lineHeight: 17,
  },
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
  pressed: {
    opacity: 0.68,
  },
});
