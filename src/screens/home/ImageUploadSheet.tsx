import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { TouchableOpacity as BottomSheetTouchableOpacity } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { extractPngTextMetadata } from "../../lib/novelai";
import { parseNaiMetadata, type ParsedNaiMetadata } from "../../lib/naiMetadata";
import { useGenerationStore } from "../../store/generationStore";
import { light, styles as sheetStyles } from "./styles";

const MAX_CHARACTER_PROMPTS = 6;

type Selection = {
  prompt: boolean;
  undesired: boolean;
  characters: boolean;
  append: boolean;
  settings: boolean;
  seed: boolean;
};

function CheckRow({
  label,
  checked,
  disabled,
  indent,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  indent?: boolean;
  onToggle: () => void;
}) {
  return (
    <BottomSheetTouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onToggle();
      }}
      style={[styles.checkRow, indent && styles.checkRowIndent]}
    >
      <View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
          disabled && styles.checkboxDisabled,
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" size={15} color={light.bg} />
        ) : null}
      </View>
      <Text style={[styles.checkLabel, disabled && styles.checkLabelDisabled]}>
        {label}
      </Text>
    </BottomSheetTouchableOpacity>
  );
}

export function ImageUploadSheet({ onClose }: { onClose: () => void }) {
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1);
  const [parsed, setParsed] = useState<ParsedNaiMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Selection>({
    prompt: false,
    undesired: false,
    characters: false,
    append: false,
    settings: false,
    seed: false,
  });

  async function handlePick() {
    if (busy) return;
    try {
      setBusy(true);
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setBusy(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) {
        setBusy(false);
        return;
      }

      const asset = result.assets[0];
      setPickedUri(asset.uri);
      setAspect(asset.width && asset.height ? asset.width / asset.height : 1);

      const bytes = await new File(asset.uri).bytes();
      const raw = extractPngTextMetadata(bytes);
      const meta = parseNaiMetadata(raw);
      setParsed(meta);
      setSel({
        prompt: meta.prompt !== undefined,
        undesired: meta.negativePrompt !== undefined,
        characters: meta.characters !== undefined,
        append: false,
        settings: meta.hasSettings,
        seed: false,
      });
    } catch {
      setParsed(null);
    } finally {
      setBusy(false);
    }
  }

  function applyImport() {
    if (!parsed) return;
    const s = useGenerationStore.getState();

    if (sel.prompt && parsed.prompt !== undefined) s.setPrompt(parsed.prompt);
    if (sel.undesired && parsed.negativePrompt !== undefined) {
      s.setNegativePrompt(parsed.negativePrompt);
    }
    if (sel.characters && parsed.characters) {
      const next = sel.append
        ? [...s.characterPrompts, ...parsed.characters].slice(
            0,
            MAX_CHARACTER_PROMPTS,
          )
        : parsed.characters;
      s.setCharacterPrompts(next);
    }
    if (sel.settings) {
      if (parsed.model !== undefined) s.setModel(parsed.model);
      if (parsed.resolution !== undefined) s.setResolution(parsed.resolution);
      if (parsed.steps !== undefined) s.setSteps(parsed.steps);
      if (parsed.promptGuidance !== undefined) {
        s.setPromptGuidance(parsed.promptGuidance);
      }
      if (parsed.promptGuidanceRescale !== undefined) {
        s.setPromptGuidanceRescale(parsed.promptGuidanceRescale);
      }
      if (parsed.noiseSchedule !== undefined) {
        s.setNoiseSchedule(parsed.noiseSchedule);
      }
      if (parsed.sampler !== undefined) s.setSampler(parsed.sampler);
      if (parsed.varietyPlus !== undefined) s.setVarietyPlus(parsed.varietyPlus);
    }
    if (sel.seed && parsed.seed !== undefined) s.setSeed(parsed.seed);

    onClose();
  }

  const hasMetadata =
    parsed !== null &&
    (parsed.prompt !== undefined ||
      parsed.negativePrompt !== undefined ||
      parsed.characters !== undefined ||
      parsed.hasSettings ||
      parsed.seed !== undefined);

  return (
    <>
      <Text style={sheetStyles.sheetTitle}>Image Upload</Text>

      {pickedUri ? (
        <View
          style={[
            styles.previewCard,
            { aspectRatio: aspect > 1 ? aspect : undefined },
          ]}
        >
          <ExpoImage
            source={{ uri: pickedUri }}
            contentFit="contain"
            transition={120}
            style={styles.previewImage}
          />
        </View>
      ) : (
        <BottomSheetTouchableOpacity
          activeOpacity={0.8}
          disabled={busy}
          onPress={handlePick}
          style={styles.uploadCard}
        >
          {busy ? (
            <ActivityIndicator color={light.textSecondary} />
          ) : (
            <>
              <Ionicons
                name="image-outline"
                size={28}
                color={light.textSecondary}
              />
              <Text style={styles.uploadText}>이미지 선택</Text>
            </>
          )}
        </BottomSheetTouchableOpacity>
      )}

      {pickedUri ? (
        <BottomSheetTouchableOpacity
          activeOpacity={0.7}
          disabled={busy}
          onPress={handlePick}
          style={styles.reselectButton}
        >
          <Ionicons name="refresh" size={15} color={light.textSecondary} />
          <Text style={styles.reselectText}>다시 선택</Text>
        </BottomSheetTouchableOpacity>
      ) : null}

      {pickedUri && !busy ? (
        hasMetadata ? (
          <>
            <Text style={styles.sectionTitle}>가져올 항목</Text>
            {parsed?.prompt !== undefined ? (
              <CheckRow
                label="Prompt"
                checked={sel.prompt}
                onToggle={() => setSel((p) => ({ ...p, prompt: !p.prompt }))}
              />
            ) : null}
            {parsed?.negativePrompt !== undefined ? (
              <CheckRow
                label="Undesired Content"
                checked={sel.undesired}
                onToggle={() =>
                  setSel((p) => ({ ...p, undesired: !p.undesired }))
                }
              />
            ) : null}
            {parsed?.characters !== undefined ? (
              <>
                <CheckRow
                  label="Characters"
                  checked={sel.characters}
                  onToggle={() =>
                    setSel((p) => ({ ...p, characters: !p.characters }))
                  }
                />
                <CheckRow
                  label="Append"
                  indent
                  checked={sel.append}
                  disabled={!sel.characters}
                  onToggle={() => setSel((p) => ({ ...p, append: !p.append }))}
                />
              </>
            ) : null}
            {parsed?.hasSettings ? (
              <CheckRow
                label="Settings"
                checked={sel.settings}
                onToggle={() =>
                  setSel((p) => ({ ...p, settings: !p.settings }))
                }
              />
            ) : null}
            {parsed?.seed !== undefined ? (
              <CheckRow
                label="Seed"
                checked={sel.seed}
                onToggle={() => setSel((p) => ({ ...p, seed: !p.seed }))}
              />
            ) : null}

            <BottomSheetTouchableOpacity
              activeOpacity={0.85}
              onPress={applyImport}
              style={styles.importButton}
            >
              <Text style={styles.importButtonText}>메타데이터 가져오기</Text>
            </BottomSheetTouchableOpacity>
          </>
        ) : (
          <Text style={styles.emptyText}>
            이 이미지에는 NovelAI 메타데이터가 없습니다.
          </Text>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  uploadCard: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: light.border,
    borderStyle: "dashed",
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: {
    color: light.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  previewCard: {
    width: "100%",
    maxHeight: 260,
    minHeight: 180,
    borderRadius: 18,
    backgroundColor: light.surface,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  reselectButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  reselectText: {
    color: light.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    color: light.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  checkRowIndent: {
    paddingLeft: 28,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: light.accent,
    backgroundColor: light.accent,
  },
  checkboxDisabled: {
    opacity: 0.4,
  },
  checkLabel: {
    color: light.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  checkLabelDisabled: {
    color: light.textHint,
  },
  importButton: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  importButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: light.textSecondary,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
});
