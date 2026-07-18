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

type SuggestionBarActions = {
  pickRef: React.MutableRefObject<((item: TagSuggestion) => void) | null>;
  setSuggestions: (s: TagSuggestion[], pick: (item: TagSuggestion) => void) => void;
  clearSuggestions: () => void;
  setActive: (active: boolean) => void;
};

const ActionsContext = createContext<SuggestionBarActions | null>(null);
const DataContext = createContext<TagSuggestion[]>([]);
const ActiveContext = createContext(false);

export function SuggestionBarProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestionsState] = useState<TagSuggestion[]>([]);
  const [active, setActive] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const pickRef = useRef<((item: TagSuggestion) => void) | null>(null);

  const setSuggestions = useCallback(
    (s: TagSuggestion[], pick: (item: TagSuggestion) => void) => {
      setSuggestionsState(s);
      pickRef.current = pick;
    },
    [],
  );

  const clearSuggestions = useCallback(() => {
    setSuggestionsState([]);
    pickRef.current = null;
  }, []);

  useEffect(() => {
    const handleKeyboardShow = () => {
      setKeyboardVisible(true);
    };
    const handleKeyboardHide = () => {
      clearSuggestions();
      setKeyboardVisible(false);
    };
    const subs = [
      Keyboard.addListener("keyboardWillShow", handleKeyboardShow),
      Keyboard.addListener("keyboardDidShow", handleKeyboardShow),
      Keyboard.addListener("keyboardWillHide", handleKeyboardHide),
      Keyboard.addListener("keyboardDidHide", handleKeyboardHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [clearSuggestions]);

  const actions = useMemo(
    () => ({ pickRef, setSuggestions, clearSuggestions, setActive }),
    [setSuggestions, clearSuggestions],
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
