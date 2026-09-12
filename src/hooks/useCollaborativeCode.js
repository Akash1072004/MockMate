import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { updateInterviewCode } from '../services/interviewService';
import { CODE_TEMPLATES } from '../utils/codeTemplates';

export function useCollaborativeCode({ interviewId, userId, initialCode, initialLanguage }) {
  const [language, setLanguage] = useState(initialLanguage || 'python');
  const [code, setCode] = useState(initialCode || CODE_TEMPLATES[initialLanguage || 'python'] || '');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'remote'
  
  const channelRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isReceivingRemoteRef = useRef(false);

  // Sync initial values when loaded from database
  useEffect(() => {
    if (initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage);
    }
    if (initialCode !== undefined && initialCode !== null && initialCode !== '') {
      setCode(initialCode);
    }
  }, [initialCode, initialLanguage]);

  // Realtime Broadcast Channel Setup
  useEffect(() => {
    if (!interviewId || !userId || !supabase) return;

    const channel = supabase.channel(`interview_code_${interviewId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'code-change' }, ({ payload }) => {
        if (!payload || payload.senderId === userId) return;

        isReceivingRemoteRef.current = true;
        setSyncStatus('remote');

        if (payload.code !== undefined) {
          setCode(payload.code);
        }
        if (payload.language && payload.language !== language) {
          setLanguage(payload.language);
        }

        setTimeout(() => {
          isReceivingRemoteRef.current = false;
          setSyncStatus('synced');
        }, 300);
      })
      .on('broadcast', { event: 'language-change' }, ({ payload }) => {
        if (!payload || payload.senderId === userId) return;

        isReceivingRemoteRef.current = true;
        setSyncStatus('remote');

        if (payload.language) {
          setLanguage(payload.language);
        }
        if (payload.code !== undefined) {
          setCode(payload.code);
        }

        setTimeout(() => {
          isReceivingRemoteRef.current = false;
          setSyncStatus('synced');
        }, 300);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[CollaborativeCode] Realtime channel connected for room ${interviewId}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [interviewId, userId]);

  // Debounced database persistence function
  const persistToDatabase = useCallback((codeToSave, langToSave) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSyncStatus('syncing');

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await updateInterviewCode(interviewId, codeToSave, langToSave);
        setSyncStatus('synced');
      } catch (err) {
        console.error('[CollaborativeCode] Failed to persist code to Supabase:', err);
        setSyncStatus('synced');
      }
    }, 1200);
  }, [interviewId]);

  // Local user updates code
  const handleCodeChange = (newCode) => {
    setCode(newCode);

    // If change was triggered remotely, don't broadcast it back (loop prevention)
    if (isReceivingRemoteRef.current) return;

    // Broadcast immediately to peer
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'code-change',
        payload: {
          senderId: userId,
          code: newCode,
          language,
        },
      });
    }

    // Schedule debounced database persistence
    persistToDatabase(newCode, language);
  };

  // Local user updates programming language
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);

    // If current code is empty or matches previous starter template, load new template
    let updatedCode = code;
    const isDefaultOrEmpty = !code.trim() || Object.values(CODE_TEMPLATES).some(t => t.trim() === code.trim());
    if (isDefaultOrEmpty && CODE_TEMPLATES[newLang]) {
      updatedCode = CODE_TEMPLATES[newLang];
      setCode(updatedCode);
    }

    if (isReceivingRemoteRef.current) return;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'language-change',
        payload: {
          senderId: userId,
          language: newLang,
          code: updatedCode,
        },
      });
    }

    persistToDatabase(updatedCode, newLang);
  };

  // Reset to default template
  const resetToTemplate = () => {
    const template = CODE_TEMPLATES[language] || '';
    handleCodeChange(template);
  };

  return {
    code,
    language,
    syncStatus,
    setCode: handleCodeChange,
    setLanguage: handleLanguageChange,
    resetToTemplate,
  };
}
