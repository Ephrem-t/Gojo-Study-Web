import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMoon, FaSun } from 'react-icons/fa';
import api from '../api';
import './Dashboard.css';
import '../styles/global.css';
import Sidebar from '../components/Sidebar';
import TopNavbar from '../components/TopNavbar';
import { useTheme } from '../theme/ThemeContext';

export default function HRSettings() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin') || '{}');
    } catch {
      return {};
    }
  });

  const [displayName, setDisplayName] = useState(admin?.displayName || admin?.name || '');
  const [username, setUsername] = useState(admin?.username || admin?.userName || admin?.hrId || '');
  const [profileImage, setProfileImage] = useState(admin?.profileImage || admin?.photoURL || '');
  const [preview, setPreview] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDisplayName(admin?.displayName || admin?.name || '');
    setUsername(admin?.username || admin?.userName || admin?.hrId || '');
    setProfileImage(admin?.profileImage || admin?.photoURL || '');
    setPreview(admin?.profileImage || admin?.photoURL || '');
  }, [admin]);

  function handleFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(f);
    setProfileImage(f);
  }

  function handleReset() {
    setPreview(admin?.profileImage || admin?.photoURL || '');
    setProfileImage(admin?.profileImage || admin?.photoURL || '');
    setDisplayName(admin?.displayName || admin?.name || '');
    setUsername(admin?.username || admin?.userName || admin?.hrId || '');
    setPassword('');
    setConfirmPassword('');
    setMessage('');
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage('');
    try {
      let userId = admin?.id || admin?.userId || admin?.uid || admin?.user_id || admin?.adminId || admin?.hrId || admin?.employeeId;
      if (!userId) {
        try {
          const all = await api.get('/users');
          const users = all.data || {};
          const candidates = Array.isArray(users) ? users : Object.entries(users || {}).map(([k, v]) => ({ id: k, ...v }));
          const match = candidates.find((u) => (u.username && admin?.username && u.username === admin.username) || (u.email && admin?.email && u.email === admin.email));
          if (match) userId = match.id || match.uid || match.userId;
        } catch (e) {
          console.warn('lookup users failed', e);
        }
      }

      if (password && password !== confirmPassword) {
        setMessage('Passwords do not match');
        setIsSaving(false);
        return;
      }
      let profileUrl = preview || '';

      if (profileImage && typeof profileImage !== 'string' && userId) {
        const fform = new FormData();
        fform.append('profile', profileImage);
        const upRes = await api.post(`/users/${userId}/upload_profile_image`, fform, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        profileUrl = upRes.data?.profileImageUrl || profileUrl;
      }

      if (userId) {
        const payload = {
          name: displayName,
          username,
        };
        if (profileUrl) payload.profileImage = profileUrl;
        if (password) payload.password = password;
        await api.put(`/users/${userId}`, payload);
      } else {
        setMessage('Profile saved locally but could not find backend user id. Please re-login.');
      }

      const updated = { ...(admin || {}) };
      updated.displayName = displayName;
      updated.username = username;
      updated.profileImage = profileUrl || updated.profileImage;
      localStorage.setItem('admin', JSON.stringify(updated));
      setAdmin(updated);
      setMessage('Profile updated');
    } catch (e) {
      console.error('HRSettings save error:', e);
      const resp = e?.response?.data;
      if (resp && typeof resp === 'object') {
        const msgParts = [];
        if (resp.error) msgParts.push(resp.error);
        if (resp.hint) msgParts.push(resp.hint);
        if (resp.trace) {
          console.debug('Backend trace:', resp.trace);
        }
        const composed = msgParts.join(' — ') || JSON.stringify(resp);
        setMessage(composed);
      } else {
        const err = e?.response?.statusText || e?.message || 'Failed to update profile';
        setMessage(err);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh' }}>
      <TopNavbar admin={admin} />

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: '18px 14px', minHeight: '100vh', background: 'var(--page-bg, #f4f6fb)', width: '100%', boxSizing: 'border-box' }}>
        <Sidebar
          admin={admin}
          fullHeight
          top={4}
          onLogout={() => {
            localStorage.removeItem('admin');
            navigate('/login', { replace: true });
          }}
        />

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - var(--topbar-height, 56px) - 36px)', maxHeight: 'calc(100vh - var(--topbar-height, 56px) - 36px)', overflowY: 'auto', position: 'relative', padding: '0 2px 18px', width: '100%' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f8fafc) 100%)', borderRadius: 16, border: '1px solid var(--border-soft, #e6ecf8)', boxShadow: 'var(--shadow-panel, 0 10px 24px rgba(17,24,39,0.08))', padding: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary, #111827)' }}>HR Settings</h3>
            <p style={{ color: 'var(--text-muted, #6b7280)', marginTop: 6 }}>Update your profile details, image, and theme preference.</p>

            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px', borderRadius: 14, border: '1px solid var(--border-soft, #dbe2f2)', background: 'linear-gradient(135deg, var(--surface-accent, #eff6ff) 0%, var(--surface-panel, #fff) 100%)', boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary, #475569)' }}>Appearance</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{isDark ? 'Dark mode is active' : 'Light mode is active'}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>This preference is saved locally and follows you across all HR routes.</div>
              </div>

              <button type="button" onClick={toggleTheme} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 44, borderRadius: 999, border: '1px solid var(--border-strong, #bfdbfe)', background: isDark ? 'linear-gradient(135deg, var(--warning-soft, rgba(120, 53, 15, 0.34)) 0%, var(--surface-panel, #fff) 100%)' : 'linear-gradient(135deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f8fafc) 100%)', color: 'var(--text-primary, #111827)', padding: '0 18px', fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))' }}>
                {isDark ? <FaSun /> : <FaMoon />}
                {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              </button>
            </div>

            {message ? (<div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft, #e6ecf8)', background: 'var(--surface-muted, #f8fafc)', color: 'var(--text-primary, #111827)' }}>{message}</div>) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, marginTop: 18, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 120, height: 120, borderRadius: 16, overflow: 'hidden', margin: '0 auto', background: 'var(--surface-muted, #f1f5f9)', border: '1px solid var(--border-soft, #dbe2f2)' }}>
                  {preview ? (
                    <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src='/default-profile.png'}} />
                  ) : (
                    <img src="/default-profile.png" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <label style={{ display: 'block', marginTop: 8, cursor: 'pointer', color: 'var(--accent-strong, #4b6cb7)', fontWeight: 800 }}>
                  Change image
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>Display name</label>
                    <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--input-border, #e6ecf4)', background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111827)', padding: '0 12px', marginTop: 6 }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>Username</label>
                    <input value={username} onChange={(e)=>setUsername(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--input-border, #e6ecf4)', background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111827)', padding: '0 12px', marginTop: 6 }} />
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>Change password</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <input type="password" placeholder="New password" value={password} onChange={(e)=>setPassword(e.target.value)} style={{ height: 40, borderRadius: 10, border: '1px solid var(--input-border, #e6ecf4)', background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111827)', padding: '0 10px' }} />
                    <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} style={{ height: 40, borderRadius: 10, border: '1px solid var(--input-border, #e6ecf4)', background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111827)', padding: '0 10px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button onClick={handleSave} disabled={isSaving} style={{ height: 44, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent, #4b6cb7) 0%, var(--accent-strong, #1d4ed8) 100%)', color: '#fff', padding: '0 18px', border: 'none', fontWeight: 800 }}>
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>

                  <button onClick={handleReset} style={{ height: 44, borderRadius: 10, background: 'var(--surface-panel, #fff)', color: 'var(--text-primary, #111827)', border: '1px solid var(--border-soft, #e6ecf8)', padding: '0 18px', fontWeight: 800 }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
