import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { MediaAttachment } from '@/types';

const BUCKET = 'card-media';

export async function requestMediaPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickAndUploadPhotos(
  userId: string,
  onProgress?: (msg: string) => void
): Promise<MediaAttachment[]> {
  const granted = await requestMediaPermissions();
  if (!granted) throw new Error('Photo library permission denied');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    quality: 0.8,
    selectionLimit: 10,
    exif: false,
  });

  if (result.canceled || !result.assets.length) return [];

  const attachments: MediaAttachment[] = [];

  for (let i = 0; i < result.assets.length; i++) {
    const asset = result.assets[i];
    onProgress?.(`Uploading photo ${i + 1} of ${result.assets.length}…`);

    const publicUrl = await uploadFileToStorage(asset.uri, 'photo', userId, asset.mimeType);

    attachments.push({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'photo',
      uri: publicUrl,
      size: asset.fileSize || 0,
    });
  }

  return attachments;
}

export async function uploadVoiceMemo(
  userId: string,
  uri: string,
  duration?: number,
  mimeType?: string
): Promise<MediaAttachment> {
  const publicUrl = await uploadFileToStorage(uri, 'voice', userId, mimeType);

  return {
    id: `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'voice',
    uri: publicUrl,
    size: 0,
    duration,
  };
}

async function uploadFileToStorage(
  uri: string,
  type: 'photo' | 'video' | 'voice',
  userId: string,
  mimeType?: string | null
): Promise<string> {
  const contentType = mimeType || getFallbackContentType(type);
  const ext = getFileExtension(uri, contentType, type);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  let arrayBuffer: ArrayBuffer;

  if (Platform.OS === 'web') {
    // On web, blob URIs work fine with fetch
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Failed to read file: ${response.status}`);
    arrayBuffer = await response.arrayBuffer();
  } else {
    // On native, fetch with file:// URIs can be unreliable — use FileSystem instead
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    } as any);
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

function getFallbackContentType(type: 'photo' | 'video' | 'voice'): string {
  if (type === 'photo') return 'image/jpeg';
  if (type === 'video') return 'video/mp4';
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a';
}

function getFileExtension(
  uri: string,
  contentType: string,
  type: 'photo' | 'video' | 'voice'
): string {
  const fromMime = contentType.split('/')[1]?.split(';')[0]?.trim().toLowerCase();
  if (fromMime) {
    if (fromMime === 'jpeg') return 'jpg';
    if (fromMime === 'mpeg') return 'mp3';
    return fromMime;
  }

  const uriExt = uri.split('.').pop()?.toLowerCase().split('?')[0];
  if (uriExt && /^[a-z0-9]+$/.test(uriExt) && uriExt.length <= 5) {
    return uriExt;
  }

  if (type === 'photo') return 'jpg';
  if (type === 'video') return 'mp4';
  return Platform.OS === 'web' ? 'webm' : 'm4a';
}
