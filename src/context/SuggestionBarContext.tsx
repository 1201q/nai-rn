import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Keyboard } from "react-native";
import type { TagSuggestion } from "../lib/tagDb";

// 추천 바에 올라가는 항목. chunk는 `@` 검색 결과이고 value는 삽입할 참조다.
export type PromptSuggestion =
  | TagSuggestion
  | { type: "chunk"; label: string; value: string; color: string };

type SuggestionBarActions = {
  pickRef: React.MutableRefObject<((item: PromptSuggestion) => void) | null>;
  setSuggestions: (
    owner: symbol,
    s: PromptSuggestion[],
    pick: (item: PromptSuggestion) => void,
  ) => void;
  clearSuggestions: (owner: symbol) => void;
  setActive: (owner: symbol, active: boolean) => void;
  isActive: (owner: symbol) => boolean;
};

const ActionsContext = createContext<SuggestionBarActions | null>(null);
const DataContext = createContext<PromptSuggestion[]>([]);
const ActiveContext = createContext(false);

export function SuggestionBarProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestionsState] = useState<PromptSuggestion[]>([]);
  const [active, setActiveState] = useState(false);
  const ownerRef = useRef<symbol | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const pickRef = useRef<((item: PromptSuggestion) => void) | null>(null);

  const setSuggestions = useCallback(
    (
      owner: symbol,
      s: PromptSuggestion[],
      pick: (item: PromptSuggestion) => void,
    ) => {
      if (ownerRef.current !== owner) return;
      setSuggestionsState(s);
      pickRef.current = pick;
    },
    [],
  );

  const resetSuggestions = useCallback(() => {
    setSuggestionsState([]);
    pickRef.current = null;
  }, []);

  const isActive = useCallback(
    (owner: symbol) => ownerRef.current === owner,
    [],
  );
  const clearSuggestions = useCallback(
    (owner: symbol) => {
      if (ownerRef.current === owner) resetSuggestions();
    },
    [resetSuggestions],
  );
  const setActive = useCallback(
    (owner: symbol, nextActive: boolean) => {
      if (!nextActive && ownerRef.current !== owner) return;
      ownerRef.current = nextActive ? owner : null;
      resetSuggestions();
      setActiveState(nextActive);
    },
    [resetSuggestions],
  );

  useEffect(() => {
    const handleKeyboardShow = () => {
      setKeyboardVisible(true);
    };
    const handleKeyboardHide = () => {
      resetSuggestions();
      setKeyboardVisible(false);
    };
    const subs = [
      Keyboard.addListener("keyboardWillShow", handleKeyboardShow),
      Keyboard.addListener("keyboardDidShow", handleKeyboardShow),
      Keyboard.addListener("keyboardWillHide", handleKeyboardHide),
      Keyboard.addListener("keyboardDidHide", handleKeyboardHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [resetSuggestions]);

  const actions = useMemo(
    () => ({ pickRef, setSuggestions, clearSuggestions, setActive, isActive }),
    [setSuggestions, clearSuggestions, setActive, isActive],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <DataContext.Provider value={suggestions}>
        <ActiveContext.Provider value={active && keyboardVisible}>
          {children}
        </ActiveContext.Provider>
      </DataContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useSuggestionBarActions() {
  return useContext(ActionsContext);
}

export function useSuggestions() {
  return useContext(DataContext);
}

export function useSuggestionBarActive() {
  return useContext(ActiveContext);
}
