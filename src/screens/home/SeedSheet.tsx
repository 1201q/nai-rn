import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  BottomSheetTextInput,
  TouchableOpacity as BottomSheetTouchableOpacity,
} from "@gorhom/bottom-sheet";

import { light, styles } from "./styles";

export function SeedSheetContent({
  seed,
  locked,
  onChangeSeed,
  onToggleLock,
  showTitle = true,
}: {
  seed: number;
  locked: boolean;
  onChangeSeed: (v: number) => void;
  onToggleLock: () => void;
  showTitle?: boolean;
}) {
  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Seed</Text> : null}
      <View style={styles.seedSheetRow}>
        <BottomSheetTextInput
          style={[styles.seedSheetInput, locked && styles.seedSheetInputLocked]}
          value={seed === 0 ? "" : String(seed)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "");
            onChangeSeed(digits ? Number(digits) : 0);
          }}
          editable={!locked}
          keyboardType="number-pad"
          placeholder="Random"
          placeholderTextColor={light.textHint}
        />
        <BottomSheetTouchableOpacity
          style={[
            styles.seedSheetButton,
            locked && styles.seedSheetButtonActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onToggleLock();
          }}
        >
          <Ionicons
            name={locked ? "lock-closed" : "lock-open-outline"}
            size={20}
            color={locked ? light.accent : light.textSecondary}
          />
        </BottomSheetTouchableOpacity>
        <BottomSheetTouchableOpacity
          style={styles.seedSheetButton}
          disabled={locked}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChangeSeed(Math.floor(Math.random() * 4_294_967_295));
          }}
        >
          <Ionicons
            name="dice-outline"
            size={20}
            color={locked ? light.textHint : light.textSecondary}
          />
        </BottomSheetTouchableOpacity>
      </View>
      <Text style={styles.seedSheetHint}>
        비우면 매 생성마다 랜덤. 잠그면 시드 고정.
      </Text>
    </>
  );
}
