import { useRef, useState } from "react";
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DETAIL_FIXED_HEADER_CONTENT_OFFSET,
  DetailHeaderOverlay,
} from "../../components/common/DetailScrollHeader";
// scripts/build-licenses.js가 생성
import licenses from "../../constants/licenses.json";
import { monoFont, tokens } from "../../styles/tokens";

type License = (typeof licenses)[number];

export function LicensesScreen() {
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [openName, setOpenName] = useState<string | null>(null);

  function renderItem({ item, index }: { item: License; index: number }) {
    const open = item.name === openName;
    const meta = [item.version, item.license, item.modified ? "수정됨" : null]
      .filter(Boolean)
      .join(" · ");

    return (
      <View style={index < licenses.length - 1 && styles.item}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpenName(open ? null : item.name)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{meta}</Text>
          </View>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={18}
            color={tokens.color.textMuted}
          />
        </Pressable>

        {open ? (
          <View style={styles.detail}>
            {item.text ? (
              <Text selectable style={styles.licenseText}>
                {item.text}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => void Linking.openURL(item.url)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.link}>{item.url}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* 뒤로 버튼의 블러가 비추는 영역 */}
      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        <Animated.FlatList
          data={licenses}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          extraData={openName}
          style={styles.list}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + DETAIL_FIXED_HEADER_CONTENT_OFFSET,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        />
      </BlurTargetView>

      <DetailHeaderOverlay
        title="오픈소스 라이선스"
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
        showMore={false}
        hideCompactTitleOnScroll
        blurTarget={blurTargetRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.app,
  },
  blurTarget: {
    flex: 1,
  },
  list: {
    // 블러는 BlurTargetView의 자식만 비춘다. 배경을 자식에 깔아야 창 배경색이 비치지 않는다.
    backgroundColor: tokens.color.app,
  },
  content: {
    paddingHorizontal: tokens.space[10],
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.borderSubtle,
  },
  row: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  meta: {
    marginTop: 3,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
  },
  detail: {
    paddingBottom: 16,
    gap: 12,
  },
  licenseText: {
    color: tokens.color.textSecondary,
    fontFamily: monoFont,
    fontSize: tokens.type["3xs"],
    lineHeight: 16,
  },
  link: {
    color: tokens.color.accent,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type["2xs"],
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
