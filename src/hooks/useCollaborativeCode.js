import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { updateInterviewCode } from '../services/interviewService';
import { CODE_TEMPLATES } from '../utils/codeTemplates';

export function useCollaborativeCode({ 
  interviewId, 
  userId, 
  questionId = null,
  initialCode = '', 
  initialLanguage = 'python',
  starterCodeByLang = null 
}) {
  const [language, setLanguage] = useState(initialLanguage || 'python');
  const [code, setCode] = useState(initialCode || CODE_TEMPLATES[initialLanguage || 'python'] || '');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'remote'
  
  const channelRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isReceivingRemoteRef = useRef(false);
  const currentQuestionIdRef = useRef(questionId);
  const codeCacheRef = useRef({}); // questionId -> { code, language }

  useEffect(() => {
    currentQuestionIdRef.current = questionId;
  }, [questionId]);

  // When switching questions, restore cached code or load question's starter template
  useEffect(() => {
    if (!questionId) return;

    if (codeCacheRef.current[questionId]) {
      const cached = codeCacheRef.current[questionId];
      setCode(cached.code);
      if (cached.language) setLanguage(cached.language);
    } else {
      let defaultTemplate = '';
      if (starterCodeByLang && starterCodeByLang[language]) {
        defaultTemplate = starterCodeByLang[language];
      } else if (CODE_TEMPLATES[language]) {
        defaultTemplate = CODE_TEMPLATES[language];
      }
      setCode(defaultTemplate);
      codeCacheRef.current[questionId] = { code: defaultTemplate, language };
    }
  }, [questionId]);

  // Sync initial values when loaded from database
  useEffect(() => {
    if (initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage);
    }
    if (initialCode !== undefined && initialCode !== null && initialCode !== '') {
      setCode(initialCode);
      if (questionId) {
        codeCacheRef.current[questionId] = { code: initialCode, language: initialLanguage || language };
      }
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

        // If payload is for another question, cache it without altering current view
        if (payload.questionId && payload.questionId !== currentQuestionIdRef.current) {
          codeCacheRef.current[payload.questionId] = {
            code: payload.code,
            language: payload.language || 'python',
          };
          return;
        }

        isReceivingRemoteRef.current = true;
        setSyncStatus('remote');

        if (payload.code !== undefined) {
          setCode(payload.code);
          if (currentQuestionIdRef.current) {
            codeCacheRef.current[currentQuestionIdRef.current] = {
              code: payload.code,
              language: payload.language || language,
            };
          }
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

        if (payload.questionId && payload.questionId !== currentQuestionIdRef.current) {
          if (codeCacheRef.current[payload.questionId]) {
            codeCacheRef.current[payload.questionId].language = payload.language;
            if (payload.code !== undefined) codeCacheRef.current[payload.questionId].code = payload.code;
          }
          return;
        }

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
    if (currentQuestionIdRef.current) {
      codeCacheRef.current[currentQuestionIdRef.current] = {
        code: newCode,
        language,
      };
    }

    // If change was triggered remotely, don't broadcast it back (loop prevention)
    if (isReceivingRemoteRef.current) return;

    // Broadcast immediately to peer
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'code-change',
        payload: {
          senderId: userId,
          questionId: currentQuestionIdRef.current,
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
    let templateForLang = starterCodeByLang?.[newLang] || CODE_TEMPLATES[newLang];
    const isDefaultOrEmpty = !code.trim() || Object.values(CODE_TEMPLATES).some(t => t.trim() === code.trim());
    if (isDefaultOrEmpty && templateForLang) {
      updatedCode = templateForLang;
      setCode(updatedCode);
    }

    if (currentQuestionIdRef.current) {
      codeCacheRef.current[currentQuestionIdRef.current] = {
        code: updatedCode,
        language: newLang,
      };
    }

    if (isReceivingRemoteRef.current) return;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'language-change',
        payload: {
          senderId: userId,
          questionId: currentQuestionIdRef.current,
          language: newLang,
          code: updatedCode,
        },
      });
    }

    persistToDatabase(updatedCode, newLang);
  };

  // Reset to default template
  const resetToTemplate = () => {
    const template = starterCodeByLang?.[language] || CODE_TEMPLATES[language] || '';
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
