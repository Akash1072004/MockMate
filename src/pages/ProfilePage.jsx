import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Briefcase,
  Edit3,
  ArrowLeft,
  X,
  Camera,
  RotateCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInterviewerRatingSummary } from '../services/reviewService';
import { getCandidateResume, uploadResume, deleteResume } from '../services/resumeService';
import { uploadAvatar } from '../services/avatarService';

export default function ProfilePage() {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Mode: View vs Edit
  const searchParams = new URLSearchParams(location.search);
  const initialEditMode = searchParams.get('edit') === 'true';
  const [isEditing, setIsEditing] = useState(initialEditMode);

  // Form states
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
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

  // Avatar upload staging states
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const avatarInputRef = useRef(null);

  // Resume state (for candidate)
  const [resumeData, setResumeData] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeSuccess, setResumeSuccess] = useState('');
  const resumeInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [ratingStats, setRatingStats] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Populate state from profile
  const populateFields = (prof, usr) => {
    if (prof) {
      setFullName(prof.full_name || '');
      setAvatarUrl(prof.avatar_url || '');
      setUsername(prof.username || '');
      setHeadline(prof.headline || '');
      setBio(prof.bio || '');
      setSkills(Array.isArray(prof.skills) ? prof.skills.join(', ') : prof.skills || '');
      setGithub(prof.github || '');
      setLinkedin(prof.linkedin || '');
      setPortfolio(prof.portfolio || '');
      setLeetcode(prof.leetcode || '');
      setCodeforces(prof.codeforces || '');
      setCodechef(prof.codechef || '');
      setExperience(prof.experience || '');
    } else if (usr) {
      setFullName(usr.user_metadata?.full_name || '');
      setAvatarUrl(usr.user_metadata?.avatar_url || '');
    }
  };

  useEffect(() => {
    populateFields(profile, user);

    if (user?.id) {
      if (profile?.role === 'candidate' || !profile?.role) {
        getCandidateResume(user.id).then((res) => {
          if (res) setResumeData(res);
        });
      }

      if (profile?.role === 'interviewer') {
        getInterviewerRatingSummary(user.id).then((stats) => {
          if (stats) setRatingStats(stats);
        });
      }
    }
  }, [profile, user]);

  // Sync edit mode with URL param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('edit') === 'true') {
      setIsEditing(true);
    }
  }, [location.search]);

  // Handle local avatar file selection (with instant preview BEFORE upload)
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size exceeds 5 MB. Please select a smaller photo.');
      return;
    }

    // Validate format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Unsupported format. Please select a JPG, JPEG, PNG, or WebP photo.');
      return;
    }

    setError('');
    setSelectedAvatarFile(file);

    // Create object preview URL
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setAvatarPreviewUrl(preview);
  };

  const handleRemovePhoto = () => {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(null);
    setSelectedAvatarFile(null);
    setAvatarUrl('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCancelEdit = () => {
    // Discard any staged avatar file & preview
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(null);
    setSelectedAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';

    // Restore original profile values
    populateFields(profile, user);
    setError('');
    setSuccess('');
    setIsEditing(false);
    navigate('/profile', { replace: true });
  };

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
      if (resumeInputRef.current) resumeInputRef.current.value = '';
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

  // Gracefully normalize social/coding handles without crashing on plain usernames
  const sanitizeHandle = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    return s;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    // Clean and validate username
    let cleanUsername = username ? username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : null;
    if (!cleanUsername) cleanUsername = null;

    setLoading(true);
    try {
      let finalAvatarUrl = avatarUrl;

      // 1. If a new avatar file was selected, upload it now
      if (selectedAvatarFile && user?.id) {
        try {
          finalAvatarUrl = await uploadAvatar({ userId: user.id, file: selectedAvatarFile });
          setAvatarUrl(finalAvatarUrl);
        } catch (uploadErr) {
          console.error('[ProfilePage] Avatar upload failed during save:', uploadErr);
          setError(`Failed to upload profile picture: ${uploadErr.message}`);
          setLoading(false);
          return;
        }
      }

      // 2. Parse skills array
      const skillsArray = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // 3. Update Supabase profiles row
      const updated = await updateProfile({
        full_name: fullName.trim(),
        avatar_url: finalAvatarUrl || null,
        username: cleanUsername,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        skills: skillsArray.length > 0 ? skillsArray : null,
        github: sanitizeHandle(github),
        linkedin: sanitizeHandle(linkedin),
        portfolio: sanitizeHandle(portfolio),
        leetcode: sanitizeHandle(leetcode),
        codeforces: sanitizeHandle(codeforces),
        codechef: sanitizeHandle(codechef),
        experience: experience.trim() || null,
      });

      console.log('[ProfilePage] Profile saved successfully:', updated?.full_name);

      // 4. Clean up preview object URL
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarPreviewUrl(null);
      }
      setSelectedAvatarFile(null);

      // 5. Update UI state & return to View mode
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      navigate('/profile', { replace: true });
      if (refreshProfile) refreshProfile();
    } catch (err) {
      console.error('[ProfilePage] Failed to save profile:', err);
      setError(`Failed to update profile: ${err.message || 'Database error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const role = profile?.role || user?.user_metadata?.role || 'candidate';
  const dashboardPath = role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
  const publicProfileSlug = username || user?.id;
  const initial = (fullName || user?.email || 'U').charAt(0).toUpperCase();
  const currentAvatarDisplay = avatarPreviewUrl || avatarUrl;

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '880px' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={dashboardPath} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>
            {isEditing ? 'Edit Profile' : 'Profile'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(true)} 
                className="btn btn-primary btn-sm" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </button>
              {publicProfileSlug && (
                <>
                  <Link to={`/candidates/${publicProfileSlug}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Eye size={15} />
                    <span>View Public Page</span>
                  </Link>
                  <button onClick={handleCopyPublicLink} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {copiedLink ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                    <span>{copiedLink ? 'Copied Link!' : 'Share'}</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <button 
              type="button"
              onClick={handleCancelEdit} 
              className="btn btn-secondary btn-sm" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <X size={15} />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alerts */}
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

      {/* ========================================================================= */}
      {/* MODE 1: VIEW PROFILE MODE                                                 */}
      {/* ========================================================================= */}
      {!isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Profile Overview Card */}
          <div className="card" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                {/* Avatar / Profile Picture */}
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.85rem',
                  fontWeight: 700,
                  overflow: 'hidden',
                  border: '3px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                  flexShrink: 0,
                }}>
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={fullName} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    initial
                  )}
                </div>

                {/* Name, Username, Role */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                      {fullName || 'Unnamed User'}
                    </h2>
                    <span className={`badge ${role === 'interviewer' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.75rem' }}>
                      {role === 'interviewer' ? 'Verified Interviewer' : 'Candidate'}
                    </span>
                  </div>

                  {username && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', fontWeight: 600, marginBottom: '0.35rem' }}>
                      @{username}
                    </div>
                  )}

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {user?.email}
                  </div>
                </div>
              </div>

              {/* Action */}
              <button 
                onClick={() => setIsEditing(true)} 
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Edit3 size={14} />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Headline */}
            {headline && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
                  {headline}
                </div>
              </div>
            )}

            {/* Experience */}
            {experience && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <Briefcase size={15} color="#818cf8" />
                <span>{experience}</span>
              </div>
            )}

            {/* Bio */}
            {bio && (
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {bio}
              </div>
            )}

            {/* Rating summary for Interviewer */}
            {role === 'interviewer' && ratingStats?.averageRating && (
              <div style={{
                marginTop: '1.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
              }}>
                <Star size={16} fill="#f59e0b" color="#f59e0b" />
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                  {ratingStats.averageRating} / 5.0 Rating
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({ratingStats.totalReviews} review{ratingStats.totalReviews === 1 ? '' : 's'})
                </span>
              </div>
            )}
          </div>

          {/* Skills Card */}
          {skills && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Code2 size={16} color="#818cf8" />
                <span>Skills & Expertise</span>
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {skills.split(',').map((s, idx) => s.trim()).filter(Boolean).map((s, idx) => (
                  <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social & Professional Links */}
          {(github || linkedin || portfolio || leetcode || codeforces || codechef) && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Globe size={16} color="#38bdf8" />
                <span>Links & Profiles</span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {github && (
                  <a 
                    href={github.startsWith('http') ? github : `https://github.com/${github.replace(/^@/, '')}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span>GitHub</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                {linkedin && (
                  <a 
                    href={linkedin.startsWith('http') ? linkedin : `https://linkedin.com/in/${linkedin.replace(/^@/, '')}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span>LinkedIn</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                {portfolio && (
                  <a 
                    href={portfolio.startsWith('http') ? portfolio : `https://${portfolio}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span>Portfolio</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                {leetcode && (
                  <a 
                    href={leetcode.startsWith('http') ? leetcode : `https://leetcode.com/${leetcode.replace(/^@/, '')}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}
                  >
                    <span>LeetCode</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                {codeforces && (
                  <a 
                    href={codeforces.startsWith('http') ? codeforces : `https://codeforces.com/profile/${codeforces.replace(/^@/, '')}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
                  >
                    <span>Codeforces</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                {codechef && (
                  <a 
                    href={codechef.startsWith('http') ? codechef : `https://www.codechef.com/users/${codechef.replace(/^@/, '')}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between', borderColor: 'rgba(168, 85, 247, 0.3)', color: '#c084fc' }}
                  >
                    <span>CodeChef</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Candidate Resume Section (Only shown for Candidates) */}
          {role === 'candidate' && (
            <div className="card" style={{ padding: '1.75rem', borderTop: '3px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <FileText size={20} color="#818cf8" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Candidate Resume</h3>
                </div>
                {resumeData?.fileName ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={13} />
                    <span>Resume Active</span>
                  </span>
                ) : (
                  <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={13} />
                    <span>No Resume Uploaded</span>
                  </span>
                )}
              </div>

              {resumeData?.fileName ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{resumeData.fileName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {resumeData.fileSize ? `${(resumeData.fileSize / 1024).toFixed(1)} KB` : 'Uploaded'} &bull; Protected via Supabase Storage
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(resumeData.signedUrl || resumeData.dataUrl) && (
                      <a href={resumeData.signedUrl || resumeData.dataUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                        <Eye size={13} />
                        <span>View</span>
                      </a>
                    )}
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="btn btn-secondary btn-sm"
                    >
                      <Upload size={13} />
                      <span>Replace</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.01)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0' }}>
                    Upload your resume to enable live mock interview matching and AI question personalization.
                  </p>
                  <button onClick={() => setIsEditing(true)} className="btn btn-primary btn-sm">
                    <Upload size={14} />
                    <span>Upload Resume in Edit Profile</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: EDIT PROFILE FORM MODE                                            */
        /* ========================================================================= */
        <div className="card" style={{ padding: '2.5rem 2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            
            {/* Profile Picture Upload & Preview Section */}
            <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {/* Live Avatar Preview */}
                <div style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '2rem',
                  fontWeight: 700,
                  overflow: 'hidden',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  flexShrink: 0,
                  position: 'relative',
                }}>
                  {currentAvatarDisplay ? (
                    <img 
                      src={currentAvatarDisplay} 
                      alt="Avatar Preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    initial
                  )}
                </div>

                {/* Upload / Change Photo Controls */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>Profile Picture</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
                    Upload a square JPG, PNG, or WebP photo (Max 5 MB).
                  </p>

                  <input 
                    type="file" 
                    ref={avatarInputRef}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleAvatarFileSelect}
                    style={{ display: 'none' }}
                  />

                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Camera size={14} />
                      <span>Change Photo</span>
                    </button>

                    {(currentAvatarDisplay) && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="btn btn-outline btn-sm"
                        style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      >
                        <Trash2 size={13} />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>

                  {selectedAvatarFile && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle2 size={13} />
                      <span>New photo selected: {selectedAvatarFile.name} (will save on submit)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Info */}
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
                  Used in your public share link: /candidates/{username || 'username'}
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
                placeholder="e.g. Senior Software Engineer | Distributed Systems & Algorithms"
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
                placeholder="Share your technical background, engineering passions, and career focus..."
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Years of Experience / Role */}
            <div className="form-group">
              <label htmlFor="experience" className="form-label">Years of Experience / Current Role</label>
              <textarea
                id="experience"
                className="form-control"
                rows={2}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. 4+ years of software development experience specializing in full-stack web and cloud systems."
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
                placeholder="e.g. Python, C++, React, TypeScript, Node.js, SQL, Distributed Systems"
              />
            </div>

            {/* Competitive Programming Handles */}
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={18} color="#f59e0b" />
                <span>Competitive Programming Handles</span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="leetcode" className="form-label">LeetCode</label>
                  <input
                    id="leetcode"
                    type="text"
                    className="form-control"
                    value={leetcode}
                    onChange={(e) => setLeetcode(e.target.value)}
                    placeholder="Username or URL"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="codeforces" className="form-label">Codeforces</label>
                  <input
                    id="codeforces"
                    type="text"
                    className="form-control"
                    value={codeforces}
                    onChange={(e) => setCodeforces(e.target.value)}
                    placeholder="Handle or URL"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="codechef" className="form-label">CodeChef</label>
                  <input
                    id="codechef"
                    type="text"
                    className="form-control"
                    value={codechef}
                    onChange={(e) => setCodechef(e.target.value)}
                    placeholder="Handle or URL"
                  />
                </div>
              </div>
            </div>

            {/* Social & Portfolio Links */}
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
                    placeholder="Username or URL"
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
                    placeholder="Username or URL"
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
                    placeholder="Website or URL"
                  />
                </div>
              </div>
            </div>

            {/* Candidate Resume Management (Only shown for Candidates) */}
            {role === 'candidate' && (
              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="#818cf8" />
                  <span>Resume Document</span>
                </h3>

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
                      <FileText size={26} color="#a5b4fc" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{resumeData.fileName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {resumeData.fileSize ? `${(resumeData.fileSize / 1024).toFixed(1)} KB` : 'Uploaded'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="file"
                        ref={resumeInputRef}
                        accept=".pdf,.txt,.md,.doc,.docx"
                        onChange={handleResumeFileUpload}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={uploadingResume}
                        onClick={() => resumeInputRef.current?.click()}
                      >
                        <Upload size={13} />
                        <span>{uploadingResume ? 'Uploading...' : 'Replace'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={handleDeleteResume}
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                      Select a PDF or text resume to upload.
                    </p>
                    <input
                      type="file"
                      ref={resumeInputRef}
                      accept=".pdf,.txt,.md,.doc,.docx"
                      onChange={handleResumeFileUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={uploadingResume}
                      onClick={() => resumeInputRef.current?.click()}
                    >
                      <Upload size={14} />
                      <span>{uploadingResume ? 'Uploading...' : 'Select File (PDF / Text)'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
              >
                {loading ? <RotateCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                <span>{loading ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
