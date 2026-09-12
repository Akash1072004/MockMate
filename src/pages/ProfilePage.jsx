import React, { useState, useEffect } from 'react';
import { User, Save, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInterviewerRatingSummary } from '../services/reviewService';

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [experience, setExperience] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [ratingStats, setRatingStats] = useState(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setSkills(Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills || '');
      setGithub(profile.github || '');
      setLinkedin(profile.linkedin || '');
      setPortfolio(profile.portfolio || '');
      setExperience(profile.experience || '');
    } else if (user) {
      setFullName(user.user_metadata?.full_name || '');
    }

    if (user?.id && profile?.role === 'interviewer') {
      getInterviewerRatingSummary(user.id).then((stats) => {
        if (stats) setRatingStats(stats);
      });
    }
  }, [profile, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    setLoading(true);
    try {
      const skillsArray = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim(),
        skills: skillsArray,
        github: github.trim(),
        linkedin: linkedin.trim(),
        portfolio: portfolio.trim(),
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

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '720px' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="feature-icon-wrapper">
              <User size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Your Profile</h1>
              <p style={{ fontSize: '0.9rem' }}>
                Manage your personal information, technical skills, and portfolio links.
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
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email (Immutable)</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bio">Professional Bio</label>
            <textarea
              id="bio"
              className="form-textarea"
              rows={3}
              placeholder="Full stack software engineer passionate about distributed systems and React..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="skills">Technical Skills (comma-separated)</label>
            <input
              id="skills"
              type="text"
              className="form-input"
              placeholder="Python, Java, C++, React, Data Structures, Algorithms"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="github">GitHub</label>
              <input
                id="github"
                type="text"
                className="form-input"
                placeholder="github.com/username"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="linkedin">LinkedIn</label>
              <input
                id="linkedin"
                type="text"
                className="form-input"
                placeholder="linkedin.com/in/username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="portfolio">Portfolio URL</label>
              <input
                id="portfolio"
                type="text"
                className="form-input"
                placeholder="https://myportfolio.dev"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="experience">Years of Experience</label>
              <input
                id="experience"
                type="text"
                className="form-input"
                placeholder="3+ years"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              <Save size={18} />
              <span>{loading ? 'Saving Changes...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
