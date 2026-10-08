import { memo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";

import { useGenerationChromeMetrics } from "../../hooks/useGenerationChromeMetrics";
import {
  DEFAULT_PROMPT_CHUNK_COLOR,
  isPromptChunkColor,
  type PromptChunk,
  type PromptChunkCategory,
} from "../../lib/promptChunks";
import {
  deleteAllPromptChunks,
  deletePromptChunk,
  deletePromptChunkCategory,
  insertPromptChunkReference,
  movePromptChunk,
  movePromptChunkCategory,
  savePromptChunk,
  savePromptChunkCategory,
  togglePromptChunkCategory,
} from "../../store/promptChunkActions";
import { usePromptChunkStore } from "../../store/promptChunkStore";
import { tokens } from "../../styles/tokens";
import { BottomSheetKeyboardAwareScrollView } from "./BottomSheetKeyboardAwareScrollView";

type IconName = keyof typeof Ionicons.glyphMap;

type Editing =
  | { kind: "chunk"; chunk: PromptChunk | null }
  | { kind: "category"; category: PromptChunkCategory | null };

const COLOR_PRESETS = [
  DEFAULT_PROMPT_CHUNK_COLOR,
  "#EF4444",
  "#F59E0B",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={tokens.color.textPrimary} />
    </Pressable>
  );
}

function ChunkChip({
  chunk,
  onEdit,
}: {
  chunk: PromptChunk;
  onEdit: (chunk: PromptChunk) => void;
}) {
  const insert = () => {
    if (insertPromptChunkReference(chunk.name)) {
      toast.success(`${chunk.name} 삽입`);
    } else {
      toast.info("프롬프트 입력칸을 먼저 선택한 뒤 chunk를 누르세요.");
    }
  };

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: `${chunk.color}15`,
          borderColor: `${chunk.color}66`,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${chunk.name} 삽입`}
        accessibilityHint={chunk.content}
        onPress={insert}
        style={({ pressed }) => [styles.chipBody, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.chipLabel}>
          {chunk.name}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${chunk.name} 편집`}
        hitSlop={6}
        onPress={() => onEdit(chunk)}
        style={({ pressed }) => [styles.chipEdit, pressed && styles.pressed]}
      >
        <Ionicons name="pencil" size={12} color={tokens.color.textTertiary} />
      </Pressable>
    </View>
  );
}

function ChunkForm({
  editing,
  categories,
  onClose,
}: {
  editing: Editing;
  categories: PromptChunkCategory[];
  onClose: () => void;
}) {
  const isCategory = editing.kind === "category";
  const target = isCategory ? editing.category : editing.chunk;
  const [name, setName] = useState(target?.name ?? "");
  const [content, setContent] = useState(
    editing.kind === "chunk" ? (editing.chunk?.content ?? "") : "",
  );
  const [categoryId, setCategoryId] = useState(
    editing.kind === "chunk" ? (editing.chunk?.categoryId ?? null) : null,
  );
  const [color, setColor] = useState(
    target?.color ?? DEFAULT_PROMPT_CHUNK_COLOR,
  );
  const noun = isCategory ? "카테고리" : "Chunk";
  const chunks = usePromptChunkStore((state) => state.chunks);
  const stored = chunks.find((chunk) => chunk.id === target?.id);
  const siblings: { id: string }[] = isCategory
    ? categories
    : chunks.filter((chunk) => chunk.categoryId === stored?.categoryId);
  const position = siblings.findIndex((item) => item.id === target?.id) + 1;

  const save = () => {
    const error = isCategory
      ? savePromptChunkCategory({ id: target?.id, name, color })
      : savePromptChunk({ id: target?.id, name, content, color, categoryId });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${noun}를 저장했습니다.`);
    onClose();
  };
  const remove = () => {
    if (!target) return;
    if (isCategory) deletePromptChunkCategory(target.id);
    else deletePromptChunk(target.id);
    toast.success(`${noun}를 삭제했습니다.`);
    onClose();
  };
  const move = (direction: -1 | 1) => {
    if (!target) return;
    if (isCategory) movePromptChunkCategory(target.id, direction);
    else movePromptChunk(target.id, direction);
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>
          {target ? `${noun} 편집` : `새 ${noun}`}
        </Text>
        <HeaderButton icon="close" label="닫기" onPress={onClose} />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          accessibilityLabel={`${noun} 이름`}
          value={name}
          onChangeText={setName}
          placeholder={isCategory ? "Category name..." : "e.g., My Style Tags"}
          placeholderTextColor={tokens.color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {isCategory ? null : (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Content</Text>
            <TextInput
              accessibilityLabel="Chunk 내용"
              value={content}
              onChangeText={setContent}
              placeholder="Enter the tags/content this chunk will expand to..."
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.contentInput]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.wrap}>
              {[null, ...categories].map((category) => {
                const selected = (category?.id ?? null) === categoryId;
                return (
                  <Pressable
                    key={category?.id ?? "uncategorized"}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setCategoryId(category?.id ?? null)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                      ]}
                    >
                      {category?.name ?? "Uncategorized"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Color</Text>
        <View style={styles.wrap}>
          {COLOR_PRESETS.map((preset) => {
            const selected = preset.toLowerCase() === color.toLowerCase();
            return (
              <Pressable
                key={preset}
                accessibilityRole="radio"
                accessibilityLabel={`색상 ${preset}`}
                accessibilityState={{ selected }}
                onPress={() => setColor(preset)}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: preset },
                  selected && styles.swatchSelected,
                  pressed && styles.pressed,
                ]}
              />
            );
          })}
        </View>
        <View style={styles.hexRow}>
          <View
            style={[
              styles.swatch,
              {
                backgroundColor: isPromptChunkColor(color)
                  ? color
                  : "transparent",
              },
            ]}
          />
          <TextInput
            accessibilityLabel="색상 코드"
            value={color}
            onChangeText={setColor}
            placeholder={DEFAULT_PROMPT_CHUNK_COLOR}
            placeholderTextColor={tokens.color.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            style={[styles.input, styles.hexInput]}
          />
        </View>
      </View>

      {target ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Order</Text>
          <View style={styles.wrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="앞으로 이동"
              onPress={() => move(-1)}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={16}
                color={tokens.color.textSecondary}
              />
            </Pressable>
            <Text style={styles.position}>
              {position} / {siblings.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="뒤로 이동"
              onPress={() => move(1)}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="arrow-forward"
                size={16}
                color={tokens.color.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {target ? (
          <Pressable
            accessibilityRole="button"
            onPress={remove}
            style={({ pressed }) => [
              styles.action,
              styles.actionDelete,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.actionLabel, styles.actionDeleteLabel]}>
              Delete
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={save}
          style={({ pressed }) => [
            styles.action,
            styles.actionSave,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionLabel, styles.actionSaveLabel]}>Save</Text>
        </Pressable>
      </View>
    </>
  );
}

export const PromptChunksSheetContent = memo(function PromptChunksSheetContent({
  active,
  sheetHiddenHeight = 0,
}: {
  active: boolean;
  sheetHiddenHeight?: number;
}) {
  const { sheetContentPaddingBottom } = useGenerationChromeMetrics();
  const chunks = usePromptChunkStore((state) => state.chunks);
  const categories = usePromptChunkStore((state) => state.categories);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editChunk = (chunk: PromptChunk) =>
    setEditing({ kind: "chunk", chunk });
  const uncategorized = chunks.filter((chunk) => chunk.categoryId === null);
  const empty = chunks.length === 0 && categories.length === 0;

  const confirmDeleteAll = () => {
    Alert.alert(
      "Delete All Prompt Chunks?",
      "모든 chunk와 카테고리를 삭제합니다. 프롬프트에 들어 있는 참조는 내용으로 펼쳐집니다. 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => {
            deleteAllPromptChunks();
            toast.success("모든 chunk를 삭제했습니다.");
          },
        },
      ],
    );
  };

  return (
    <BottomSheetKeyboardAwareScrollView
      active={active}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: sheetContentPaddingBottom + sheetHiddenHeight },
      ]}
      bottomOffset={-sheetHiddenHeight}
      mode={Platform.OS === "android" ? "layout" : "insets"}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {editing ? (
        <ChunkForm
          // 대상이 바뀌면 입력 상태를 새로 시작한다.
          key={
            editing.kind === "chunk"
              ? `chunk-${editing.chunk?.id}`
              : `category-${editing.category?.id}`
          }
          editing={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Prompt Chunks</Text>
            <HeaderButton
              icon="folder-open-outline"
              label="카테고리 추가"
              onPress={() => setEditing({ kind: "category", category: null })}
            />
            <HeaderButton
              icon="add"
              label="Chunk 추가"
              onPress={() => setEditing({ kind: "chunk", chunk: null })}
            />
          </View>

          {empty ? (
            <Text style={styles.emptyText}>
              No custom prompt chunks yet. Tap + to add one.
            </Text>
          ) : null}

          {uncategorized.length > 0 ? (
            <View style={styles.wrap}>
              {uncategorized.map((chunk) => (
                <ChunkChip key={chunk.id} chunk={chunk} onEdit={editChunk} />
              ))}
            </View>
          ) : null}

          {categories.map((category) => {
            const children = chunks.filter(
              (chunk) => chunk.categoryId === category.id,
            );
            return (
              <View key={category.id} style={styles.category}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${category.name} 카테고리`}
                  accessibilityState={{ expanded: !category.collapsed }}
                  onPress={() => togglePromptChunkCategory(category.id)}
                  style={({ pressed }) => [
                    styles.categoryHeader,
                    {
                      backgroundColor: `${category.color}15`,
                      borderColor: `${category.color}66`,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={category.collapsed ? "caret-forward" : "caret-down"}
                    size={14}
                    color={tokens.color.textPrimary}
                  />
                  <Text numberOfLines={1} style={styles.categoryName}>
                    {category.name}
                  </Text>
                  <Text style={styles.categoryCount}>{children.length}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${category.name} 카테고리 편집`}
                    hitSlop={8}
                    onPress={() => setEditing({ kind: "category", category })}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Ionicons
                      name="pencil"
                      size={14}
                      color={tokens.color.textTertiary}
                    />
                  </Pressable>
                </Pressable>
                {category.collapsed ? null : children.length > 0 ? (
                  <View style={[styles.wrap, styles.categoryChildren]}>
                    {children.map((chunk) => (
                      <ChunkChip
                        key={chunk.id}
                        chunk={chunk}
                        onEdit={editChunk}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyCategory}>Empty category</Text>
                )}
              </View>
            );
          })}

          {empty ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={confirmDeleteAll}
              style={({ pressed }) => [
                styles.deleteAll,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.actionLabel}>Delete All</Text>
            </Pressable>
          )}
        </>
      )}
    </BottomSheetKeyboardAwareScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  header: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.base,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.xs,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  chipBody: {
    flexShrink: 1,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
  },
  chipEdit: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  chipLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  category: {
    gap: 6,
  },
  categoryHeader: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryName: {
    flex: 1,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  categoryCount: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
  },
  categoryChildren: {
    paddingLeft: 16,
  },
  emptyCategory: {
    paddingLeft: 16,
    color: tokens.color.textMuted,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type["2xs"],
    fontStyle: "italic",
  },
  deleteAll: {
    height: 44,
    marginTop: 8,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: tokens.color.textTertiary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  input: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: tokens.color.promptBorder,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.promptSurface,
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.regular,
    fontSize: tokens.type.base,
  },
  contentInput: {
    minHeight: 96,
  },
  option: {
    maxWidth: "100%",
    minHeight: 32,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius.sm,
    justifyContent: "center",
    backgroundColor: tokens.color.card,
  },
  optionSelected: {
    borderColor: tokens.color.accent,
  },
  optionLabel: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  optionLabelSelected: {
    color: tokens.color.accent,
  },
  position: {
    minWidth: 44,
    alignSelf: "center",
    textAlign: "center",
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: tokens.type.xs,
  },
  swatch: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius.sm,
  },
  swatchSelected: {
    borderColor: tokens.color.textPrimary,
  },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hexInput: {
    flex: 1,
  },
  actions: {
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.raised,
  },
  actionLabel: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.sm,
  },
  actionDelete: {
    borderWidth: 1,
    borderColor: tokens.color.borderNegative,
    backgroundColor: "transparent",
  },
  actionDeleteLabel: {
    color: tokens.color.negative,
  },
  actionSave: {
    backgroundColor: tokens.color.accent,
  },
  actionSaveLabel: {
    color: tokens.color.onAccent,
  },
  pressed: {
    opacity: tokens.opacity.pressed,
  },
});
