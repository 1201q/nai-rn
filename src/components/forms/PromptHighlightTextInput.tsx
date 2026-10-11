import {
  MarkdownTextInput,
  type MarkdownRange,
  type MarkdownStyle,
  type MarkdownTextInputProps,
} from "@expensify/react-native-live-markdown";
import { useBottomSheetInternal } from "@gorhom/bottom-sheet";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentRef,
} from "react";
import {
  findNodeHandle,
  TextInput,
  type BlurEvent,
  type FocusEvent,
} from "react-native";

import { parsePromptHighlights } from "../../lib/promptHighlight";
import { usePromptChunkStore } from "../../store/promptChunkStore";
import { tokens } from "../../styles/tokens";

const promptMarkdownStyle: MarkdownStyle = {
  mentionUser: {
    color: tokens.color.textPrimary,
    backgroundColor: "#6e2c1c",
    borderRadius: 2,
  },
  mentionHere: {
    color: tokens.color.textPrimary,
    backgroundColor: "#204184",
    borderRadius: 2,
  },
  mentionReport: {
    color: tokens.color.textPrimary,
    backgroundColor: "#285125",
    borderRadius: 2,
  },
  syntax: {
    color: "#adb5bd",
  },
};

interface MarkdownRangeBackgroundColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

type PromptMarkdownRange = MarkdownRange & {
  backgroundColor?: MarkdownRangeBackgroundColor;
  foregroundColor?: MarkdownRangeBackgroundColor;
  fontFamily?: string;
  // Android: 커서가 안에 놓이지 않고 일부만 지워도 전체가 지워지는 구간.
  atomic?: boolean;
  // Android: 배경에 1dp 테두리를 그린다.
  borderColor?: MarkdownRangeBackgroundColor;
  // Android: markdownStyle의 borderRadius 대신 쓴다(dp).
  borderRadius?: number;
  // Android: 배경을 글자 위아래로 이만큼 키운다(dp). 줄 높이는 바뀌지 않는다.
  verticalOutset?: number;
  // Android: 글자를 그리지 않고 이 폭(dp)의 빈칸으로 바꾼다.
  spacer?: number;
};

const BAR_FONT_FAMILY = tokens.font.medium;
const CHUNK_PREFIX_LENGTH = "!macro:".length;
const CHUNK_BACKGROUND_ALPHA = 0.3;
const CHUNK_BORDER_RADIUS = 5;
const CHUNK_VERTICAL_OUTSET = 2;
const CHUNK_MISSING_BACKGROUND = {
  red: 239,
  green: 110,
  blue: 110,
  alpha: 0.3,
};
// 칩 안쪽 좌우 여백. `!macro:`와 끝의 `!`를 이 폭의 빈칸으로 바꾼다.
const CHUNK_PADDING = 5;

type PromptChunkColors = Record<string, MarkdownRangeBackgroundColor>;

// 공식 웹 기본 테마(NovelAI Dark)의 강조 색.
const HIGHLIGHT_TYPES = {
  high: "mention-user",
  low: "mention-here",
  mid: "mention-report",
} as const;
const HIGHLIGHT_COLORS = {
  high: { red: 184, green: 55, blue: 0 },
  low: { red: 4, green: 102, blue: 206 },
  mid: { red: 0, green: 151, blue: 7 },
} as const;
const BAR_COLOR = { red: 245, green: 243, blue: 194, alpha: 1 };

// parser는 UI 스레드 worklet이라 store를 읽을 수 없다. 이름별 색을 만들 때 넘긴다.
export function createPromptMarkdownParser(chunkColors: PromptChunkColors) {
  return function promptMarkdownParser(input: string): PromptMarkdownRange[] {
    "worklet";

    // Prompt Chunk 참조는 강조 파서가 읽지 않는다. 이름 안의 기호가 문법으로
    // 읽히지 않고, 강조 배경이 칩을 덮지 않는다.
    const references: { start: number; end: number; name: string }[] = [];
    const reference = /!macro:([^!]+)!/g;
    let match = reference.exec(input);
    while (match !== null) {
      references.push({
        start: match.index,
        end: match.index + match[0].length,
        name: match[1].trim(),
      });
      match = reference.exec(input);
    }

    const ranges: PromptMarkdownRange[] = [];
    const bars: PromptMarkdownRange[] = [];
    for (const highlight of parsePromptHighlights(input, references)) {
      const start = highlight.start;
      const length = highlight.end - highlight.start;
      if (highlight.kind === "bar") {
        bars.push({
          type: "syntax",
          start,
          length,
          foregroundColor: BAR_COLOR,
          fontFamily: BAR_FONT_FAMILY,
        });
      } else {
        const color = HIGHLIGHT_COLORS[highlight.kind];
        ranges.push({
          type: HIGHLIGHT_TYPES[highlight.kind],
          start,
          length,
          backgroundColor: {
            red: color.red,
            green: color.green,
            blue: color.blue,
            alpha: highlight.alpha ?? 0,
          },
        });
      }
    }
    // 세로줄 글자색이 강조 구간의 글자색보다 나중에 적용되어야 한다.
    for (const bar of bars) ranges.push(bar);

    for (const { start, end, name } of references) {
      const length = end - start;
      const color = chunkColors[name];
      if (color === undefined) {
        // 없는 chunk는 원문을 그대로 보여 고칠 수 있게 한다.
        ranges.push({
          type: "mention-user",
          start,
          length,
          backgroundColor: CHUNK_MISSING_BACKGROUND,
          borderRadius: CHUNK_BORDER_RADIUS,
        });
      } else {
        ranges.push({
          type: "mention-user",
          start,
          length,
          backgroundColor: color,
          atomic: true,
          borderColor: {
            red: color.red,
            green: color.green,
            blue: color.blue,
            alpha: 1,
          },
          borderRadius: CHUNK_BORDER_RADIUS,
          verticalOutset: CHUNK_VERTICAL_OUTSET,
        });
        ranges.push({
          type: "syntax",
          start,
          length: CHUNK_PREFIX_LENGTH,
          spacer: CHUNK_PADDING,
        });
        ranges.push({
          type: "syntax",
          start: end - 1,
          length: 1,
          spacer: CHUNK_PADDING,
        });
      }
    }
    return ranges;
  };
}

export const promptMarkdownParser = createPromptMarkdownParser({});

export type PromptHighlightTextInputHandle = ComponentRef<
  typeof MarkdownTextInput
>;

type PromptHighlightTextInputProps = Omit<
  MarkdownTextInputProps,
  "markdownStyle" | "parser"
> & {
  bottomSheetAware?: boolean;
};

export const PromptHighlightTextInput = forwardRef<
  PromptHighlightTextInputHandle,
  PromptHighlightTextInputProps
>(function PromptHighlightTextInput(
  { bottomSheetAware = false, onBlur, onFocus, ...props },
  providedRef,
) {
  const inputRef = useRef<PromptHighlightTextInputHandle>(null);
  const bottomSheet = useBottomSheetInternal(true);
  const animatedKeyboardState = bottomSheet?.animatedKeyboardState;
  const textInputNodesRef = bottomSheet?.textInputNodesRef;
  const chunks = usePromptChunkStore((state) => state.chunks);
  const parser = useMemo(() => {
    const colors: PromptChunkColors = {};
    for (const chunk of chunks) {
      const value = Number.parseInt(chunk.color.slice(1), 16);
      colors[chunk.name] = {
        red: (value >> 16) & 255,
        green: (value >> 8) & 255,
        blue: value & 255,
        alpha: CHUNK_BACKGROUND_ALPHA,
      };
    }
    return createPromptMarkdownParser(colors);
  }, [chunks]);

  const handleFocus = useCallback(
    (event: FocusEvent) => {
      if (bottomSheetAware && animatedKeyboardState) {
        animatedKeyboardState.set((state) => ({
          ...state,
          target: event.nativeEvent.target,
        }));
      }
      onFocus?.(event);
    },
    [animatedKeyboardState, bottomSheetAware, onFocus],
  );
  const handleBlur = useCallback(
    (event: BlurEvent) => {
      if (bottomSheetAware && animatedKeyboardState && textInputNodesRef) {
        const keyboardState = animatedKeyboardState.get();
        const focusedInput = findNodeHandle(
          TextInput.State.currentlyFocusedInput() as unknown as Parameters<
            typeof findNodeHandle
          >[0],
        );
        const shouldRemoveTarget =
          keyboardState.target === event.nativeEvent.target;
        const shouldIgnoreBlur =
          focusedInput !== null && textInputNodesRef.current.has(focusedInput);

        if (shouldRemoveTarget && !shouldIgnoreBlur) {
          animatedKeyboardState.set((state) => ({
            ...state,
            target: undefined,
          }));
        }
      }
      onBlur?.(event);
    },
    [animatedKeyboardState, bottomSheetAware, onBlur, textInputNodesRef],
  );

  useEffect(() => {
    if (!bottomSheetAware || !animatedKeyboardState || !textInputNodesRef) {
      return;
    }

    const inputNode = findNodeHandle(inputRef.current);
    if (inputNode === null) return;

    textInputNodesRef.current.add(inputNode);
    return () => {
      const keyboardState = animatedKeyboardState.get();
      if (keyboardState.target === inputNode) {
        animatedKeyboardState.set((state) => ({
          ...state,
          target: undefined,
        }));
      }
      textInputNodesRef.current.delete(inputNode);
    };
  }, [animatedKeyboardState, bottomSheetAware, textInputNodesRef]);

  useImperativeHandle(
    providedRef,
    () => inputRef.current as PromptHighlightTextInputHandle,
    [],
  );

  return (
    <MarkdownTextInput
      {...props}
      ref={inputRef}
      markdownStyle={promptMarkdownStyle}
      onBlur={handleBlur}
      onFocus={handleFocus}
      parser={parser}
      textBreakStrategy="simple"
    />
  );
});
