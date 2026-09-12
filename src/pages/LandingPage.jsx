import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Bot, 
  Users, 
  Video, 
  Code2, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  LineChart, 
  Clock, 
  Cpu, 
  Award,
  Zap
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-glow"></div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge badge-primary">
                <Sparkles size={14} style={{ marginRight: '0.35rem' }} />
                Next-Generation Mock Interview Platform
              </span>
            </div>

            <h1 className="hero-title">
              Ace Your Technical Interviews with <span className="text-gradient">AI & Live Peers</span>
            </h1>

            <p className="hero-subtitle">
              MockMate combines adaptive Gemini AI interview simulations with peer-to-peer live mock sessions featuring collaborative synchronized code editors, multi-language code execution, and WebRTC video.
            </p>

            <div className="hero-actions">
              <Link to="/signup?role=candidate" className="btn btn-primary btn-lg">
                <span>Start as Candidate</span>
                <ArrowRight size={18} />
              </Link>
              <Link to="/signup?role=interviewer" className="btn btn-secondary btn-lg">
                <Users size={18} />
                <span>Join as Interviewer</span>
              </Link>
            </div>

            {/* Live Interactive Mock Preview */}
            <div className="hero-preview">
              <div className="preview-bar">
                <div className="preview-dot red"></div>
                <div className="preview-dot yellow"></div>
                <div className="preview-dot green"></div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                  mockmate-session://room-active-peer-dsa-774
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', marginRight: 4 }}></span>
                    Synchronized
                  </span>
                </div>
              </div>

              <div className="preview-grid">
                <div className="preview-code-panel">
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>// Question: Longest Substring Without Repeating Characters</span>
                    <span style={{ color: '#818cf8' }}>Python 3.12</span>
                  </div>
                  <pre style={{ lineHeight: '1.6', overflowX: 'auto' }}>
{`def lengthOfLongestSubstring(s: str) -> int:
    char_map = {}
    left = 0
    max_len = 0
    
    for right in range(len(s)):
        if s[right] in char_map and char_map[s[right]] >= left:
            left = char_map[s[right]] + 1
        char_map[s[right]] = right
        max_len = max(max_len, right - left + 1)
        
    return max_len`}
                  </pre>
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="badge badge-success" style={{ textTransform: 'none' }}>
                      <CheckCircle2 size={12} style={{ marginRight: 4 }} /> All 15 Test Cases Passed
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Runtime: 42ms</span>
                  </div>
                </div>

                <div className="preview-video-panel">
                  <div className="preview-avatar-box">
                    <Video size={20} color="#818cf8" />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Interviewer Feed</div>
                      <div style={{ fontSize: '0.75rem' }}>Senior Staff Engineer @ Tech</div>
                    </div>
                  </div>
                  <div className="preview-avatar-box">
                    <Video size={20} color="#38bdf8" />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Candidate Feed</div>
                      <div style={{ fontSize: '0.75rem' }}>Audio & Screen Active</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', padding: '0.65rem', fontSize: '0.75rem', color: '#c7d2fe', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    ⚡ Real-time signaling via Supabase Realtime & WebRTC P2P
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Pillars Section: AI vs Live Peer */}
      <section id="ai-interview" className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Two Modes, One Powerful Platform</h2>
            <p>Whether you want rapid autonomous AI practice anytime or rigorous live human mock interviews with peer engineers, MockMate delivers both.</p>
          </div>

          <div className="roles-grid">
            <div className="card role-card candidate">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="feature-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
                  <Bot size={26} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>AI Mock Interview</h3>
                  <p style={{ fontSize: '0.875rem' }}>Powered by Google Gemini 2.5/Flash</p>
                </div>
              </div>
              <p>
                Configure interview type (DSA, System Design, Frontend, Backend, Full Stack, or HR) and difficulty level. Gemini generates tailored questions on the fly and grades your code, explanation, and conceptual depth.
              </p>
              <ul className="checklist">
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Instant question generation tailored to chosen difficulty</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Adaptive question-by-question progression with progress tracking</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Structured multi-metric AI evaluation and comprehensive feedback report</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Zero waiting time — available 24/7 on demand</span>
                </li>
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <Link to="/signup?role=candidate" className="btn btn-primary" style={{ width: '100%' }}>
                  Practice with AI Now
                </Link>
              </div>
            </div>

            <div id="live-interview" className="card role-card interviewer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="feature-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.2)' }}>
                  <Users size={26} color="#38bdf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>Live Peer Mock Interview</h3>
                  <p style={{ fontSize: '0.875rem' }}>Human-to-Human Real-Time Simulation</p>
                </div>
              </div>
              <p>
                Discover available interviewers, send database-backed interview requests, and enter a dedicated room with WebRTC video, microphone, screen sharing, and bi-directionally synchronized code editor.
              </p>
              <ul className="checklist">
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Real-time availability status for verified interviewers</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Unique one-time join codes and strict Supabase authorization</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Ultra-low latency WebRTC audio, video, and screen sharing</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Post-interview ratings, reviews, and candidate score reports</span>
                </li>
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <Link to="/signup?role=candidate" className="btn btn-secondary" style={{ width: '100%' }}>
                  Find Live Interviewers
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Benefits */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Engineered for Candidates & Interviewers</h2>
            <p>Every feature is designed with role-specific dashboards, secure permissions, and frictionless workflows.</p>
          </div>

          <div className="roles-grid">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Award size={24} color="#818cf8" />
                <h3>For Candidates</h3>
              </div>
              <p style={{ marginBottom: '1.25rem' }}>
                Build interview confidence with measurable progress metrics, authentic pressure testing, and verifiable score history.
              </p>
              <ul className="checklist">
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Comprehensive dashboard tracking completed sessions and average scores</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Multi-language code editor with C++, Java, and Python support</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Real-time request notification badges when interviewers accept</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Compete on the community Candidate Leaderboard</span>
                </li>
              </ul>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <ShieldCheck size={24} color="#06b6d4" />
                <h3>For Interviewers</h3>
              </div>
              <p style={{ marginBottom: '1.25rem' }}>
                Give back to the engineering community, hone your evaluation skills, and build a verified reputation score.
              </p>
              <ul className="checklist">
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>One-click availability toggle to control when you receive requests</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Rich candidate profiles with GitHub, LinkedIn, and portfolios</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>In-room control bar to step questions, run code, and score responses</span>
                </li>
                <li className="checklist-item">
                  <CheckCircle2 size={16} />
                  <span>Collect 1-5 star reviews and verified candidate feedback</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Built with Production Architecture</h2>
            <p>Every layer conforms to modern security standards, database-driven state, and reactive updates.</p>
          </div>

          <div className="features-grid">
            <div className="card feature-card">
              <div className="feature-icon-wrapper">
                <Terminal size={24} />
              </div>
              <h4>Code Execution Engine</h4>
              <p>Safe sandbox execution supporting Python, C++, and Java with compilation checks, execution timeouts, and test-case verdict capture.</p>
            </div>

            <div className="card feature-card">
              <div className="feature-icon-wrapper">
                <Zap size={24} />
              </div>
              <h4>Supabase Realtime</h4>
              <p>Instant synchronization of code keystrokes, language switches, interview status, and interview request acceptances without client-side polling.</p>
            </div>

            <div className="card feature-card">
              <div className="feature-icon-wrapper">
                <Video size={24} />
              </div>
              <h4>WebRTC Audio & Screen Share</h4>
              <p>High-definition peer video with camera and microphone toggling, screen sharing for architecture walkthroughs, and graceful reconnection handling.</p>
            </div>

            <div className="card feature-card">
              <div className="feature-icon-wrapper">
                <ShieldCheck size={24} />
              </div>
              <h4>Row Level Security (RLS)</h4>
              <p>Mandatory database authorization. Candidates and interviewers only access their authorized records, requests, submissions, and reviews.</p>
            </div>

            <div className="card feature-card">
              <div className="feature-icon-wrapper">
                <LineChart size={24} />
              </div>
              <h4>Structured AI Feedback</h4>
              <p>Multi-dimensional analysis covering technical depth, correctness, communication clarity, and confidence with concrete improvement points.</p>
            </div>

            <div className="card feature-card">
              <div className="feature-icon-wrapper">
                <Award size={24} />
              </div>
              <h4>Authentic Leaderboard</h4>
              <p>No hardcoded or fake data. Rankings are computed directly from verified database completion records with aggregated scores.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="section" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div className="container">
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto', padding: '3.5rem 2rem', background: 'linear-gradient(180deg, #111827 0%, #0d121f 100%)', border: '1px solid rgba(99, 102, 241, 0.3)', boxShadow: 'var(--shadow-glow)' }}>
            <h2 style={{ fontSize: '2.4rem', marginBottom: '1rem' }}>
              Ready to Level Up Your Interview Skills?
            </h2>
            <p style={{ maxWidth: '580px', margin: '0 auto 2rem auto', fontSize: '1.05rem' }}>
              Join MockMate today. Practice coding questions, improve your communication, and get evaluated by AI or real engineers.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-primary btn-lg">
                Create Free Account
              </Link>
              <Link to="/login" className="btn btn-outline btn-lg">
                Sign In to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
