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
  setSuggestions: (owner: symbol, s: TagSuggestion[], pick: (item: TagSuggestion) => void) => void;
  clearSuggestions: (owner: symbol) => void;
  setActive: (owner: symbol, active: boolean) => void;
  isActive: (owner: symbol) => boolean;
};

const ActionsContext = createContext<SuggestionBarActions | null>(null);
const DataContext = createContext<TagSuggestion[]>([]);
const ActiveContext = createContext(false);

export function SuggestionBarProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestionsState] = useState<TagSuggestion[]>([]);
  const [active, setActiveState] = useState(false);
  const ownerRef = useRef<symbol | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const pickRef = useRef<((item: TagSuggestion) => void) | null>(null);

  const setSuggestions = useCallback(
    (owner: symbol, s: TagSuggestion[], pick: (item: TagSuggestion) => void) => {
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

  const isActive = useCallback((owner: symbol) => ownerRef.current === owner, []);
  const clearSuggestions = useCallback((owner: symbol) => {
    if (ownerRef.current === owner) resetSuggestions();
  }, [resetSuggestions]);
  const setActive = useCallback((owner: symbol, nextActive: boolean) => {
    if (!nextActive && ownerRef.current !== owner) return;
    ownerRef.current = nextActive ? owner : null;
    resetSuggestions();
    setActiveState(nextActive);
  }, [resetSuggestions]);

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
