import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { getSupabaseClient } from '@/features/auth/supabase-client';

const SOURCE_LIMIT = 8 * 1024 * 1024;
const OUTPUT_LIMIT = 2 * 1024 * 1024;
const AVATAR_SIZE = 512;
const BUCKET = 'titanlog-profile-media';

export function profileMediaPath(userId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new ProfileMediaError('upload');
  return `${userId}/avatar.jpg`;
}

export class ProfileMediaError extends Error {
  constructor(
    readonly code: 'permission' | 'too_large' | 'processing' | 'upload'
  ) {
    super(code);
  }
}

function profileDirectory(): Directory {
  const directory = new Directory(Paths.document, 'profile');
  if (!directory.exists)
    directory.create({ idempotent: true, intermediates: true });
  return directory;
}

export async function pickAndStoreProfilePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new ProfileMediaError('permission');
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || (asset.fileSize ?? 0) > SOURCE_LIMIT)
    throw new ProfileMediaError('too_large');
  try {
    const image = await ImageManipulator.manipulate(asset.uri)
      .resize({ height: AVATAR_SIZE, width: AVATAR_SIZE })
      .renderAsync();
    const saved = await image.saveAsync({
      compress: 0.82,
      format: SaveFormat.JPEG,
    });
    const source = new File(saved.uri);
    if ((source.size ?? OUTPUT_LIMIT + 1) > OUTPUT_LIMIT)
      throw new ProfileMediaError('too_large');
    const destination = new File(profileDirectory(), 'avatar-draft.jpg');
    if (destination.exists) destination.delete();
    source.copy(destination);
    return destination.uri;
  } catch (error) {
    if (error instanceof ProfileMediaError) throw error;
    throw new ProfileMediaError('processing');
  }
}

export function commitLocalProfilePhoto(draftUri: string): string {
  const draft = new File(draftUri);
  const destination = new File(profileDirectory(), 'avatar.jpg');
  if (destination.exists) destination.delete();
  draft.copy(destination);
  if (draft.exists) draft.delete();
  return destination.uri;
}

export function removeLocalProfilePhoto(uri: string | null): void {
  if (!uri?.startsWith(Paths.document.uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export async function uploadPrivateProfilePhoto(
  userId: string,
  localUri: string
): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new ProfileMediaError('upload');
  const file = new File(localUri);
  const path = profileMediaPath(userId);
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw new ProfileMediaError('upload');
  const { error: metadataError } = await client.auth.updateUser({
    data: { avatar_path: path },
  });
  if (metadataError) throw new ProfileMediaError('upload');
  return path;
}

export async function removePrivateProfilePhoto(userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const path = profileMediaPath(userId);
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw new ProfileMediaError('upload');
  const { error: metadataError } = await client.auth.updateUser({
    data: { avatar_path: null },
  });
  if (metadataError) throw new ProfileMediaError('upload');
}

export async function downloadPrivateProfilePhoto(
  userId: string,
  path: string
): Promise<string> {
  const client = getSupabaseClient();
  const expectedPath = profileMediaPath(userId);
  if (!client || path !== expectedPath) throw new ProfileMediaError('upload');
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data || data.size > OUTPUT_LIMIT)
    throw new ProfileMediaError('upload');
  const destination = new File(profileDirectory(), 'avatar.jpg');
  if (destination.exists) destination.delete();
  destination.write(new Uint8Array(await data.arrayBuffer()));
  return destination.uri;
}
