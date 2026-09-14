import { supabase } from '../lib/supabase';

/**
 * Service to manage candidate resumes securely using Supabase Storage.
 * - Files are stored in a private Supabase Storage bucket ('resumes').
 * - Metadata & extracted text for AI are indexed in 'public.resumes'.
 * - Access is protected by Row Level Security (RLS) on both storage and metadata.
 */

// Common tech skills dictionary for resume keyword extraction
const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'FastAPI',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'Linux',
  'Algorithms', 'Data Structures', 'System Design', 'Distributed Systems', 'Microservices', 'Machine Learning'
];

/**
 * Extracts printable plain text and detected skills from a resume file.
 */
export async function parseResumeFile(file) {
  if (!file) return { text: '', skills: [] };

  try {
    let extractedText = '';

    if (file.type === 'application/pdf') {
      // Extract readable ASCII and text streams from PDF buffer
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let ascii = '';
      for (let i = 0; i < bytes.length; i++) {
        const c = bytes[i];
        // Keep printable ASCII, newlines, and tabs
        if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) {
          ascii += String.fromCharCode(c);
        } else {
          ascii += ' ';
        }
      }

      // Extract alphanumeric text sequences longer than 3 characters
      const matches = ascii.match(/[A-Za-z0-9+#./_ -]{4,}/g) || [];
      const cleanTokens = matches
        .map((t) => t.trim())
        .filter((t) => t.length > 3 && !/^(stream|endstream|obj|endobj|xref|trailer|startxref)/i.test(t));
      
      extractedText = cleanTokens.slice(0, 300).join(' ');
      if (!extractedText.trim()) {
        extractedText = `PDF Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }
    } else {
      // Plain text, markdown, doc/txt
      extractedText = await file.text();
    }

    // Detect skills matching candidate text
    const lowerText = extractedText.toLowerCase();
    const skills = COMMON_SKILLS.filter((skill) =>
      lowerText.includes(skill.toLowerCase())
    );

    return {
      text: extractedText.trim(),
      skills,
    };
  } catch (err) {
    console.warn('[resumeService] Error extracting text from file:', err);
    return {
      text: `Resume Document: ${file.name}`,
      skills: [],
    };
  }
}

/**
 * Upload or replace a candidate's resume in Supabase Storage and record metadata.
 */
export async function uploadResume({ userId, file, customText = '' }) {
  if (!userId) throw new Error('User ID is required to upload a resume.');
  if (!file && !customText) throw new Error('Please provide a resume file or text content.');

  // Parse text and skills
  let parsed = { text: customText, skills: [] };
  if (file) {
    parsed = await parseResumeFile(file);
    if (customText) {
      parsed.text = `${customText}\n\n${parsed.text}`;
    }
  }

  const fileName = file ? file.name : 'Resume.txt';
  const fileType = file ? file.type || 'application/octet-stream' : 'text/plain';
  const fileSize = file ? file.size : parsed.text.length;

  // Clean filename for safe storage key: <userId>/<timestamp>_<cleanName>
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}_${cleanName}`;

  // 1. Upload the file to private Supabase Storage bucket 'resumes'
  try {
    const uploadPayload = file || new Blob([parsed.text], { type: 'text/plain' });
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, uploadPayload, {
        cacheControl: '3600',
        upsert: true,
        contentType: fileType,
      });

    if (uploadError) {
      console.error('[resumeService] Storage upload failed:', uploadError);
      throw new Error(`Failed to upload resume file to storage: ${uploadError.message}`);
    }
  } catch (storageErr) {
    console.error('[resumeService] Storage exception:', storageErr);
    throw storageErr;
  }

  // 2. Check and clean up previous storage file if replacing
  try {
    const { data: previous } = await supabase
      .from('resumes')
      .select('storage_path')
      .eq('candidate_id', userId)
      .maybeSingle();

    if (previous?.storage_path && previous.storage_path !== storagePath) {
      await supabase.storage.from('resumes').remove([previous.storage_path]);
    }
  } catch (cleanupErr) {
    console.warn('[resumeService] Non-critical error cleaning old resume:', cleanupErr);
  }

  // 3. Upsert metadata in public.resumes table
  const { data: resumeRow, error: upsertError } = await supabase
    .from('resumes')
    .upsert(
      {
        candidate_id: userId,
        filename: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
        extracted_text: parsed.text || '',
        skills_extracted: parsed.skills || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'candidate_id' }
    )
    .select()
    .single();

  if (upsertError) {
    console.error('[resumeService] Metadata upsert failed:', upsertError);
    throw new Error(`Failed to save resume record: ${upsertError.message}`);
  }

  // 4. Generate temporary signed URL for immediate preview
  const signedUrl = await getResumeDownloadUrl(storagePath);

  return {
    success: true,
    id: resumeRow?.id,
    candidateId: userId,
    fileName,
    fileType,
    fileSize,
    storagePath,
    rawText: parsed.text,
    extractedText: parsed.text,
    skills: parsed.skills,
    signedUrl,
    dataUrl: signedUrl,
  };
}

/**
 * Retrieve candidate resume metadata and generate a secure temporary signed URL.
 * Protected by RLS: caller must be the candidate or an assigned interviewer.
 */
export async function getCandidateResume(candidateId) {
  if (!candidateId) return null;

  try {
    const { data: resumeRow, error: resumeErr } = await supabase
      .from('resumes')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (resumeErr || !resumeRow) {
      return null;
    }

    // Generate secure temporary signed URL from Supabase Storage (valid for 1 hour)
    const signedUrl = await getResumeDownloadUrl(resumeRow.storage_path);

    return {
      id: resumeRow.id,
      candidateId: resumeRow.candidate_id,
      fileName: resumeRow.filename,
      fileType: resumeRow.file_type,
      fileSize: resumeRow.file_size,
      storagePath: resumeRow.storage_path,
      rawText: resumeRow.extracted_text,
      extractedText: resumeRow.extracted_text,
      skills: resumeRow.skills_extracted || [],
      signedUrl,
      dataUrl: signedUrl,
      updatedAt: resumeRow.updated_at,
    };
  } catch (err) {
    console.warn('[resumeService] getCandidateResume error:', err.message);
    return null;
  }
}

/**
 * Generate a secure, time-limited signed URL for a resume storage path.
 * Returns null if path is invalid or expired.
 */
export async function getResumeDownloadUrl(storagePath, expiresInSeconds = 3600) {
  if (!storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.warn('[resumeService] createSignedUrl error:', error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (e) {
    console.warn('[resumeService] Exception generating signed URL:', e);
    return null;
  }
}

/**
 * Check if candidate has a resume available before starting an interview.
 */
export async function hasResume(candidateId) {
  if (!candidateId) return false;
  try {
    const { data, error } = await supabase
      .from('resumes')
      .select('id, storage_path')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    return Boolean(!error && data && data.id);
  } catch {
    return false;
  }
}

/**
 * Delete candidate's resume from both Supabase Storage and public.resumes.
 */
export async function deleteResume(userId) {
  if (!userId) return false;

  try {
    const { data: existing } = await supabase
      .from('resumes')
      .select('storage_path')
      .eq('candidate_id', userId)
      .maybeSingle();

    if (existing?.storage_path) {
      await supabase.storage.from('resumes').remove([existing.storage_path]);
    }

    await supabase.from('resumes').delete().eq('candidate_id', userId);
    return true;
  } catch (e) {
    console.error('[resumeService] deleteResume error:', e);
    return false;
  }
}
