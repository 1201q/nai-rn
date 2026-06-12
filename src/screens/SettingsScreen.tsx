import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useGenerationStore } from "../store/generationStore";
import type { SettingsScreenNavigationProp } from "../navigation/types";
import { light } from "./home/styles";
import { ScreenHeader } from "../components/ScreenHeader";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const storedToken = useGenerationStore((s) => s.storedToken);
  const saveToken = useGenerationStore((s) => s.saveToken);
  const [tokenInput, setTokenInput] = useState("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (storedToken) {
      setTokenInput(storedToken);
    }
  }, [storedToken]);

  async function handleSaveToken() {
    const token = tokenInput.trim();
    if (!token) {
      setFeedback("Enter a token.");
      return;
    }

    setIsSaving(true);
    try {
      await saveToken(token);
      setFeedback("Token saved.");
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28 },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="key-outline" size={14} color={light.textSecondary} />
            <Text style={styles.sectionTitle}>API</Text>
          </View>

          <Text style={styles.inputLabel}>NovelAI API Token</Text>
          <View style={styles.tokenInputRow}>
            <TextInput
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="Enter API token"
              placeholderTextColor={light.textHint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isTokenVisible}
              style={styles.tokenInput}
            />
            <TouchableOpacity
              style={styles.inputIconButton}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={isTokenVisible ? "Hide token" : "Show token"}
              onPress={() => setIsTokenVisible((current) => !current)}
            >
              <Ionicons
                name={isTokenVisible ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={light.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.disabledButton]}
            activeOpacity={0.82}
            disabled={isSaving}
            onPress={handleSaveToken}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>

          {feedback ? <Text style={styles.message}>{feedback}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: light.textSecondary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: light.textPrimary,
  },
  tokenInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tokenInput: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.input,
    paddingHorizontal: 14,
    fontSize: 14,
    color: light.textPrimary,
  },
  inputIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.surface,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.accent,
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: light.accentText,
  },
  message: {
    fontSize: 13,
    color: light.textSecondary,
    marginTop: 2,
  },
});
