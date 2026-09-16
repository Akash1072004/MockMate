import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../utils/apiConfig';

/**
 * Validates and uploads an avatar picture file.
 * 
 * Supports:
 * - Direct client-side upload to Supabase Storage bucket 'avatars'
 * - Automatic fallback to backend authenticated endpoint /api/profile/upload-avatar
 * - Client-side validation: formats (JPG, PNG, WebP), max size (5 MB)
 */
export async function uploadAvatar({ userId, file }) {
  if (!userId) {
    throw new Error('User ID is required to upload a profile picture.');
  }
  if (!file) {
    throw new Error('Please select an image file.');
  }

  // Validate file size: 5MB
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Image file is too large. Maximum allowed size is 5 MB.');
  }

  // Validate format
  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
  if (!validMimes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Please upload a JPG, JPEG, PNG, or WebP image.');
  }

  const ext = file.name.split('.').pop() || 'png';
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
  const storagePath = `${userId}/avatar_${Date.now()}.${cleanExt}`;

  // 1. Attempt client-side direct upload
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (!error && data) {
        const { data: pubData } = supabase.storage
          .from('avatars')
          .getPublicUrl(storagePath);

        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      } else if (error) {
        console.warn('[avatarService] Direct client upload notice:', error.message);
      }
    } catch (err) {
      console.warn('[avatarService] Direct client upload threw, falling back to server:', err.message);
    }
  }

  // 2. Server-side authenticated fallback
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Authentication session expired. Please sign in again.');
    }

    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/profile/upload-avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: file.type,
        fileName: file.name,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server upload failed with status ${response.status}`);
    }

    const result = await response.json();
    if (result.avatarUrl) {
      return result.avatarUrl;
    }

    throw new Error('Server upload did not return a valid avatar URL');
  } catch (backendErr) {
    console.error('[avatarService] Avatar upload failed completely:', backendErr);
    throw new Error(backendErr.message || 'Failed to upload profile picture.');
  }
}
