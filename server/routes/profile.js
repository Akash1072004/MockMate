import express from 'express';
import { supabaseAdmin } from '../services/supabaseAdmin.js';

const router = express.Router();

/**
 * POST /api/profile/upload-avatar
 * Authenticated endpoint: verifies JWT bearer token to authenticate caller,
 * then uploads avatar image to 'avatars' storage bucket using supabaseAdmin.
 */
router.post('/upload-avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split(' ')[1];
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin service not configured' });
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { imageBase64, mimeType = 'image/png' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check size limit: 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum limit of 5 MB' });
    }

    const ext = mimeType.split('/')[1] || 'png';
    const storagePath = `${user.id}/avatar_${Date.now()}.${ext}`;

    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.some(b => b.id === 'avatars')) {
      await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'],
      });
    }

    // Upload using service role
    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (upErr) {
      console.error('[profileRoute] Storage upload error:', upErr);
      return res.status(500).json({ error: upErr.message || 'Failed to upload avatar to storage' });
    }

    // Clean up older avatars for this user
    try {
      const { data: userFiles } = await supabaseAdmin.storage
        .from('avatars')
        .list(user.id);

      if (userFiles && userFiles.length > 0) {
        const oldFiles = userFiles
          .filter(f => `${user.id}/${f.name}` !== storagePath)
          .map(f => `${user.id}/${f.name}`);

        if (oldFiles.length > 0) {
          await supabaseAdmin.storage.from('avatars').remove(oldFiles);
        }
      }
    } catch (cleanupErr) {
      console.warn('[profileRoute] Non-critical old avatar cleanup warning:', cleanupErr);
    }

    // Get public URL
    const { data: pubData } = supabaseAdmin.storage.from('avatars').getPublicUrl(storagePath);
    const publicUrl = pubData?.publicUrl;

    // Update profiles row directly
    await supabaseAdmin
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return res.json({ success: true, avatarUrl: publicUrl });
  } catch (err) {
    console.error('[profileRoute] Error uploading avatar:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
