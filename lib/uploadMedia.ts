import * as ImagePicker from 'expo-image-picker';
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

async function uploadFileToStorage(
  uri: string,
  type: 'photo' | 'video',
  userId: string,
  mimeType?: string | null
): Promise<string> {
  const ext = (uri.split('.').pop() || (type === 'photo' ? 'jpg' : 'mp4')).toLowerCase().split('?')[0];
  const contentType = mimeType || (type === 'photo' ? `image/${ext}` : `video/${ext}`);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // fetch + arrayBuffer works on both web and React Native 0.72+
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Failed to read file: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}
