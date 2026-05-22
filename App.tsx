import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { generateNovelAiImage } from './src/lib/novelai';
import {
  deleteNovelAiToken,
  getNovelAiToken,
  saveNovelAiToken,
} from './src/lib/secureToken';

export default function App() {
  const [tokenInput, setTokenInput] = useState('');
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('1girl, masterpiece, best quality');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [seed, setSeed] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getNovelAiToken().then(setStoredToken).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : String(error));
    });
  }, []);

  async function handleSaveToken() {
    const token = tokenInput.trim();

    if (!token) {
      setMessage('토큰을 입력해주세요.');
      return;
    }

    await saveNovelAiToken(token);
    setStoredToken(token);
    setTokenInput('');
    setMessage('토큰 저장 완료');
  }

  async function handleDeleteToken() {
    await deleteNovelAiToken();
    setStoredToken(null);
    setTokenInput('');
    setMessage('토큰 삭제 완료');
  }

  async function handleTestRequest() {
    if (!storedToken) {
      setMessage('저장된 토큰이 없습니다.');
      return;
    }

    if (!prompt.trim()) {
      setMessage('프롬프트를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await generateNovelAiImage({
        token: storedToken,
        prompt: prompt.trim(),
      });

      setImageDataUri(result.imageDataUri);
      setSeed(result.seed);
      setMessage('이미지 생성 완료');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>NovelAI Request Test</Text>

        <Text style={styles.label}>API Token</Text>
        <TextInput
          value={tokenInput}
          onChangeText={setTokenInput}
          placeholder="NovelAI API Token"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />

        <View style={styles.row}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveToken}>
            <Text style={styles.primaryText}>토큰 저장</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDeleteToken}>
            <Text style={styles.secondaryText}>토큰 삭제</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.status}>
          {storedToken ? '저장된 토큰 있음' : '저장된 토큰 없음'}
        </Text>

        <Text style={styles.label}>Prompt</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.promptInput]}
        />

        <TouchableOpacity
          style={[styles.testButton, isLoading && styles.disabledButton]}
          onPress={handleTestRequest}
          disabled={isLoading}
        >
          <Text style={styles.testButtonText}>NAI 요청 테스트</Text>
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.status}>요청 중...</Text>
          </View>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {seed !== null ? <Text style={styles.seed}>Seed: {seed}</Text> : null}

        {imageDataUri ? (
          <Image source={{ uri: imageDataUri }} resizeMode="contain" style={styles.image} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 24,
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
  },
  label: {
    marginBottom: 8,
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  promptInput: {
    minHeight: 110,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  secondaryText: {
    color: '#374151',
    fontWeight: '700',
  },
  status: {
    marginBottom: 18,
    color: '#4b5563',
  },
  testButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  disabledButton: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  message: {
    marginTop: 18,
    color: '#111827',
    lineHeight: 20,
  },
  seed: {
    marginTop: 12,
    color: '#4b5563',
  },
  image: {
    width: '100%',
    aspectRatio: 832 / 1216,
    marginTop: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
});
