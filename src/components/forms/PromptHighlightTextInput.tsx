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
    borderRadius: 5,
  },
  mentionHere: {
    color: tokens.color.textPrimary,
    backgroundColor: "#204184",
    borderRadius: 5,
  },
  mentionReport: {
    color: tokens.color.textPrimary,
    backgroundColor: "#285125",
    borderRadius: 5,
  },
  syntax: {
    color: "#adb5bd",
  },
  // Prompt Chunk 참조의 `!macro:`와 끝의 `!`를 안 보이게 줄이는 데 쓴다.
  emoji: {
    fontSize: 0.5,
    fontFamily: tokens.font.regular,
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
};

const RANDOMIZER_FONT_FAMILY = tokens.font.medium;
const CHUNK_PREFIX_LENGTH = "!macro:".length;
const CHUNK_BACKGROUND_ALPHA = 0.3;
const CHUNK_MISSING_BACKGROUND = {
  red: 239,
  green: 110,
  blue: 110,
  alpha: 0.3,
};
const CHUNK_HIDDEN_COLOR = { red: 0, green: 0, blue: 0, alpha: 0 };

type PromptChunkColors = Record<string, MarkdownRangeBackgroundColor>;

function weightedBackgroundColor(weight: number): MarkdownRangeBackgroundColor {
  "worklet";

  const strength = Math.max(0, Math.min(1, Math.abs(weight - 1)));
  const alpha = Math.round((0.28 + 0.72 * strength) * 100) / 100;

  return weight < 1
    ? { red: 32, green: 65, blue: 132, alpha }
    : { red: 110, green: 44, blue: 28, alpha };
}

// worklet은 호이스팅되지 않으므로 아래 parser보다 먼저 선언한다.
function parsePromptSyntaxRanges(input: string): PromptMarkdownRange[] {
  "worklet";

  const ranges: PromptMarkdownRange[] = [];
  const spans = parsePromptHighlights(input);
  let start = 0;

  for (const span of spans) {
    let type: MarkdownRange["type"] | undefined;
    let backgroundColor: MarkdownRangeBackgroundColor | undefined;
    let foregroundColor: MarkdownRangeBackgroundColor | undefined;
    let fontFamily: string | undefined;

    if (span.weight !== undefined && Math.abs(span.weight - 1) > 0.0001) {
      type = span.weight < 1 ? "mention-here" : "mention-user";
      backgroundColor = weightedBackgroundColor(span.weight);
    } else if (span.kind === "numericMark") {
      type = "mention-report";
    } else if (span.kind === "randomizer" || span.kind === "separator") {
      type = "syntax";
      foregroundColor = { red: 245, green: 243, blue: 194, alpha: 1 };
      fontFamily = RANDOMIZER_FONT_FAMILY;
    } else if (span.kind === "bracket") {
      type = "syntax";
    }

    if (type !== undefined) {
      const range: PromptMarkdownRange = {
        type,
        start,
        length: span.text.length,
      };
      if (backgroundColor !== undefined) {
        range.backgroundColor = backgroundColor;
      }
      if (foregroundColor !== undefined) {
        range.foregroundColor = foregroundColor;
      }
      if (fontFamily !== undefined) {
        range.fontFamily = fontFamily;
      }
      ranges.push(range);
    }
    start += span.text.length;
  }

  return ranges;
}

// parser는 UI 스레드 worklet이라 store를 읽을 수 없다. 이름별 색을 만들 때 넘긴다.
export function createPromptMarkdownParser(chunkColors: PromptChunkColors) {
  return function promptMarkdownParser(input: string): PromptMarkdownRange[] {
    "worklet";

    const ranges = parsePromptSyntaxRanges(input);
    const reference = /!macro:([^!]+)!/g;
    let match = reference.exec(input);
    while (match !== null) {
      const start = match.index;
      const length = match[0].length;
      const color = chunkColors[match[1].trim()];
      if (color === undefined) {
        // 없는 chunk는 원문을 그대로 보여 고칠 수 있게 한다.
        ranges.push({
          type: "mention-user",
          start,
          length,
          backgroundColor: CHUNK_MISSING_BACKGROUND,
        });
      } else {
        ranges.push({
          type: "mention-user",
          start,
          length,
          backgroundColor: color,
          atomic: true,
        });
        ranges.push({
          type: "emoji",
          start,
          length: CHUNK_PREFIX_LENGTH,
          foregroundColor: CHUNK_HIDDEN_COLOR,
        });
        ranges.push({
          type: "emoji",
          start: start + length - 1,
          length: 1,
          foregroundColor: CHUNK_HIDDEN_COLOR,
        });
      }
      match = reference.exec(input);
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
