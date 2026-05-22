import * as SecureStore from 'expo-secure-store';

const NOVELAI_TOKEN_KEY = 'novelai_api_token';

export async function saveNovelAiToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(NOVELAI_TOKEN_KEY, token);
}

export async function getNovelAiToken(): Promise<string | null> {
  return SecureStore.getItemAsync(NOVELAI_TOKEN_KEY);
}

export async function deleteNovelAiToken(): Promise<void> {
  await SecureStore.deleteItemAsync(NOVELAI_TOKEN_KEY);
}
