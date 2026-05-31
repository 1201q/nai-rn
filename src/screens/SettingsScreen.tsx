import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Header } from "../components/Header";
import { useGenerationOptions } from "../context/GenerationOptionsContext";
import type { SettingsScreenNavigationProp } from "../navigation/types";
import { colors } from "../styles/colors";
import { styles } from "./settings/styles";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { storedToken, saveToken } = useGenerationOptions();
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
      <Header title="Settings" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons
              name="key-outline"
              size={14}
              color={colors.colorTextSecondary}
            />
            <Text style={styles.sectionTitle}>API</Text>
          </View>

          <Text style={styles.inputLabel}>NovelAI API Token</Text>
          <View style={styles.tokenInputRow}>
            <TextInput
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="Enter API token"
              placeholderTextColor={colors.colorTextTertiary}
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
                color={colors.colorTextTertiary}
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
