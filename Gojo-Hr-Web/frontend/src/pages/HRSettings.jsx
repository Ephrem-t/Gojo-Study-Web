import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaFacebookMessenger, FaCog } from 'react-icons/fa';
import api from '../api';
import './Dashboard.css';
import '../styles/global.css';
import Sidebar from '../components/Sidebar';

export default function HRSettings() {
  const navigate = useNavigate();
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

  async function handleSave() {
    setIsSaving(true);
    setMessage('');
    try {
      // Resolve user id from admin cache or by looking up /users
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

      // If a File was selected for profileImage, upload it first
      if (profileImage && typeof profileImage !== 'string' && userId) {
        const fform = new FormData();
        fform.append('profile', profileImage);
        // upload to users endpoint
        const upRes = await api.post(`/users/${userId}/upload_profile_image`, fform, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        profileUrl = upRes.data?.profileImageUrl || profileUrl;
      }

      // Now update the user record (best-effort)
      if (userId) {
        const payload = {
          name: displayName,
          username: username,
        };
        if (profileUrl) payload.profileImage = profileUrl;
        if (password) payload.password = password;
        await api.put(`/users/${userId}`, payload);
      } else {
        // If we could not resolve a user id, persist locally and inform admin
        setMessage('Profile saved locally but could not find backend user id. Please re-login.');
      }

      // Update local admin cache
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
      // If backend provided structured JSON, prefer its fields
      if (resp && typeof resp === 'object') {
        const msgParts = [];
        if (resp.error) msgParts.push(resp.error);
        if (resp.hint) msgParts.push(resp.hint);
        if (resp.trace) {
          // keep trace out of the main UI message but log it
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
      <nav className="top-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2>Gojo HR</h2>
          <span className="muted">— Admin Dashboard</span>
        </div>

        <div className="nav-right">
          <div className="icon-circle" title="Notifications"><FaBell /></div>
          <div className="icon-circle" title="Messages" onClick={() => navigate('/all-chat')}><FaFacebookMessenger /></div>
          <button className="icon-circle" aria-label="Settings"><FaCog /></button>
          <img src={admin.profileImage || '/default-profile.png'} alt="admin" className="profile-img" />
        </div>
      </nav>

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

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, padding: '0 2px', width: '100%' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e6ecf8', boxShadow: '0 10px 24px rgba(17,24,39,0.08)', padding: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>HR Settings</h3>
            <p style={{ color: '#6b7280', marginTop: 6 }}>Update your profile details and image.</p>

            {message ? (<div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6ecf8', background: '#f8fafc', color: '#111827' }}>{message}</div>) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, marginTop: 18, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 120, height: 120, borderRadius: 16, overflow: 'hidden', margin: '0 auto', background: '#f1f5f9' }}>
                  {preview ? (
                    <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src='/default-profile.png'}} />
                  ) : (
                    <img src="/default-profile.png" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <label style={{ display: 'block', marginTop: 8, cursor: 'pointer', color: '#4b6cb7', fontWeight: 800 }}>
                  Change image
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Display name</label>
                    <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid #e6ecf4', padding: '0 12px', marginTop: 6 }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Username</label>
                    <input value={username} onChange={(e)=>setUsername(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid #e6ecf4', padding: '0 12px', marginTop: 6 }} />
                  </div>
                </div>

               

                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Change password</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <input type="password" placeholder="New password" value={password} onChange={(e)=>setPassword(e.target.value)} style={{ height: 40, borderRadius: 10, border: '1px solid #e6ecf4', padding: '0 10px' }} />
                    <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} style={{ height: 40, borderRadius: 10, border: '1px solid #e6ecf4', padding: '0 10px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button onClick={handleSave} disabled={isSaving} style={{ height: 44, borderRadius: 10, background: '#4b6cb7', color: '#fff', padding: '0 18px', border: 'none', fontWeight: 800 }}>
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>

                  <button onClick={()=>{ /* revert changes */ setPreview(admin?.profileImage||admin?.photoURL||''); setDisplayName(admin?.displayName||admin?.name||''); setUsername(admin?.username||admin?.userName||admin?.hrId||''); }} style={{ height: 44, borderRadius: 10, background: '#fff', border: '1px solid #e6ecf8', padding: '0 18px', fontWeight: 800 }}>
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
