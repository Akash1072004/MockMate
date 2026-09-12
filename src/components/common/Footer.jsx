import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Shield, Code, Cpu, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="nav-brand" style={{ marginBottom: '1rem' }}>
              <div className="nav-brand-icon">
                <Bot size={18} />
              </div>
              <span>Mock<span className="text-gradient">Mate</span></span>
            </div>
            <p style={{ maxWidth: '300px', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Production-grade mock interview platform combining adaptive Gemini AI evaluations and real-time peer interviews with WebRTC and synchronized code collaboration.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span className="badge badge-primary">Supabase Auth & DB</span>
              <span className="badge badge-success">WebRTC Video</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/signup">AI Mock Interview</Link></li>
              <li><Link to="/signup">Live Peer Interview</Link></li>
              <li><Link to="/signup">Code Execution (C++, Java, Python)</Link></li>
              <li><Link to="/login">Candidate Leaderboard</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Roles</h4>
            <ul>
              <li><Link to="/signup?role=candidate">Candidate Portal</Link></li>
              <li><Link to="/signup?role=interviewer">Interviewer Portal</Link></li>
              <li><Link to="/login">Sign In</Link></li>
              <li><Link to="/signup">Create Account</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Technology</h4>
            <ul>
              <li><span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Gemini AI Engine</span></li>
              <li><span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Supabase Realtime</span></li>
              <li><span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>WebRTC P2P</span></li>
              <li><span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Row Level Security</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} MockMate. Built with security and clean architecture.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Built for developers and engineering leaders</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
