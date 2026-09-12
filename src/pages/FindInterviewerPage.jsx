import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAvailableInterviewers, createInterviewRequest } from '../services/discoveryService';
import { 
  Users, 
  Star, 
  ArrowLeft, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Send, 
  Clock, 
  Briefcase, 
  User,
  Sparkles
} from 'lucide-react';

export default function FindInterviewerPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');
  const [error, setError] = useState('');

  const loadInterviewers = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError('');

    try {
      const { data, error: fetchError } = await getAvailableInterviewers();
      if (fetchError) throw fetchError;
      setInterviewers(data || []);
    } catch (err) {
      console.error('[FindInterviewerPage] Failed to fetch interviewers:', err);
      setError('Could not load live interviewers from the database. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInterviewers();
  }, []);

  const handleOpenRequestModal = (interviewer) => {
    setSelectedInterviewer(interviewer);
    setRequestSuccess('');
    setError('');
  };

  const handleSendRequest = async () => {
    if (!user || !selectedInterviewer) return;

    setSendingRequest(true);
    setError('');
    setRequestSuccess('');

    try {
      await createInterviewRequest({
        candidateId: user.id,
        interviewerId: selectedInterviewer.id,
        candidateName: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Candidate',
        candidateEmail: user.email,
        candidateSocials: {
          github: profile?.github || null,
          linkedin: profile?.linkedin || null,
          portfolio: profile?.portfolio || null,
        },
      });

      setRequestSuccess(`Interview request successfully sent to ${selectedInterviewer.full_name}! Redirecting to your dashboard...`);
      setTimeout(() => {
        navigate('/candidate/dashboard');
      }, 1500);
    } catch (err) {
      console.error('[FindInterviewerPage] Request failed:', err);
      setError(err.message || 'Failed to submit interview request.');
      setSendingRequest(false);
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '1080px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Available Live Interviewers</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Only verified peer interviewers currently marked online in Supabase are displayed below.
          </p>
        </div>

        <button
          onClick={() => loadInterviewers(true)}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
          title="Refresh available interviewers"
        >
          <RotateCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh List'}</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {requestSuccess && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>{requestSuccess}</span>
        </div>
      )}

      {/* Interviewers Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          <RotateCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
          <p>Querying available interviewers from database...</p>
        </div>
      ) : interviewers.length === 0 ? (
        /* Strict No Fake Fallback Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Users size={48} color="var(--border-subtle)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>No Interviewers Currently Available</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
            No peer interviewers are currently set to Available in the database. You can practice with our AI engine immediately, or check back in a few moments.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => loadInterviewers(true)} className="btn btn-secondary btn-sm">
              <RotateCw size={15} />
              <span>Check Again</span>
            </button>
            <Link to="/candidate/dashboard" className="btn btn-primary btn-sm">
              <Sparkles size={15} />
              <span>Practice with AI</span>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {interviewers.map((interviewer) => (
            <div
              key={interviewer.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                borderTop: '3px solid var(--accent-secondary)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    {interviewer.full_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', marginRight: 4 }}></span>
                      Available
                    </span>
                    {interviewer.averageRating ? (
                      <span style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        <strong>{interviewer.averageRating}</strong> ({interviewer.reviewCount})
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Interviewer</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio & Experience */}
              {interviewer.bio ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', flex: 1 }}>
                  "{interviewer.bio}"
                </p>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', flex: 1 }}>
                  Experienced software engineer ready to conduct live mock interviews.
                </p>
              )}

              {/* Skills Tags */}
              {interviewer.skills && interviewer.skills.length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {interviewer.skills.slice(0, 4).map((skill, idx) => (
                    <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {/* Social Links */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem' }}>
                {interviewer.github && (
                  <a href={interviewer.github.startsWith('http') ? interviewer.github : `https://${interviewer.github}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>GitHub</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                {interviewer.linkedin && (
                  <a href={interviewer.linkedin.startsWith('http') ? interviewer.linkedin : `https://${interviewer.linkedin}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>LinkedIn</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                {interviewer.portfolio && (
                  <a href={interviewer.portfolio.startsWith('http') ? interviewer.portfolio : `https://${interviewer.portfolio}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>Portfolio</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  onClick={() => handleOpenRequestModal(interviewer)}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                >
                  <Send size={15} />
                  <span>Request Interview</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedInterviewer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Confirm Interview Request</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Send an interview request to <strong>{selectedInterviewer.full_name}</strong>. They will be notified in real-time.
            </p>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Candidate: </span>
                <strong>{profile?.full_name || user?.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Interviewer: </span>
                <strong>{selectedInterviewer.full_name} ({selectedInterviewer.email})</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setSelectedInterviewer(null)}
                disabled={sendingRequest}
                className="btn btn-outline btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRequest}
                disabled={sendingRequest}
                className="btn btn-primary btn-sm"
              >
                <Send size={15} />
                <span>{sendingRequest ? 'Submitting Request...' : 'Send Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
