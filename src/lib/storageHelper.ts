import { supabase } from './supabase';

/**
 * Uploads a profile photo to Supabase Storage bucket ('avatars').
 * Returns the public URL of the uploaded image.
 */
export async function uploadProfilePhotoToSupabase(
  fileOrDataUrl: File | Blob | string,
  userId: string
): Promise<string> {
  try {
    let fileBlob: Blob;
    let fileExt = 'jpg';
    let mimeType = 'image/jpeg';

    if (typeof fileOrDataUrl === 'string') {
      if (fileOrDataUrl.startsWith('data:')) {
        const matches = fileOrDataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          fileExt = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
          const byteCharacters = atob(matches[2]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          fileBlob = new Blob([byteArray], { type: mimeType });
        } else {
          return fileOrDataUrl;
        }
      } else {
        // Already a remote URL (https://...)
        return fileOrDataUrl;
      }
    } else {
      fileBlob = fileOrDataUrl;
      if (fileOrDataUrl instanceof File) {
        const parts = fileOrDataUrl.name.split('.');
        if (parts.length > 1) fileExt = parts.pop() || 'jpg';
        if (fileOrDataUrl.type) mimeType = fileOrDataUrl.type;
      }
    }

    const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanUserId}_${Date.now()}.${fileExt}`;
    const filePath = `${cleanUserId}/${fileName}`;

    // Attempt upload to 'avatars' bucket
    let uploadRes = await supabase.storage.from('avatars').upload(filePath, fileBlob, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: true
    });

    // If bucket does not exist or first upload failed, attempt creation
    if (uploadRes.error) {
      console.warn('First avatar upload attempt note:', uploadRes.error.message);
      try {
        await supabase.storage.createBucket('avatars', { public: true });
        uploadRes = await supabase.storage.from('avatars').upload(filePath, fileBlob, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true
        });
      } catch (bucketErr) {
        console.warn('Bucket creation note:', bucketErr);
      }
    }

    // Try 'public' bucket if 'avatars' failed
    if (uploadRes.error) {
      const publicUpload = await supabase.storage.from('public').upload(filePath, fileBlob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true
      });
      if (!publicUpload.error) {
        const { data: pubData } = supabase.storage.from('public').getPublicUrl(filePath);
        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      }
    }

    if (!uploadRes.error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }

    // Fallback: If Supabase Storage is not provisioned or RLS blocked, return the base64 / dataUrl
    if (typeof fileOrDataUrl === 'string') {
      return fileOrDataUrl;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileBlob);
    });
  } catch (err) {
    console.warn('Upload profile photo fallback:', err);
    if (typeof fileOrDataUrl === 'string') return fileOrDataUrl;
    return '';
  }
}

/**
 * Uploads a publication media (photo or video) to Supabase Storage.
 * Tries 'publications', then 'avatars', then 'public' buckets.
 * Returns the public URL.
 */
export async function uploadPublicationMediaToSupabase(
  fileOrBlob: File | Blob,
  userId: string,
  mediaType: 'image' | 'video' = 'image'
): Promise<string> {
  try {
    let fileExt = mediaType === 'video' ? 'mp4' : 'jpg';
    let mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

    if (fileOrBlob instanceof File) {
      const parts = fileOrBlob.name.split('.');
      if (parts.length > 1) fileExt = parts.pop() || fileExt;
      if (fileOrBlob.type) mimeType = fileOrBlob.type;
    } else if (fileOrBlob.type) {
      mimeType = fileOrBlob.type;
      if (mimeType.includes('png')) fileExt = 'png';
      else if (mimeType.includes('webp')) fileExt = 'webp';
      else if (mimeType.includes('mp4')) fileExt = 'mp4';
      else if (mimeType.includes('webm')) fileExt = 'webm';
      else if (mimeType.includes('quicktime') || mimeType.includes('mov')) fileExt = 'mov';
    }

    const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `posts/${cleanUserId}/${fileName}`;

    // 1. Try 'publications' bucket
    const targetBuckets = ['publications', 'avatars', 'public'];
    for (const bucket of targetBuckets) {
      try {
        const uploadRes = await supabase.storage.from(bucket).upload(filePath, fileOrBlob, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true
        });

        if (!uploadRes.error) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
          if (data?.publicUrl) {
            return data.publicUrl;
          }
        }
      } catch (err) {
        console.warn(`Upload to bucket ${bucket} error:`, err);
      }
    }

    // Fallback: If upload failed, read as Data URL if file is not huge (< 4MB)
    if (fileOrBlob.size < 4 * 1024 * 1024) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileOrBlob);
      });
    }

    return '';
  } catch (err) {
    console.error('uploadPublicationMediaToSupabase error:', err);
    return '';
  }
}
