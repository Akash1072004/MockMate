import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Star, 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Copy, 
  Check, 
  ExternalLink,
  Code2,
  Globe,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInterviewerRatingSummary } from '../services/reviewService';
import { getCandidateResume, uploadResume, deleteResume } from '../services/resumeService';

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [leetcode, setLeetcode] = useState('');
  const [codeforces, setCodeforces] = useState('');
  const [codechef, setCodechef] = useState('');
  const [experience, setExperience] = useState('');

  // Resume state
  const [resumeData, setResumeData] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeSuccess, setResumeSuccess] = useState('');
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [ratingStats, setRatingStats] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setHeadline(profile.headline || '');
      setBio(profile.bio || '');
      setSkills(Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills || '');
      setGithub(profile.github || '');
      setLinkedin(profile.linkedin || '');
      setPortfolio(profile.portfolio || '');
      setLeetcode(profile.leetcode || '');
      setCodeforces(profile.codeforces || '');
      setCodechef(profile.codechef || '');
      setExperience(profile.experience || '');
    } else if (user) {
      setFullName(user.user_metadata?.full_name || '');
    }

    if (user?.id) {
      // Load candidate resume
      getCandidateResume(user.id).then((res) => {
        if (res) setResumeData(res);
      });

      if (profile?.role === 'interviewer') {
        getInterviewerRatingSummary(user.id).then((stats) => {
          if (stats) setRatingStats(stats);
        });
      }
    }
  }, [profile, user]);

  const handleResumeFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadingResume(true);
    setResumeError('');
    setResumeSuccess('');

    try {
      const res = await uploadResume({ userId: user.id, file });
      setResumeData(res);
      setResumeSuccess(`Resume "${res.fileName}" uploaded successfully!`);
    } catch (err) {
      console.error('[ProfilePage] Resume upload failed:', err);
      setResumeError(err.message || 'Failed to upload resume. Please try a valid PDF or text file.');
    } finally {
      setUploadingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteResume = async () => {
    if (!user?.id || !window.confirm('Are you sure you want to remove your resume?')) return;
    try {
      await deleteResume(user.id);
      setResumeData(null);
      setResumeSuccess('Resume removed.');
    } catch (err) {
      setResumeError('Failed to remove resume.');
    }
  };

  const handleCopyPublicLink = () => {
    const identifier = username || user?.id;
    const url = `${window.location.origin}/candidates/${identifier}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    // URL validation: only validate when provided
    const validateUrl = (val, hostPattern, serviceName) => {
      if (!val || !val.trim()) return null;
      const str = val.trim();
      try {
        const parsed = new URL(str.startsWith('http') ? str : `https://${str}`);
        if (!hostPattern.test(parsed.hostname)) {
          return `${serviceName} link must point to ${serviceName} (e.g. https://${serviceName.toLowerCase()}.com/...)`;
        }
      } catch (e) {
        return `Invalid URL format for ${serviceName}.`;
      }
      return null;
    };

    const ghErr = validateUrl(github, /(^|\.)github\.com$/i, 'GitHub');
    if (ghErr) { setError(ghErr); return; }

    const liErr = validateUrl(linkedin, /(^|\.)linkedin\.com$/i, 'LinkedIn');
    if (liErr) { setError(liErr); return; }

    const lcErr = validateUrl(leetcode, /(^|\.)leetcode\.com$/i, 'LeetCode');
    if (lcErr) { setError(lcErr); return; }

    const cfErr = validateUrl(codeforces, /(^|\.)codeforces\.com$/i, 'Codeforces');
    if (cfErr) { setError(cfErr); return; }

    const ccErr = validateUrl(codechef, /(^|\.)codechef\.com$/i, 'CodeChef');
    if (ccErr) { setError(ccErr); return; }

    // Clean and validate username
    let cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    setLoading(true);
    try {
      const skillsArray = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateProfile({
        full_name: fullName.trim(),
        username: cleanUsername || null,
        headline: headline.trim(),
        bio: bio.trim(),
        skills: skillsArray,
        github: github.trim(),
        linkedin: linkedin.trim(),
        portfolio: portfolio.trim(),
        leetcode: leetcode.trim(),
        codeforces: codeforces.trim(),
        codechef: codechef.trim(),
        experience: experience.trim(),
      });

      setSuccess('Profile updated successfully!');
    } catch (err) {
      console.error('[ProfilePage] Failed to save profile:', err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const publicProfileSlug = username || user?.id;

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '840px' }}>
      {/* Top Header & Share Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Profile & Professional Identity</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage your credentials, competitive programming handles, resume, and public link.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {publicProfileSlug && (
            <>
              <Link to={`/candidates/${publicProfileSlug}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Eye size={15} />
                <span>View Public Profile</span>
              </Link>
              <button onClick={handleCopyPublicLink} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                {copiedLink ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                <span>{copiedLink ? 'Copied!' : 'Copy Public Link'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resume Section (Phase 3) */}
      <div className="card" style={{ padding: '2rem', marginBottom: '2rem', borderTop: '3px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
              <FileText size={22} color="#818cf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Candidate Resume</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Required before entering any mock interview. Used by AI to personalize technical questions.
              </p>
            </div>
          </div>

          <div>
            {resumeData?.fileName ? (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={13} />
                <span>Resume Active</span>
              </span>
            ) : (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertCircle size={13} />
                <span>Missing Resume</span>
              </span>
            )}
          </div>
        </div>

        {resumeSuccess && (
          <div className="alert alert-info" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span style={{ fontSize: '0.85rem' }}>{resumeSuccess}</span>
          </div>
        )}

        {resumeError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.85rem' }}>{resumeError}</span>
          </div>
        )}

        {resumeData?.fileName ? (
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileText size={28} color="#a5b4fc" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{resumeData.fileName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {resumeData.fileSize ? `${(resumeData.fileSize / 1024).toFixed(1)} KB` : 'Uploaded'} • Privacy protected via Supabase RLS
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(resumeData.signedUrl || resumeData.dataUrl) && (
                <a
                  href={resumeData.signedUrl || resumeData.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Eye size={14} />
                  <span>View</span>
                </a>
              )}
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt,.md,.doc,.docx"
                onChange={handleResumeFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={uploadingResume}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                <span>{uploadingResume ? 'Replacing...' : 'Replace'}</span>
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteResume}
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '2rem 1.5rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
            <Upload size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Upload your resume document</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 1.25rem auto' }}>
              Accepted formats: PDF or plain text. Your resume is never publicly accessible without your permission.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleResumeFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={uploadingResume}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} />
              <span>{uploadingResume ? 'Uploading...' : 'Select File (PDF / Text)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Profile Form Card */}
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="feature-icon-wrapper">
              <User size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>General Information</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Profile details visible to interviewers and on your public share page.
              </p>
            </div>
          </div>

          {ratingStats?.averageRating && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-md)',
            }}>
              <Star size={16} fill="#f59e0b" color="#f59e0b" />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                {ratingStats.averageRating} / 5.0
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({ratingStats.totalReviews} review{ratingStats.totalReviews === 1 ? '' : 's'})
              </span>
            </div>
          )}
        </div>

        {success && (
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ color: 'var(--accent-danger)', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Full Name & Username */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">Full Name *</label>
              <input
                id="fullName"
                type="text"
                className="form-control"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Chen"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="username" className="form-label">Public Username</label>
              <input
                id="username"
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alexchen"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Used in your share link: /candidates/{username || 'your-username'}
              </span>
            </div>
          </div>

          {/* Professional Headline */}
          <div className="form-group">
            <label htmlFor="headline" className="form-label">Professional Headline</label>
            <input
              id="headline"
              type="text"
              className="form-control"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Full-Stack Software Engineer | Distributed Systems & React"
            />
          </div>

          {/* Bio / About */}
          <div className="form-group">
            <label htmlFor="bio" className="form-label">Bio / About</label>
            <textarea
              id="bio"
              className="form-control"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell interviewers about your background, career goals, and core specialties..."
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Skills */}
          <div className="form-group">
            <label htmlFor="skills" className="form-label">Skills & Technologies (comma separated)</label>
            <input
              id="skills"
              type="text"
              className="form-control"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. Python, C++, React, TypeScript, Node.js, SQL, Algorithms"
            />
          </div>

          {/* Competitive Programming & Coding Profiles (Phase 4) */}
          <div style={{ marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code2 size={18} color="#f59e0b" />
              <span>Competitive Programming & Coding Profiles</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="leetcode" className="form-label">LeetCode Username / URL</label>
                <input
                  id="leetcode"
                  type="text"
                  className="form-control"
                  value={leetcode}
                  onChange={(e) => setLeetcode(e.target.value)}
                  placeholder="e.g. tourister"
                />
              </div>

              <div className="form-group">
                <label htmlFor="codeforces" className="form-label">Codeforces Handle</label>
                <input
                  id="codeforces"
                  type="text"
                  className="form-control"
                  value={codeforces}
                  onChange={(e) => setCodeforces(e.target.value)}
                  placeholder="e.g. tourist"
                />
              </div>

              <div className="form-group">
                <label htmlFor="codechef" className="form-label">CodeChef Handle</label>
                <input
                  id="codechef"
                  type="text"
                  className="form-control"
                  value={codechef}
                  onChange={(e) => setCodechef(e.target.value)}
                  placeholder="e.g. gen_coder"
                />
              </div>
            </div>
          </div>

          {/* Social & Professional Links */}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={18} color="#38bdf8" />
              <span>Social & Portfolio Links</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="github" className="form-label">GitHub</label>
                <input
                  id="github"
                  type="text"
                  className="form-control"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="github.com/username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="linkedin" className="form-label">LinkedIn</label>
                <input
                  id="linkedin"
                  type="text"
                  className="form-control"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="linkedin.com/in/username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="portfolio" className="form-label">Portfolio Website</label>
                <input
                  id="portfolio"
                  type="text"
                  className="form-control"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="yourportfolio.dev"
                />
              </div>
            </div>
          </div>

          {/* Experience / Seniority */}
          <div className="form-group">
            <label htmlFor="experience" className="form-label">Years of Experience / Current Role</label>
            <input
              id="experience"
              type="text"
              className="form-control"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 3 years • Software Engineer at Tech Corp"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}
            >
              <Save size={16} />
              <span>{loading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
