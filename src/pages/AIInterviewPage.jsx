import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  startAIInterview, 
  saveCandidateAnswer, 
  completeInterviewSession, 
  sendAITurn,
  AI_STAGE_DEFINITIONS,
  getActiveAIInterview,
  getAIInterviewById,
  archiveCandidateActiveAIInterviews
} from '../services/aiInterviewService';
import { requestEvaluation } from '../services/evaluationService';
import { getCandidateResume, hasResume } from '../services/resumeService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import CollaborativeCodeEditor from '../components/interview/CollaborativeCodeEditor';
import InterviewStageSidebar from '../components/interview/InterviewStageSidebar';
import LeetCodeQuestionPanel from '../components/interview/LeetCodeQuestionPanel';
import { CODE_TEMPLATES } from '../utils/codeTemplates';
import {
  CURATED_CODING_PROBLEMS,
  selectCodingProblem,
  DEFAULT_CODING_PROBLEM,
  getStarterCodeForProblem
} from '../utils/codingProblems';
import { 
  Bot, 
  Sparkles, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  FileText, 
  Play, 
  RotateCw,
  Send,
  Volume2,
  VolumeX,
  Award,
  ChevronRight,
  Mic,
  MicOff,
  Keyboard,
  Edit3,
  Check,
  User,
  MessageSquare,
  Maximize2,
  Minimize2,
  HelpCircle
} from 'lucide-react';

const TRACK_OPTIONS = ['DSA', 'Technical', 'Frontend', 'Backend', 'Full Stack', 'Behavioral'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const DURATION_OPTIONS = [
  { value: 15, label: '15 Mins (Fast Track)' },
  { value: 30, label: '30 Mins (Standard Mock)' },
  { value: 45, label: '45 Mins (In-Depth Mock)' },
];

export const STAGES = [
  { key: 'introduction', label: '1. Introduction', desc: 'Greeting & format overview' },
  { key: 'personal', label: '2. Background', desc: 'Tell me about yourself' },
  { key: 'resume_dive', label: '3. Resume Discussion', desc: 'Deep dive into projects' },
  { key: 'technical', label: '4. Technical Concepts', desc: 'Architecture & trade-offs' },
  { key: 'coding', label: '5. Live Coding', desc: 'Algorithm challenge' },
  { key: 'followup', label: '6. Complexity & Scaling', desc: 'Time, space & optimizations' },
  { key: 'evaluation', label: '7. Final Evaluation', desc: 'Performance debrief' },
];

const STAGE_ORDER = ['introduction', 'personal', 'resume_dive', 'technical', 'coding', 'followup', 'evaluation'];

const FOLLOWUP_ELIGIBLE_STAGES = ['resume_dive', 'technical', 'followup'];
const MAX_FOLLOWUPS_PER_STAGE = 1;

const SESSION_STORAGE_KEY = 'mockmate_ai_interview_active_session';

export default function AIInterviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Resume state & pre-flight
  const [hasCandidateResume, setHasCandidateResume] = useState(null);
  const [candidateResume, setCandidateResume] = useState(null);
  const [checkingResume, setCheckingResume] = useState(true);

  // Setup state
  const [inSession, setInSession] = useState(false);
  const [interviewType, setInterviewType] = useState('DSA');
  const [difficulty, setDifficulty] = useState('Medium');
  const [duration, setDuration] = useState(30);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Active session conversational state (Authoritative State Machine)
  const [interview, setInterview] = useState(null);
  const [currentStage, setCurrentStage] = useState('introduction');
  const [messages, setMessages] = useState([]);
  const [qaHistory, setQaHistory] = useState([]);
  const [stageFollowUpCount, setStageFollowUpCount] = useState(0);
  const [questionsMap, setQuestionsMap] = useState({});
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [inputMode, setInputMode] = useState('speak');

  // Coding stage state - single source of truth for problem, language, and code preservation
  const [activeCodingProblem, setActiveCodingProblem] = useState(DEFAULT_CODING_PROBLEM);
  const [language, setLanguage] = useState('python');
  const [codeByLanguage, setCodeByLanguage] = useState({
    python: DEFAULT_CODING_PROBLEM.starter_code.python,
    cpp: DEFAULT_CODING_PROBLEM.starter_code.cpp,
    java: DEFAULT_CODING_PROBLEM.starter_code.java,
    javascript: DEFAULT_CODING_PROBLEM.starter_code.javascript,
  });
  const [code, setCode] = useState(DEFAULT_CODING_PROBLEM.starter_code.python);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [showAiChatInCoding, setShowAiChatInCoding] = useState(true);
  // Manual coding editor toggle state (separate from authoritative currentStage)
  const [codingEditorOpen, setCodingEditorOpen] = useState(false);
  const isEditorVisible = currentStage === 'coding' || codingEditorOpen;
  // UI-only LeetCode-style expanded workspace state (leaves AI interview & state machine unchanged)
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [stageSidebarCollapsed, setStageSidebarCollapsed] = useState(false);

  // Keyboard shortcut: Esc to exit fullscreen editor
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && editorExpanded) {
        setEditorExpanded(false);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorExpanded]);

  // Resizable Problem Statement panel (Top Problem Statement <-> Monaco Code Editor)
  const [problemHeight, setProblemHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('mockmate_problem_height');
      const num = Number(saved);
      return !isNaN(num) && num >= 90 && num <= 450 ? num : 200;
    } catch (_) {
      return 200;
    }
  });
  const [problemCollapsed, setProblemCollapsed] = useState(false);
  const [isResizingProblem, setIsResizingProblem] = useState(false);
  const problemResizeStartYRef = useRef(0);
  const problemResizeStartHRef = useRef(200);

  const handleMouseDownProblemResize = (e) => {
    e.preventDefault();
    setIsResizingProblem(true);
    problemResizeStartYRef.current = e.clientY;
    problemResizeStartHRef.current = problemHeight;
  };

  useEffect(() => {
    if (!isResizingProblem) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - problemResizeStartYRef.current;
      const newHeight = Math.max(80, Math.min(problemResizeStartHRef.current + deltaY, 450));
      setProblemHeight(newHeight);
      try {
        localStorage.setItem('mockmate_problem_height', String(newHeight));
      } catch (_) {}
    };

    const handleMouseUp = () => {
      setIsResizingProblem(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingProblem]);

  // STRICT In-flight and completion guards to avoid race conditions & duplicate API requests
  const inFlightRef = useRef(false);
  const completedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const currentStageRef = useRef(currentStage);
  const stageFollowUpCountRef = useRef(stageFollowUpCount);
  const messagesRef = useRef(messages);
  const interviewRef = useRef(interview);
  const qaHistoryRef = useRef(qaHistory);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const codeByLanguageRef = useRef(codeByLanguage);
  const activeCodingProblemRef = useRef(activeCodingProblem);

  // Authoritative Finish & Exit Controls
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [finishingStep, setFinishingStep] = useState(''); // 'saving' | 'preparing' | 'evaluating' | 'finalizing' | 'complete'
  const finishInFlightRef = useRef(false);
  const hasSubmittedCodeRef = useRef(false);
  const hasSkippedCodeRef = useRef(false);

  useEffect(() => { currentStageRef.current = currentStage; }, [currentStage]);
  useEffect(() => { stageFollowUpCountRef.current = stageFollowUpCount; }, [stageFollowUpCount]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { interviewRef.current = interview; }, [interview]);
  useEffect(() => { qaHistoryRef.current = qaHistory; }, [qaHistory]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { codeByLanguageRef.current = codeByLanguage; }, [codeByLanguage]);
  useEffect(() => { activeCodingProblemRef.current = activeCodingProblem; }, [activeCodingProblem]);

  // Speech-to-text hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Text-to-speech helper
  const speakText = useCallback((text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[AIInterviewPage] Speech synthesis warning:', e);
    }
  }, [voiceEnabled]);

  // Helper to obtain starter code for a specific language and problem
  const getStarterCode = useCallback((lang, problem) => {
    const prob = problem || activeCodingProblemRef.current || DEFAULT_CODING_PROBLEM;
    return getStarterCodeForProblem(prob, lang) || prob?.starter_code?.[lang] || CODE_TEMPLATES[lang] || '';
  }, []);

  // Language Change Handler with Code Preservation across switches (Python <-> C++ <-> Java)
  const handleLanguageChange = useCallback((newLang) => {
    const currentLang = languageRef.current;
    const currentEditorCode = codeRef.current;

    // 1. Save current code for previous language
    const updatedCodeByLang = {
      ...codeByLanguageRef.current,
      [currentLang]: currentEditorCode,
    };

    // 2. Fetch or initialize code for target language
    const targetCode = updatedCodeByLang[newLang] !== undefined
      ? updatedCodeByLang[newLang]
      : getStarterCode(newLang, activeCodingProblemRef.current);

    updatedCodeByLang[newLang] = targetCode;

    // 3. Atomically update state
    setCodeByLanguage(updatedCodeByLang);
    setLanguage(newLang);
    setCode(targetCode);

    languageRef.current = newLang;
    codeRef.current = targetCode;
    codeByLanguageRef.current = updatedCodeByLang;
  }, [getStarterCode]);

  // Reset to default boilerplate for current language
  const handleResetTemplate = useCallback(() => {
    const curLang = languageRef.current;
    const freshStarter = getStarterCode(curLang, activeCodingProblemRef.current);

    setCodeByLanguage((prev) => ({
      ...prev,
      [curLang]: freshStarter,
    }));
    setCode(freshStarter);
    codeRef.current = freshStarter;
  }, [getStarterCode]);

  // Handle editor code edits
  const handleCodeChange = useCallback((newVal) => {
    const curLang = languageRef.current;
    setCode(newVal);
    codeRef.current = newVal;
    setCodeByLanguage((prev) => ({
      ...prev,
      [curLang]: newVal,
    }));
  }, []);

  // Save session recovery snapshot to sessionStorage
  const persistSessionSnapshot = useCallback((sessionData) => {
    try {
      if (completedRef.current) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (err) {
      console.warn('[AIInterviewPage] Failed to save session snapshot:', err);
    }
  }, []);

  // Check resume pre-flight requirement on mount & attempt authoritative session restoration
  useEffect(() => {
    let isMounted = true;
    if (user?.id) {
      hasResume(user.id)
        .then((ok) => {
          if (isMounted) {
            setHasCandidateResume(ok);
            if (ok) {
              getCandidateResume(user.id).then((res) => {
                if (isMounted) setCandidateResume(res);
              });
            }
          }
        })
        .finally(() => {
          if (isMounted) setCheckingResume(false);
        });

      // Authoritative Session Recovery:
      const checkAndRestore = async () => {
        try {
          const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
          let saved = null;
          if (raw) {
            try { saved = JSON.parse(raw); } catch (e) {}
          }

          let authoritativeInterview = null;

          // 1. Check if saved session in sessionStorage matches an interview in DB
          if (saved?.interview?.id && saved.userId === user.id) {
            authoritativeInterview = await getAIInterviewById(saved.interview.id);
          }

          // 2. If no saved session in storage, check DB for an active AI interview for user
          if (!authoritativeInterview) {
            authoritativeInterview = await getActiveAIInterview(user.id);
          }

          if (!authoritativeInterview || !isMounted) return;

          // 3. Database state takes precedence: If DB status is completed, never resurrect as active!
          if (authoritativeInterview.status === 'completed') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            navigate(`/interview/results/${authoritativeInterview.id}`);
            return;
          }

          // 4. If DB status is active, restore active session safely
          if (authoritativeInterview.status === 'active') {
            setInterview(authoritativeInterview);
            interviewRef.current = authoritativeInterview;

            if (saved && saved.interview?.id === authoritativeInterview.id && !saved.completed) {
              setCurrentStage(saved.currentStage || 'introduction');
              currentStageRef.current = saved.currentStage || 'introduction';
              setStageFollowUpCount(saved.stageFollowUpCount || 0);
              stageFollowUpCountRef.current = saved.stageFollowUpCount || 0;
              setMessages(saved.messages || []);
              messagesRef.current = saved.messages || [];
              setQaHistory(saved.qaHistory || []);
              qaHistoryRef.current = saved.qaHistory || [];
              setQuestionsMap(saved.questionsMap || {});

              const prob = saved.activeCodingProblem || DEFAULT_CODING_PROBLEM;
              setActiveCodingProblem(prob);
              activeCodingProblemRef.current = prob;

              const savedLang = saved.language || 'python';
              setLanguage(savedLang);
              languageRef.current = savedLang;

              const savedCodeByLang = saved.codeByLanguage || {
                [savedLang]: saved.code || prob?.starter_code?.[savedLang] || CODE_TEMPLATES[savedLang] || '',
              };
              setCodeByLanguage(savedCodeByLang);
              codeByLanguageRef.current = savedCodeByLang;

              const currentCode = saved.code || savedCodeByLang[savedLang] || prob?.starter_code?.[savedLang] || '';
              setCode(currentCode);
              codeRef.current = currentCode;

              setInterviewType(saved.interviewType || authoritativeInterview.interview_type || 'DSA');
              setDifficulty(saved.difficulty || authoritativeInterview.difficulty || 'Medium');
              setDuration(saved.duration || authoritativeInterview.duration || 30);
              setElapsedSeconds(saved.elapsedSeconds || 0);

              if (saved.codingOutcome === 'submitted') hasSubmittedCodeRef.current = true;
              if (saved.codingOutcome === 'skipped') hasSkippedCodeRef.current = true;
            } else {
              setInterviewType(authoritativeInterview.interview_type || 'DSA');
              setDifficulty(authoritativeInterview.difficulty || 'Medium');
              setDuration(authoritativeInterview.duration || 30);
              setCurrentStage('introduction');
              const prob = selectCodingProblem({ difficulty: authoritativeInterview.difficulty, track: authoritativeInterview.interview_type });
              setActiveCodingProblem(prob);
              activeCodingProblemRef.current = prob;
            }

            setInSession(true);
          }
        } catch (err) {
          console.warn('[AIInterviewPage] Session recovery check failed:', err);
        }
      };

      checkAndRestore();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, navigate]);

  // Warn candidate on unexpected window close/refresh while interview is actively running
  useEffect(() => {
    if (!inSession) return;
    const handleBeforeUnload = (e) => {
      if (completedRef.current) return;
      e.preventDefault();
      e.returnValue = 'Your AI interview is still in progress. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [inSession]);

  // Timer: isolated from phase state machine
  useEffect(() => {
    if (!inSession || completedRef.current) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (interviewRef.current && !completedRef.current) {
          persistSessionSnapshot({
            userId: user?.id,
            interview: interviewRef.current,
            currentStage: currentStageRef.current,
            stageFollowUpCount: stageFollowUpCountRef.current,
            messages: messagesRef.current,
            qaHistory: qaHistoryRef.current,
            questionsMap,
            activeCodingProblem: activeCodingProblemRef.current,
            code: codeRef.current,
            language: languageRef.current,
            codeByLanguage: codeByLanguageRef.current,
            interviewType,
            difficulty,
            duration,
            elapsedSeconds: next,
            completed: false,
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [inSession, questionsMap, interviewType, difficulty, duration, persistSessionSnapshot, user?.id]);

  const remainingSeconds = Math.max(0, duration * 60 - elapsedSeconds);
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start interview session
  const handleStartInterview = async (e) => {
    if (e) e.preventDefault();
    if (!user || inFlightRef.current || completing) return;

    if (!hasCandidateResume) {
      setSetupError('Please upload your resume before starting an AI interview.');
      return;
    }

    inFlightRef.current = true;
    finishInFlightRef.current = false;
    hasSubmittedCodeRef.current = false;
    hasSkippedCodeRef.current = false;
    setStarting(true);
    setSetupError('');

    try {
      // Archive any lingering active AI interviews for this candidate before starting
      await archiveCandidateActiveAIInterviews(user.id);
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}. Bio: ${profile?.bio || ''}`;

      const { interview: newInterview, questions: createdQuestions } = await startAIInterview({
        candidateId: user.id,
        candidateName,
        interviewType,
        difficulty,
        duration,
      });

      const qMap = {};
      (createdQuestions || []).forEach((q) => {
        const stageMatch = STAGE_ORDER.find((stg) => (q.question_text || '').toLowerCase().includes(stg));
        if (stageMatch) {
          qMap[stageMatch] = q.id;
        }
      });
      setQuestionsMap(qMap);

      // Select an appropriate coding problem ONCE for this entire interview session
      const selectedProblem = selectCodingProblem({ difficulty, track: interviewType });
      setActiveCodingProblem(selectedProblem);
      activeCodingProblemRef.current = selectedProblem;

      const initialLang = 'python';
      const initialStarter = getStarterCodeForProblem(selectedProblem, initialLang) || selectedProblem.starter_code?.python || '';
      setCode(initialStarter);
      codeRef.current = initialStarter;
      const initialCodeByLang = {
        python: selectedProblem.starter_code?.python || '',
        cpp: selectedProblem.starter_code?.cpp || '',
        java: selectedProblem.starter_code?.java || '',
        javascript: selectedProblem.starter_code?.javascript || '',
      };
      setCodeByLanguage(initialCodeByLang);
      codeByLanguageRef.current = initialCodeByLang;

      setInterview(newInterview);
      setInSession(true);
      setCurrentStage('introduction');
      setStageFollowUpCount(0);
      setIsAiTyping(true);

      const firstTurn = await sendAITurn({
        stage: 'introduction',
        candidateName,
        resumeText: resumeSummary,
        history: [],
        interviewType,
        difficulty,
        intent: 'ask_stage_question',
        followUpCount: 0,
      });

      if (completedRef.current) return;

      const initialMessage = {
        role: 'assistant',
        content: firstTurn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'introduction',
      };

      setMessages([initialMessage]);
      speakText(firstTurn.reply);

      persistSessionSnapshot({
        userId: user.id,
        interview: newInterview,
        currentStage: 'introduction',
        stageFollowUpCount: 0,
        messages: [initialMessage],
        qaHistory: [],
        questionsMap: qMap,
        activeCodingProblem: selectedProblem,
        code: initialStarter,
        language: initialLang,
        codeByLanguage: initialCodeByLang,
        interviewType,
        difficulty,
        duration,
        elapsedSeconds: 0,
        completed: false,
      });
    } catch (err) {
      console.error('[AIInterviewPage] Start error:', err);
      setSetupError(err.message || 'Failed to initialize AI interview.');
    } finally {
      inFlightRef.current = false;
      setStarting(false);
      setIsAiTyping(false);
    }
  };

  /**
   * Candidate sends response in dialogue:
   * - In stages where follow-up is eligible (resume_dive, technical, followup):
   *   If candidate answer needs probing or clarification and followUpCount < MAX_FOLLOWUPS,
   *   the AI asks an intelligent, targeted follow-up question while remaining in the current stage.
   *   Otherwise, the state machine deterministically advances to the next stage.
   * - In stage 5 (Coding): candidate can chat/ask questions with AI WITHOUT leaving coding view.
   */
  const handleSendResponse = async (textToSend) => {
    const trimmed = (textToSend || userInput || '').trim();
    if (!trimmed || inFlightRef.current || completedRef.current || isAiTyping) return;

    inFlightRef.current = true;
    if (isListening) {
      stopListening();
    }
    resetTranscript();

    const currentStageVal = currentStageRef.current;
    const currentFollowUpCount = stageFollowUpCountRef.current;

    const userMsg = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      stage: currentStageVal,
    };

    const updatedHistory = [...messagesRef.current, userMsg];
    setMessages(updatedHistory);
    setUserInput('');
    setIsAiTyping(true);

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}`;

      // Determine state machine transition vs. in-stage follow-up
      let nextStage = currentStageVal;
      let nextFollowUpCount = currentFollowUpCount;
      let intent = 'ask_stage_question';

      const isEligibleForFollowUp = FOLLOWUP_ELIGIBLE_STAGES.includes(currentStageVal);
      const canDoFollowUp = isEligibleForFollowUp && currentFollowUpCount < MAX_FOLLOWUPS_PER_STAGE;

      // In Coding Stage: check if candidate message indicates inability to solve or request to move on
      if (currentStageVal === 'coding') {
        const isSkipIntent = /(can'?t|cannot|unable to|not able to)\s+(solve|figure|code|do|complete)|i'?m stuck|give up|skip (this|the)?\s*(problem|question|coding)|move on|don'?t know how to (solve|approach|do)/i.test(trimmed);
        if (isSkipIntent) {
          inFlightRef.current = false;
          await transitionCodingOut({
            isSkip: true,
            skipReason: `Candidate indicated inability to solve: "${trimmed}"`,
            candidateSpokenText: trimmed,
          });
          return;
        }
      }

      if (currentStageVal === 'introduction') {
        nextStage = 'personal';
        nextFollowUpCount = 0;
      } else if (currentStageVal === 'personal') {
        nextStage = 'resume_dive';
        nextFollowUpCount = 0;
      } else if (currentStageVal === 'resume_dive') {
        if (canDoFollowUp) {
          nextStage = 'resume_dive';
          nextFollowUpCount = currentFollowUpCount + 1;
          intent = 'probe_followup';
        } else {
          nextStage = 'technical';
          nextFollowUpCount = 0;
        }
      } else if (currentStageVal === 'technical') {
        if (canDoFollowUp) {
          nextStage = 'technical';
          nextFollowUpCount = currentFollowUpCount + 1;
          intent = 'probe_followup';
        } else {
          nextStage = 'coding';
          nextFollowUpCount = 0;
        }
      } else if (currentStageVal === 'coding') {
        nextStage = 'coding';
        nextFollowUpCount = currentFollowUpCount;
        intent = 'clarify_coding';
      } else if (currentStageVal === 'followup') {
        if (canDoFollowUp) {
          nextStage = 'followup';
          nextFollowUpCount = currentFollowUpCount + 1;
          intent = 'probe_followup';
        } else {
          nextStage = 'evaluation';
          nextFollowUpCount = 0;
        }
      } else if (currentStageVal === 'evaluation') {
        nextStage = 'evaluation';
        nextFollowUpCount = 0;
        intent = 'closing_summary';
      }

      // Record question & answer pair for authoritative evaluation
      const lastAiQuestion = [...messagesRef.current].reverse().find((m) => m.role === 'assistant')?.content || '';
      const stageQuestionId = questionsMap[currentStageVal];

      if (interviewRef.current?.id && stageQuestionId) {
        saveCandidateAnswer({
          interviewId: interviewRef.current.id,
          questionId: stageQuestionId,
          candidateAnswer: trimmed,
          codeSnapshot: currentStageVal === 'coding' ? codeRef.current : '',
        }).catch((err) => console.warn('[AIInterviewPage] Answer persist warning:', err));
      }

      const newQaItem = {
        stage: currentStageVal,
        question: lastAiQuestion,
        answer: trimmed,
        codeSnapshot: currentStageVal === 'coding' ? codeRef.current : '',
        questionId: stageQuestionId,
        isFollowUp: intent === 'probe_followup',
      };
      const updatedQaHistory = [...qaHistoryRef.current, newQaItem];
      setQaHistory(updatedQaHistory);

      // Call AI turn with current context and follow-up depth
      const turn = await sendAITurn({
        stage: nextStage,
        candidateName,
        resumeText: resumeSummary,
        history: updatedHistory,
        lastUserMessage: trimmed,
        interviewType,
        difficulty,
        codingProblem: activeCodingProblemRef.current,
        code: codeRef.current,
        intent,
        followUpCount: nextFollowUpCount,
      });

      if (completedRef.current) return;

      const aiMsg = {
        role: 'assistant',
        content: turn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: nextStage,
      };

      setMessages([...updatedHistory, aiMsg]);
      setCurrentStage(nextStage);
      setStageFollowUpCount(nextFollowUpCount);
      speakText(turn.reply);

      // Stable Coding Problem Association
      let effectiveProb = activeCodingProblemRef.current;
      if (turn.codingProblem && !effectiveProb) {
        effectiveProb = turn.codingProblem;
        setActiveCodingProblem(turn.codingProblem);
        activeCodingProblemRef.current = turn.codingProblem;

        // Initialize code for current language if empty
        if (!codeRef.current) {
          const starter = turn.codingProblem.starter_code?.[languageRef.current] || CODE_TEMPLATES[languageRef.current] || '';
          setCode(starter);
          codeRef.current = starter;
        }
      }

      persistSessionSnapshot({
        userId: user.id,
        interview: interviewRef.current,
        currentStage: nextStage,
        stageFollowUpCount: nextFollowUpCount,
        messages: [...updatedHistory, aiMsg],
        qaHistory: updatedQaHistory,
        questionsMap,
        activeCodingProblem: effectiveProb,
        code: codeRef.current,
        language: languageRef.current,
        codeByLanguage: codeByLanguageRef.current,
        interviewType,
        difficulty,
        duration,
        elapsedSeconds,
        completed: false,
      });
    } catch (err) {
      console.error('[AIInterviewPage] Turn error:', err);
      if (!completedRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I noted your response. Let's proceed forward with the next part of our discussion.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            stage: currentStageVal,
          },
        ]);
      }
    } finally {
      inFlightRef.current = false;
      setIsAiTyping(false);
    }
  };

  /**
   * Unified transition out of Coding stage:
   * Handles both successful code submissions and candidate skip / "can't solve" actions.
   */
  const transitionCodingOut = async ({ isSkip = false, skipReason = '', candidateSpokenText = '' } = {}) => {
    if (inFlightRef.current || completedRef.current || currentStageRef.current !== 'coding') return;

    inFlightRef.current = true;
    setIsAiTyping(true);

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}`;
      const currentProb = activeCodingProblemRef.current || DEFAULT_CODING_PROBLEM;

      const outcome = isSkip ? 'skipped' : 'submitted';
      const answerText = isSkip
        ? `[SKIPPED] ${skipReason || 'Candidate indicated they were unable to solve this problem and requested to move forward.'}`
        : `Completed coding solution submitted in ${languageRef.current.toUpperCase()}.`;

      const codingQuestionId = questionsMap['coding'];
      if (interviewRef.current?.id && codingQuestionId) {
        await saveCandidateAnswer({
          interviewId: interviewRef.current.id,
          questionId: codingQuestionId,
          candidateAnswer: answerText,
          codeSnapshot: codeRef.current || '',
        });
      }

      if (!isSkip) {
        hasSubmittedCodeRef.current = true;
      } else {
        hasSkippedCodeRef.current = true;
      }

      const codingQa = {
        stage: 'coding',
        question: currentProb ? `${currentProb.title} (${currentProb.topic})` : 'Live Coding Challenge',
        answer: answerText,
        codeSnapshot: codeRef.current || '',
        language: languageRef.current,
        questionId: codingQuestionId,
        codingOutcome: outcome,
      };
      const updatedQa = [...qaHistoryRef.current, codingQa];
      setQaHistory(updatedQa);

      const nextStage = 'followup';
      setCurrentStage(nextStage);
      setStageFollowUpCount(0);

      const userNote = {
        role: 'user',
        content: isSkip
          ? `[Skipped coding problem: "${currentProb.title}"] ${candidateSpokenText ? `Candidate: "${candidateSpokenText}"` : ''}`
          : `[Submitted ${languageRef.current.toUpperCase()} coding solution for "${currentProb.title}"]`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: nextStage,
      };

      const updatedHistory = [...messagesRef.current, userNote];
      setMessages(updatedHistory);

      const turn = await sendAITurn({
        stage: nextStage,
        candidateName,
        resumeText: resumeSummary,
        history: updatedHistory,
        lastUserMessage: isSkip
          ? (candidateSpokenText || "I wasn't able to complete the code for this problem. Let's move on to discuss the approach or other questions.")
          : `I have completed my ${languageRef.current} code solution and submitted it for review.`,
        interviewType,
        difficulty,
        codingProblem: currentProb,
        code: codeRef.current || '',
        intent: isSkip ? 'skip_coding' : 'ask_stage_question',
        followUpCount: 0,
      });

      if (completedRef.current) return;

      const aiMsg = {
        role: 'assistant',
        content: turn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: nextStage,
      };

      setMessages([...updatedHistory, aiMsg]);
      speakText(turn.reply);

      persistSessionSnapshot({
        userId: user.id,
        interview: interviewRef.current,
        currentStage: nextStage,
        stageFollowUpCount: 0,
        messages: [...updatedHistory, aiMsg],
        qaHistory: updatedQa,
        questionsMap,
        activeCodingProblem: currentProb,
        code: codeRef.current,
        language: languageRef.current,
        codeByLanguage: codeByLanguageRef.current,
        interviewType,
        difficulty,
        duration,
        elapsedSeconds,
        completed: false,
        codingOutcome: outcome,
      });
    } catch (err) {
      console.error('[AIInterviewPage] Coding transition error:', err);
    } finally {
      inFlightRef.current = false;
      setIsAiTyping(false);
    }
  };

  /**
   * Candidate completes coding and clicks "Submit Solution & Continue to Review"
   */
  const handleCompleteCodingStage = async () => {
    if (currentStage === 'coding') {
      await transitionCodingOut({ isSkip: false });
    } else {
      // Manual editor mode outside coding stage: record code snapshot and close editor
      const currentProb = activeCodingProblemRef.current || DEFAULT_CODING_PROBLEM;
      const latestCode = codeRef.current;
      hasSubmittedCodeRef.current = true;
      const codingQuestionId = questionsMap['coding'];

      const codingQa = {
        stage: 'coding',
        question: currentProb ? `${currentProb.title} (${currentProb.topic})` : 'Manual Coding Solution',
        answer: `Completed coding solution submitted in ${languageRef.current.toUpperCase()}.`,
        codeSnapshot: latestCode,
        questionId: codingQuestionId,
        codingOutcome: 'submitted',
        timestamp: new Date().toISOString(),
      };
      qaHistoryRef.current = [...qaHistoryRef.current.filter((q) => q.stage !== 'coding'), codingQa];

      setActionToast({
        type: 'success',
        message: '✓ Code solution saved to your interview record.',
      });
      setTimeout(() => setActionToast(null), 4000);
      setCodingEditorOpen(false);
    }
  };

  /**
   * Candidate cannot solve and clicks "I Can't Solve This" skip button
   */
  const handleSkipCodingStage = async () => {
    if (inFlightRef.current || completedRef.current) return;
    if (currentStage === 'coding') {
      const confirmed = window.confirm(
        "Are you sure you want to move on? This problem will be recorded as skipped, and you will proceed to complexity & conceptual questions."
      );
      if (!confirmed) return;

      await transitionCodingOut({
        isSkip: true,
        skipReason: 'Candidate chose to skip via "I Can\'t Solve This" button.',
      });
    } else {
      // In manual editor mode outside coding stage, just close the editor workspace
      hasSkippedCodeRef.current = true;
      setCodingEditorOpen(false);
    }
  };

  // Authoritative Finish Interview flow
  const executeFinishInterview = async () => {
    if (!interview?.id || finishInFlightRef.current || completedRef.current) return;

    finishInFlightRef.current = true;
    completedRef.current = true;
    inFlightRef.current = true;
    setCompleting(true);
    setFinishingStep('saving');
    setShowFinishModal(false);
    setShowExitModal(false);

    // Stop speech synthesis & audio
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (isListening && typeof stopListening === 'function') {
      try {
        stopListening();
      } catch (_) {}
    }

    // Determine authoritative coding outcome
    let codingOutcome = 'incomplete';
    if (hasSubmittedCodeRef.current) {
      codingOutcome = 'submitted';
    } else if (hasSkippedCodeRef.current) {
      codingOutcome = 'skipped';
    }

    const latestCode = codeRef.current || '';
    const frozenTranscript = [...messagesRef.current];
    let frozenQa = [...qaHistoryRef.current];

    // If currently in coding stage or coded without submitting/skipping, record qa item for coding
    const codingQuestionId = questionsMap?.coding;
    const hasCodingInQa = frozenQa.some((item) => item.stage === 'coding');
    if (!hasCodingInQa && currentStage === 'coding') {
      const codingQa = {
        stage: 'coding',
        question: activeCodingProblem ? `${activeCodingProblem.title} (${activeCodingProblem.topic})` : 'Live Coding Challenge',
        answer: latestCode ? `[Candidate snapshot before finishing: ${latestCode.length} chars of ${languageRef.current} code]` : '[No code entered before finishing interview]',
        codeSnapshot: latestCode,
        language: languageRef.current,
        questionId: codingQuestionId,
        codingOutcome,
      };
      frozenQa.push(codingQa);
    }

    try {
      // Step 1: Persist all collected QA answers in parallel
      setFinishingStep('saving');
      const savePromises = frozenQa
        .filter((item) => item.questionId)
        .map((item) =>
          saveCandidateAnswer({
            interviewId: interview.id,
            questionId: item.questionId,
            candidateAnswer: item.answer || '',
            codeSnapshot: item.codeSnapshot || (item.stage === 'coding' ? latestCode : ''),
          }).catch((e) => console.warn('[AIInterviewPage] Answer save warning:', e))
        );
      await Promise.allSettled(savePromises);

      // Step 2: Prepare evaluation data
      setFinishingStep('preparing');

      // Step 3: Trigger authoritative evaluation with transcript, qaHistory, codeSnapshot, codingOutcome
      setFinishingStep('evaluating');
      let evalData = null;
      try {
        evalData = await requestEvaluation(interview.id, {
          transcript: frozenTranscript,
          qaHistory: frozenQa,
          codeSnapshot: latestCode,
          codingOutcome,
        });
      } catch (evalErr) {
        console.error('[AIInterviewPage] Evaluation generation note:', evalErr);
      }

      // Step 4: Guarantee authoritative DB status is updated to completed
      setFinishingStep('finalizing');
      await completeInterviewSession(interview.id).catch((e) => console.error('[AIInterviewPage] Fallback completion error:', e));

      setFinishingStep('complete');

      // Step 5: Remove temporary session storage & navigate
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      navigate(`/interview/results/${interview.id}`);
    } catch (err) {
      console.error('[AIInterviewPage] Complete error:', err);
      // Ensure DB status is completed even on unexpected errors
      await completeInterviewSession(interview.id).catch(() => {});
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      navigate(`/interview/results/${interview.id}`);
    } finally {
      inFlightRef.current = false;
      setCompleting(false);
    }
  };

  const handleCompleteInterview = () => {
    if (completing || finishInFlightRef.current || completedRef.current) return;
    setShowFinishModal(true);
  };

  // 1. RESUME REQUIRED SCREEN (PRE-FLIGHT)
  if (!checkingResume && hasCandidateResume === false) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '640px' }}>
        <div className="card" style={{ padding: '3rem 2.5rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
          }}>
            <FileText size={32} color="#f59e0b" />
          </div>

          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: '#f9fafb' }}>
            Resume Required
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Upload your resume before starting an AI interview. MockMate uses your resume to personalize questions, explore your real projects, and evaluate your architectural decisions.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/profile" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span>Go to Profile & Upload Resume</span>
            </Link>
            <Link to="/candidate/dashboard" className="btn btn-outline btn-lg">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. SETUP SCREEN (Resume verified)
  if (!inSession) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '780px' }}>
        <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bot size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', margin: 0, color: '#f9fafb' }}>
                AI Mock Interview
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Evidence-Based Technical Simulation with Adaptive Follow-ups
              </p>
            </div>
          </div>

          {setupError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span>{setupError}</span>
            </div>
          )}

          {/* Resume Confirmation Banner */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="#10b981" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f9fafb' }}>
                  Resume Verified
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Questions will reference your real projects, languages, and technical experience.
                </div>
              </div>
            </div>
            <Link to="/profile" className="btn btn-outline btn-xs">
              Change
            </Link>
          </div>

          <form onSubmit={handleStartInterview}>
            {/* Track Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Interview Track
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {TRACK_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInterviewType(t)}
                    style={{
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: interviewType === t ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                      background: interviewType === t ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      color: interviewType === t ? '#fff' : 'var(--text-secondary)',
                      fontWeight: interviewType === t ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      fontSize: '0.9rem',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Difficulty Level
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: difficulty === d ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                      background: difficulty === d ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      color: difficulty === d ? '#fff' : 'var(--text-secondary)',
                      fontWeight: difficulty === d ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      fontSize: '0.9rem',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="form-group" style={{ marginBottom: '2.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Session Duration
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: duration === opt.value ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                      background: duration === opt.value ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      color: duration === opt.value ? '#fff' : 'var(--text-secondary)',
                      fontWeight: duration === opt.value ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <Clock size={16} />
                    <span style={{ fontSize: '0.875rem' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Structured Stages Preview */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '2rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                Interview Blueprint (7 Structured Stages)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {STAGES.map((s, idx) => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}>
                      {idx + 1}
                    </div>
                    <span>{s.label.split('. ')[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={starting}
              className="btn btn-primary btn-lg"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.05rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
              }}
            >
              {starting ? (
                <>
                  <RotateCw size={20} className="spin" />
                  <span>Preparing AI Interviewer & Analyzing Resume...</span>
                </>
              ) : (
                <>
                  <Play size={20} />
                  <span>Start AI Interview</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. LIVE INTERVIEW SESSION
  return (
    <div style={{
      height: 'calc(100vh - 64px)',
      width: '100%',
      maxWidth: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: '#080c14',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* =========================================================================
          TOP COMPACT HEADER
          Contains session metadata, stage pill, timer, and interview actions.
          Fits cleanly within viewport with zero overflow.
          ========================================================================= */}
      <header style={{
        height: '50px',
        minHeight: '50px',
        maxHeight: '50px',
        background: '#0c121e',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: '0.75rem',
        zIndex: 30,
      }}>
        {/* Left: Exit button & Interview Info & Stage Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setShowExitModal(true)}
            className="btn btn-ghost btn-xs"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: 'var(--text-muted)',
              padding: '0.3rem 0.6rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
            }}
            title="Exit interview session"
          >
            <ArrowLeft size={14} />
            <span className="hide-mobile">Exit</span>
          </button>

          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.35)',
            flexShrink: 0,
          }}>
            <Bot size={16} color="#fff" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f9fafb', whiteSpace: 'nowrap' }}>
              Alex Vance
            </span>
            <span className="badge badge-primary hide-mobile" style={{ fontSize: '0.68rem', padding: '1px 6px', whiteSpace: 'nowrap' }}>
              {interviewType} • {difficulty}
            </span>
          </div>

          {/* Stage Progress Pill in Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.2rem 0.6rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#a5b4fc',
            fontSize: '0.78rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            marginLeft: '0.25rem',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
            <span>Stage {STAGE_ORDER.indexOf(currentStage) + 1} of {STAGES.length}: {STAGES.find((s) => s.key === currentStage)?.label.replace(/^\d+\.\s*/, '')}</span>
          </div>
        </div>

        {/* Right: Timer, Code Editor Toggle, Expand Button, Voice Toggle, Finish Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {/* Realtime Session Countdown Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'var(--bg-input)',
            padding: '0.3rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: remainingSeconds < 300 ? '#ef4444' : '#f9fafb',
            fontFamily: 'var(--font-mono)',
          }}>
            <Clock size={14} />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Code Editor Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !codingEditorOpen;
              setCodingEditorOpen(next);
              setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
            }}
            className="btn btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: isEditorVisible ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: isEditorVisible ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
              color: isEditorVisible ? '#818cf8' : '#e2e8f0',
              fontWeight: 600,
              padding: '0.32rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={isEditorVisible ? 'Hide code editor workspace' : 'Open code editor workspace'}
          >
            <Code2 size={15} />
            <span>{isEditorVisible ? 'Hide Editor' : '💻 Code Editor'}</span>
          </button>

          {/* Fullscreen Expand Editor Toggle Button (Visible when editor active) */}
          {isEditorVisible && (
            <button
              type="button"
              onClick={() => {
                const next = !editorExpanded;
                setEditorExpanded(next);
                setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
              }}
              className="btn btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: editorExpanded ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: editorExpanded ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                color: editorExpanded ? '#a5b4fc' : '#e2e8f0',
                fontWeight: 600,
                padding: '0.32rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={editorExpanded ? 'Exit fullscreen workspace' : 'Expand workspace to true fullscreen'}
            >
              {editorExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{editorExpanded ? 'Exit Fullscreen' : '⛶ Expand'}</span>
            </button>
          )}

          {/* Voice Audio Toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="btn btn-ghost btn-xs"
            style={{ color: voiceEnabled ? '#10b981' : 'var(--text-muted)', padding: '0.35rem' }}
            title={voiceEnabled ? 'Voice output enabled' : 'Voice output muted'}
          >
            {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>

          {/* Finish Interview Button */}
          <button
            onClick={handleCompleteInterview}
            disabled={completing}
            className="btn btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontWeight: 600,
              padding: '0.32rem 0.75rem',
              fontSize: '0.8rem',
              cursor: completing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <CheckCircle2 size={14} />
            <span>{completing ? 'Finishing...' : 'Finish Interview'}</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          TRUE FULLSCREEN CODING IDE (100vw × 100vh)
          Appears when candidate clicks Expand Editor.
          Does NOT unmount components or reset code/state.
          ========================================================================= */}
      {editorExpanded && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99999,
          background: '#080c14',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Fullscreen IDE Top Bar */}
          <div style={{
            height: '46px',
            minHeight: '46px',
            background: '#0b101c',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}>
                CF
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>
                {activeCodingProblem?.title || 'Coding Problem'}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.1rem 0.5rem',
                borderRadius: '10px',
                background: activeCodingProblem?.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: activeCodingProblem?.difficulty === 'Easy' ? '#34d399' : '#fbbf24',
                border: `1px solid ${activeCodingProblem?.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}>
                {activeCodingProblem?.difficulty || 'Medium'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setProblemCollapsed((prev) => !prev);
                  setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }}
                className="btn btn-outline btn-xs"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#a5b4fc', borderColor: 'var(--border-subtle)' }}
              >
                <FileText size={13} />
                <span>{problemCollapsed ? 'Show Problem Panel' : 'Hide Problem Panel'}</span>
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'var(--bg-input)',
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: remainingSeconds < 300 ? '#ef4444' : '#f9fafb',
                fontFamily: 'var(--font-mono)',
              }}>
                <Clock size={13} />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditorExpanded(false);
                  setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                title="Exit fullscreen coding mode (Esc)"
              >
                <Minimize2 size={14} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Split Area: Left Problem Statement Panel + Right Monaco Editor */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', overflow: 'hidden' }}>
            {!problemCollapsed && (
              <div style={{
                width: '380px',
                minWidth: '280px',
                maxWidth: '480px',
                height: '100%',
                background: '#0d1321',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                <div style={{
                  padding: '0.5rem 1rem',
                  background: '#090d16',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>Problem Statement</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Codeforces Mode</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <LeetCodeQuestionPanel
                    question={activeCodingProblem || DEFAULT_CODING_PROBLEM}
                    activeQuestion={activeCodingProblem || DEFAULT_CODING_PROBLEM}
                    questions={[activeCodingProblem || DEFAULT_CODING_PROBLEM]}
                  />
                </div>
              </div>
            )}

            {/* Monaco Workspace */}
            <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CollaborativeCodeEditor
                code={code}
                language={language}
                onCodeChange={handleCodeChange}
                onLanguageChange={handleLanguageChange}
                onResetTemplate={handleResetTemplate}
                interviewId={interview?.id || 'mock-ai-room'}
                questionId={activeCodingProblem?.id || 'two-sum'}
                testCases={activeCodingProblem?.testCases || []}
                isExpanded={true}
                onToggleExpand={() => {
                  setEditorExpanded(false);
                  setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }}
                onSubmit={handleCompleteCodingStage}
                isSubmitting={isAiTyping || inFlightRef.current || completing}
                onSkip={handleSkipCodingStage}
                readOnly={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN APPLICATION WORKSPACE (Sidebar + Main Content Area)
          Uses 100% of the viewport width.
          ========================================================================= */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
      }}>
        {/* LEFT VERTICAL INTERVIEW STAGE SIDEBAR */}
        <InterviewStageSidebar
          stages={STAGES}
          currentStage={currentStage}
          stageOrder={STAGE_ORDER}
          collapsed={stageSidebarCollapsed}
          onToggleCollapse={() => {
            setStageSidebarCollapsed((prev) => !prev);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
          }}
          interviewType={interviewType}
          difficulty={difficulty}
          candidateHasResume={Boolean(candidateResume)}
        />

        {/* MAIN INTERVIEW AREA (Flex 1, minWidth 0 to fill all remaining width without blowout) */}
        <main style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#090d16',
        }}>
          {isEditorVisible ? (
            /* =======================================================================
               CODING INTERVIEW WORKSPACE (Problem Top + Monaco Center + Console Bottom + AI Chat Right)
               ======================================================================= */
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}>
              {/* Left Coding Area: Problem Statement + Divider + Monaco IDE + Submit Bar */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                userSelect: isResizingProblem ? 'none' : 'auto',
              }}>
                {/* Problem Statement Card (Top) */}
                <div style={{
                  height: problemCollapsed ? '40px' : `${problemHeight}px`,
                  overflow: 'hidden',
                  background: '#0d1321',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                  transition: isResizingProblem ? 'none' : 'height 0.15s ease',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.35rem 1rem',
                    background: '#090d16',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
                        {activeCodingProblem?.title || 'Coding Problem'}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.5rem',
                        borderRadius: '12px',
                        background: activeCodingProblem?.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: activeCodingProblem?.difficulty === 'Easy' ? '#34d399' : '#fbbf24',
                        border: `1px solid ${activeCodingProblem?.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      }}>
                        {activeCodingProblem?.difficulty || 'Medium'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Topic: <span style={{ color: '#94a3b8' }}>{activeCodingProblem?.topic || 'Algorithms'}</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAiChatInCoding((prev) => !prev);
                          setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                        }}
                        className="btn btn-outline btn-xs"
                        style={{
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.72rem',
                          borderColor: 'var(--border-subtle)',
                          color: showAiChatInCoding ? '#818cf8' : 'var(--text-muted)',
                        }}
                        title={showAiChatInCoding ? 'Hide AI Chat Assistant drawer' : 'Show AI Chat Assistant drawer'}
                      >
                        <Bot size={13} />
                        <span>{showAiChatInCoding ? 'Hide AI Chat' : 'Ask Alex'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProblemCollapsed((prev) => !prev)}
                        className="btn btn-outline btn-xs"
                        style={{
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.72rem',
                          color: '#a5b4fc',
                          borderColor: 'var(--border-subtle)',
                        }}
                        title={problemCollapsed ? 'Expand problem description' : 'Collapse problem description'}
                      >
                        <span>{problemCollapsed ? '▼ Show Problem' : '▲ Collapse'}</span>
                      </button>
                    </div>
                  </div>

                  {!problemCollapsed && (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <LeetCodeQuestionPanel
                        question={activeCodingProblem || DEFAULT_CODING_PROBLEM}
                        activeQuestion={activeCodingProblem || DEFAULT_CODING_PROBLEM}
                        questions={[activeCodingProblem || DEFAULT_CODING_PROBLEM]}
                      />
                    </div>
                  )}
                </div>

                {/* Draggable Divider between Problem and Monaco */}
                {!problemCollapsed && (
                  <div
                    onMouseDown={handleMouseDownProblemResize}
                    style={{
                      height: '6px',
                      cursor: 'row-resize',
                      background: isResizingProblem ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                      zIndex: 10,
                      transition: isResizingProblem ? 'none' : 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ width: '36px', height: '2px', background: isResizingProblem ? '#a5b4fc' : 'rgba(255, 255, 255, 0.25)', borderRadius: '1px' }} />
                  </div>
                )}

                {/* Monaco Code Editor Workspace */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <CollaborativeCodeEditor
                    code={code}
                    language={language}
                    onCodeChange={handleCodeChange}
                    onLanguageChange={handleLanguageChange}
                    onResetTemplate={handleResetTemplate}
                    interviewId={interview?.id || 'mock-ai-room'}
                    questionId={activeCodingProblem?.id || 'two-sum'}
                    testCases={activeCodingProblem?.testCases || []}
                    isExpanded={editorExpanded}
                    onToggleExpand={() => {
                      setEditorExpanded((prev) => !prev);
                      setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                    }}
                    onSubmit={handleCompleteCodingStage}
                    isSubmitting={isAiTyping || inFlightRef.current || completing}
                    onSkip={handleSkipCodingStage}
                    readOnly={false}
                  />
                </div>

                {/* Pinned Bottom Submit Solution & Skip Bar */}
                <div style={{
                  padding: '0.45rem 1rem',
                  background: '#0c121e',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  flexShrink: 0,
                  zIndex: 15,
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Language: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{language.toUpperCase()}</span> • Codeforces mode: read from standard input, write to standard output.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <button
                      type="button"
                      onClick={handleSkipCodingStage}
                      disabled={isAiTyping || inFlightRef.current || completing}
                      className="btn btn-outline-danger btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        background: 'rgba(239, 68, 68, 0.05)',
                        cursor: isAiTyping || inFlightRef.current || completing ? 'not-allowed' : 'pointer',
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.78rem',
                      }}
                      title="Skip this coding problem if you are stuck or unable to solve it"
                    >
                      <HelpCircle size={14} />
                      <span>I Can't Solve This</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteCodingStage}
                      disabled={isAiTyping || inFlightRef.current || completing}
                      className="btn btn-primary btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontWeight: 600,
                        padding: '0.3rem 0.85rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>{currentStage === 'coding' ? 'Submit Solution & Continue →' : 'Save & Submit Solution'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Optional AI Assistant Chat during Coding */}
              {showAiChatInCoding && (
                <div style={{
                  width: '300px',
                  minWidth: '300px',
                  maxWidth: '300px',
                  background: '#0e1422',
                  borderLeft: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {/* Coding Chat Header */}
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    background: '#0a0e1a',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0,
                      }}>
                        <Bot size={15} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f9fafb' }}>
                          Alex Vance
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          AI Interviewer
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAiChatInCoding(false)}
                      className="btn btn-ghost btn-xs"
                      style={{ padding: '0.2rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}
                      title="Hide chat to maximize code editor width"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Coding Chat Messages */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}>
                    {messages.map((m, idx) => {
                      const isUser = m.role === 'user';
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isUser ? 'flex-end' : 'flex-start',
                            maxWidth: '92%',
                            alignSelf: isUser ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            marginBottom: '0.15rem',
                            fontSize: '0.68rem',
                            color: 'var(--text-muted)',
                          }}>
                            {isUser ? (
                              <><span>{m.timestamp}</span><span>You</span></>
                            ) : (
                              <><span style={{ color: '#a5b4fc', fontWeight: 600 }}>Alex</span><span>{m.timestamp}</span></>
                            )}
                          </div>
                          <div style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                            background: isUser ? '#4f46e5' : '#1e293b',
                            color: '#fff',
                            fontSize: '0.82rem',
                            lineHeight: '1.45',
                          }}>
                            {m.content}
                          </div>
                        </div>
                      );
                    })}
                    {isAiTyping && (
                      <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#a5b4fc', fontSize: '0.75rem' }}>
                        <RotateCw size={12} className="spin" />
                        <span>Alex is thinking...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Coding Chat Input */}
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    background: '#0a0e1a',
                    borderTop: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                  }}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!userInput.trim() || isAiTyping || inFlightRef.current) return;
                        handleSendResponse(userInput.trim());
                      }}
                      style={{ display: 'flex', gap: '0.4rem' }}
                    >
                      <input
                        type="text"
                        placeholder="Ask Alex for clarification..."
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        disabled={isAiTyping || inFlightRef.current}
                        style={{
                          flex: 1,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.35rem 0.6rem',
                          color: '#f9fafb',
                          fontSize: '0.8rem',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!userInput.trim() || isAiTyping || inFlightRef.current}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '0.35rem 0.6rem' }}
                      >
                        <Send size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* =======================================================================
               CONVERSATIONAL STAGE VIEW (Stages 1-4, 6-7)
               Main Chat Area (Left/Center) + AI Interviewer Avatar Card (Right)
               ======================================================================= */
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}>
              {/* Chat Column */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
              }}>
                {/* Stage Banner */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.04)',
                  borderBottom: '1px solid var(--border-subtle)',
                  padding: '0.65rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={15} color="#818cf8" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f9fafb' }}>
                      {STAGES.find((s) => s.key === currentStage)?.label}: {STAGES.find((s) => s.key === currentStage)?.desc}
                    </span>
                    {stageFollowUpCount > 0 && (
                      <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                        Follow-up In Progress
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Alex is analyzing your depth, reasoning, and communication.
                  </div>
                </div>

                {/* Chat Message Scroll List */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}>
                  {messages.map((m, idx) => {
                    const isUser = m.role === 'user';
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          marginBottom: '0.25rem',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}>
                          {isUser ? (
                            <>
                              <span>{m.timestamp}</span>
                              <span style={{ fontWeight: 600, color: '#cbd5e1' }}>You</span>
                              <User size={13} />
                            </>
                          ) : (
                            <>
                              <Bot size={13} color="#818cf8" />
                              <span style={{ fontWeight: 600, color: '#a5b4fc' }}>Alex Vance</span>
                              <span>{m.timestamp}</span>
                            </>
                          )}
                        </div>

                        <div style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          background: isUser ? '#4f46e5' : '#1e293b',
                          color: '#fff',
                          fontSize: '0.92rem',
                          lineHeight: '1.55',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        }}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}

                  {isAiTyping && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#a5b4fc', fontSize: '0.82rem' }}>
                      <RotateCw size={13} className="spin" />
                      <span>Alex is thinking & analyzing...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Candidate Input Area */}
                <div style={{
                  background: '#0c121e',
                  borderTop: '1px solid var(--border-subtle)',
                  padding: '0.85rem 1.25rem',
                  flexShrink: 0,
                }}>
                  {/* Input Mode Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => setInputMode('speak')}
                        className={`btn btn-xs ${inputMode === 'speak' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Mic size={13} />
                        <span>Voice (Speech-to-Text)</span>
                      </button>
                      <button
                        onClick={() => setInputMode('type')}
                        className={`btn btn-xs ${inputMode === 'type' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Keyboard size={13} />
                        <span>Keyboard Typing</span>
                      </button>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {inputMode === 'speak' ? 'Click microphone to speak naturally' : 'Press Enter to submit answer'}
                    </div>
                  </div>

                  {/* SPEAK MODE */}
                  {inputMode === 'speak' && (
                    <div style={{
                      background: 'var(--bg-input)',
                      border: isListening ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: isListening ? '#ef4444' : '#6b7280',
                            boxShadow: isListening ? '0 0 10px #ef4444' : 'none',
                            animation: isListening ? 'pulse 1.2s infinite' : 'none',
                          }} />
                          <span style={{ fontSize: '0.84rem', color: isListening ? '#f87171' : 'var(--text-secondary)' }}>
                            {isListening ? 'Listening to your microphone... speak clearly' : (transcript || interimTranscript) ? 'Voice captured. You can send or edit below.' : 'Microphone idle. Click the button to start speaking.'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isListening) {
                              stopListening();
                            } else {
                              resetTranscript();
                              startListening();
                            }
                          }}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: isListening ? '#ef4444' : '#6366f1',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: isListening ? '0 0 16px rgba(239, 68, 68, 0.6)' : '0 0 10px rgba(99, 102, 241, 0.4)',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                          }}
                          title={isListening ? 'Stop Listening' : 'Click to Speak'}
                          aria-label={isListening ? 'Stop recording voice' : 'Start speaking with microphone'}
                        >
                          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                      </div>

                      {/* Error or unsupported browser alert */}
                      {speechError && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          fontSize: '0.8rem',
                          lineHeight: 1.4,
                          flexWrap: 'wrap',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1, minWidth: 200 }}>
                            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{speechError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInputMode('type')}
                            className="btn btn-outline btn-xs"
                            style={{
                              borderColor: 'rgba(239, 68, 68, 0.5)',
                              color: '#fca5a5',
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            Switch to Typing
                          </button>
                        </div>
                      )}

                      {/* Real-time recognized speech preview (final + interim) */}
                      {(transcript || interimTranscript) && (
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.65rem 0.85rem',
                          fontSize: '0.88rem',
                          color: '#f8fafc',
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                        }}>
                          <span>{transcript}</span>
                          {interimTranscript && (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', marginLeft: transcript ? '0.35rem' : '0' }}>
                              {interimTranscript}
                            </span>
                          )}
                        </div>
                      )}

                      {(transcript || interimTranscript) && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              stopListening();
                              setUserInput(transcript + (interimTranscript ? ' ' + interimTranscript : ''));
                              setInputMode('type');
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                          >
                            <Edit3 size={13} />
                            <span>Edit Transcript</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendResponse(transcript + (interimTranscript ? ' ' + interimTranscript : ''))}
                            disabled={isAiTyping || inFlightRef.current || (!transcript.trim() && !interimTranscript.trim())}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                          >
                            <Send size={13} />
                            <span>Send Answer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TYPE MODE */}
                  {inputMode === 'type' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!userInput.trim() || isAiTyping || inFlightRef.current) return;
                        handleSendResponse(userInput.trim());
                      }}
                      style={{ display: 'flex', gap: '0.65rem' }}
                    >
                      <input
                        type="text"
                        placeholder="Type your technical response..."
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        disabled={isAiTyping || inFlightRef.current}
                        style={{
                          flex: 1,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.65rem 0.85rem',
                          color: '#f9fafb',
                          fontSize: '0.88rem',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!userInput.trim() || isAiTyping || inFlightRef.current}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '0.65rem 1.15rem' }}
                      >
                        <Send size={15} />
                        <span>Send</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Right Side: AI Interviewer Card & Resume Context */}
              <aside style={{
                width: '280px',
                minWidth: '280px',
                maxWidth: '280px',
                background: '#0c121e',
                borderLeft: '1px solid var(--border-subtle)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                overflowY: 'auto',
                flexShrink: 0,
              }}>
                {/* AI Interviewer Avatar Card */}
                <div style={{
                  background: '#0f172a',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem auto',
                    boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
                  }}>
                    <Bot size={28} color="#fff" />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc', marginBottom: '0.2rem' }}>
                    Alex Vance
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Principal Interviewer • Gemini AI
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#34d399',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
                    <span>Live Audio Active</span>
                  </div>
                </div>

                {/* Candidate Resume Context Pill */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem', color: '#10b981' }}>
                    <CheckCircle2 size={15} />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Resume Context Loaded</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 0.5rem 0' }}>
                    Questions are tailored to your real engineering experience and tech stack.
                  </p>
                  {profile?.skills && profile.skills.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {(Array.isArray(profile.skills) ? profile.skills : profile.skills.split(',')).slice(0, 4).map((sk, skIdx) => (
                        <span key={skIdx} className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '0.12rem 0.4rem' }}>
                          {typeof sk === 'string' ? sk.trim() : sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current Focus Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  marginTop: 'auto',
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem', fontWeight: 600 }}>
                    Current Focus
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                    {currentStage === 'introduction' ? 'Candidate Introduction'
                      : currentStage === 'personal' ? 'Experience & Passion'
                      : currentStage === 'resume_dive' ? (stageFollowUpCount > 0 ? 'Project Deep Dive' : 'Project Architecture')
                      : currentStage === 'technical' ? (stageFollowUpCount > 0 ? 'Core Concepts Probing' : 'Core Concepts & Trade-offs')
                      : currentStage === 'coding' ? 'Live Coding Solution'
                      : currentStage === 'followup' ? 'Complexity & Optimization'
                      : 'Session Wrap-up'}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>


      {/* FINISHING INTERVIEW MULTI-STEP PROGRESS MODAL */}
      {completing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.5rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#111827',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
              padding: '2.25rem',
              borderRadius: 'var(--radius-lg, 12px)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <Sparkles size={28} color="#818cf8" style={{ animation: 'spin 2.5s linear infinite' }} />
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f9fafb', marginBottom: '0.4rem' }}>
              Finishing Interview
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Analyzing your responses and generating your verified AI evaluation report.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', background: '#0a0e18', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {['preparing', 'evaluating', 'finalizing', 'complete'].includes(finishingStep) ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : finishingStep === 'saving' ? (
                  <RotateCw size={16} color="#818cf8" className="spin" />
                ) : (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #4b5563', display: 'inline-block' }} />
                )}
                <span style={{ color: ['preparing', 'evaluating', 'finalizing', 'complete'].includes(finishingStep) ? '#f9fafb' : '#94a3b8' }}>
                  Saving candidate responses & code snapshot
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {['evaluating', 'finalizing', 'complete'].includes(finishingStep) ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : finishingStep === 'preparing' ? (
                  <RotateCw size={16} color="#818cf8" className="spin" />
                ) : (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #4b5563', display: 'inline-block' }} />
                )}
                <span style={{ color: ['evaluating', 'finalizing', 'complete'].includes(finishingStep) ? '#f9fafb' : '#94a3b8' }}>
                  Preparing interview dialogue & rubric
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {['finalizing', 'complete'].includes(finishingStep) ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : finishingStep === 'evaluating' ? (
                  <RotateCw size={16} color="#818cf8" className="spin" />
                ) : (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #4b5563', display: 'inline-block' }} />
                )}
                <span style={{ color: ['finalizing', 'complete'].includes(finishingStep) ? '#f9fafb' : '#94a3b8' }}>
                  Generating evidence-based AI evaluation
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {finishingStep === 'complete' ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : finishingStep === 'finalizing' ? (
                  <RotateCw size={16} color="#818cf8" className="spin" />
                ) : (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #4b5563', display: 'inline-block' }} />
                )}
                <span style={{ color: finishingStep === 'complete' ? '#f9fafb' : '#94a3b8' }}>
                  Finalizing score & debrief report
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINISH INTERVIEW CONFIRMATION MODAL */}
      {showFinishModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.25rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#131722',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg, 12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Finish Interview?
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              Are you sure you want to finish this interview? Your current responses will be evaluated and the interview will be marked completed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowFinishModal(false)}
                disabled={completing}
              >
                Continue Interview
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: '#ef4444', borderColor: '#dc2626', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={executeFinishInterview}
                disabled={completing}
              >
                {completing ? '⏳ Finishing Interview...' : 'Finish Interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT ACTIVE INTERVIEW CONFIRMATION MODAL */}
      {showExitModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.25rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#131722',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg, 12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Your interview is still active.
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              If you leave now, you can finish your interview and receive your evaluation report, or you can stay and continue answering questions.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowExitModal(false)}
                disabled={completing}
              >
                Stay in Interview
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: '#ef4444', borderColor: '#dc2626', color: '#fff', fontWeight: 700 }}
                onClick={executeFinishInterview}
                disabled={completing}
              >
                {completing ? 'Finishing...' : 'Finish Interview and Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
