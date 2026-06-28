'use client';

import { useState, useEffect, useRef } from 'react';
import { extractCodesFromText } from '@/lib/csv';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const [claimedCode, setClaimedCode] = useState(null);
  
  // Developer statistics lists and filters
  const [campaignsStats, setCampaignsStats] = useState([]);
  const [selectedDist, setSelectedDist] = useState('default');
  const [claimsList, setClaimsList] = useState([]);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  const fileInputRef = useRef(null);

  // Show dynamic toast alert
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Helper: Format slugs back into friendly campaign titles for UI rendering
  const getFriendlyName = (slug) => {
    if (!slug) return '';
    if (slug === 'default') return 'Default Pool';
    const parts = slug.split('-');
    if (parts.length > 1) {
      parts.pop(); // remove random hash suffix
    }
    return parts
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper: Generate safe, unguessable slugs with random hash suffixes
  const generateUnguessableSlug = (name) => {
    const slugified = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove special characters
      .replace(/[\s_]+/g, '-')  // replace spaces/underscores with hyphens
      .replace(/^-+|-+$/g, '');  // trim leading/trailing hyphens
    const hash = Math.random().toString(36).substring(2, 8); // 6 character random hash
    return `${slugified}-${hash}`;
  };

  // 1. Session check and routing on mount
  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (data.configMissing) {
        setConfigMissing(true);
        setLoading(false);
        return;
      }

      setUser(data.user);
      
      if (data.user) {
        if (data.user.isDeveloper) {
          await loadAdminDashboardData('default');
        } else {
          // Resolve current distribution slug from URL query params
          const searchParams = new URLSearchParams(window.location.search);
          const currentDist = searchParams.get('dist') || 'default';
          await checkOrClaimCode(currentDist);
        }
      }
    } catch (err) {
      showToast('Error validating profile session.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Developer Dashboard States
  const loadAdminDashboardData = async (distSlug) => {
    setSelectedDist(distSlug);
    await Promise.all([
      fetchAdminStats(distSlug),
      fetchClaimedCodes(distSlug)
    ]);
  };

  const fetchAdminStats = async (currentDist) => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (res.ok) {
        setCampaignsStats(data.stats || []);
        // If the selected distribution is not in the stats array (meaning it's a new empty one),
        // we keep the UI local state, otherwise we read it from stats.
      } else {
        showToast(data.error || 'Failed to load statistics.', 'error');
      }
    } catch (err) {
      showToast('Network error loading admin stats.', 'error');
    }
  };

  const fetchClaimedCodes = async (distSlug) => {
    try {
      const res = await fetch(`/api/admin/codes?dist=${encodeURIComponent(distSlug)}`);
      const data = await res.json();
      if (res.ok) {
        setClaimsList(data.claims || []);
      } else {
        showToast(data.error || 'Failed to load claims list.', 'error');
      }
    } catch (err) {
      showToast('Network error loading claims log.', 'error');
    }
  };

  // 3. Claim Code for standard user
  const checkOrClaimCode = async (distSlug) => {
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dist: distSlug })
      });
      const data = await res.json();
      if (res.ok) {
        setClaimedCode(data.code);
      } else {
        showToast(data.error || 'Claim transaction failed.', 'error');
      }
    } catch (err) {
      showToast('Network error while claiming promo code.', 'error');
    }
  };

  // 4. Bulk upload new codes for the active campaign
  const handleUpload = async (codes, targetDist = selectedDist) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dist: targetDist, codes }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully uploaded ${data.count} codes!`, 'success');
        await loadAdminDashboardData(targetDist);
      } else {
        showToast(data.error || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to database upload service.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Purge / Clear codes for the active campaign
  const handleClear = async () => {
    const campaignName = getFriendlyName(selectedDist);
    if (!confirm(`Are you absolutely sure you want to delete ALL promo codes and claim records for "${campaignName}"? This cannot be undone.`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dist: selectedDist })
      });
      if (res.ok) {
        showToast(`All codes for "${campaignName}" have been cleared.`, 'success');
        await loadAdminDashboardData(selectedDist);
      } else {
        const data = await res.json();
        showToast(data.error || 'Purge failed.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to purge service.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Create new campaign
  const handleCreateCampaign = () => {
    if (!newCampaignName.trim()) {
      showToast('Please type a campaign name.', 'error');
      return;
    }
    const slug = generateUnguessableSlug(newCampaignName);
    
    // Add temporary client stat to dropdown so we can select it
    setCampaignsStats(prev => [
      ...prev,
      { dist_slug: slug, total: 0, claimed: 0, remaining: 0 }
    ]);
    
    setSelectedDist(slug);
    setClaimsList([]);
    setNewCampaignName('');
    setShowCreateInput(false);
    showToast(`Campaign created! Share URL suffix: ?dist=${slug}`, 'success');
  };

  const handleDemoLogin = async (email) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        showToast(`Logged in as ${email}!`, 'success');
        setConfigMissing(false);
        setLoading(true);
        await fetchSession();
      } else {
        const data = await res.json();
        showToast(data.error || 'Demo login failed.', 'error');
      }
    } catch (err) {
      showToast('Network error during demo login.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================================
  // File Importer & Parsing Logic
  // ============================================================================

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const codes = extractCodesFromText(text);
      if (codes.length === 0) {
        showToast('No valid promo codes found in the selected file.', 'error');
        return;
      }
      await handleUpload(codes);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handlePasteSubmit = async () => {
    const codes = extractCodesFromText(pasteInput);
    if (codes.length === 0) {
      showToast('Please paste at least one valid promo code.', 'error');
      return;
    }
    await handleUpload(codes);
    setPasteInput('');
  };

  const copyToClipboard = (text, message = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text)
      .then(() => showToast(message, 'success'))
      .catch(() => showToast('Failed to copy.', 'error'));
  };

  const copyCampaignUrl = () => {
    const fullUrl = `${window.location.origin}/?dist=${selectedDist}`;
    copyToClipboard(fullUrl, 'Unguessable campaign link copied!');
  };

  // ============================================================================
  // Views Renders
  // ============================================================================

  // 1. Loading state screen
  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <div className="loading-text">Verifying server connection credentials...</div>
        </div>
      </div>
    );
  }

  // 2. Environment configuration missing screen
  if (configMissing) {
    return (
      <div className="container">
        <div className="user-container" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <div className="card" style={{ borderColor: 'var(--warning)' }}>
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h1 style={{ marginBottom: '1rem' }}>Configuration Required</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
                Vercel Postgres (<code>POSTGRES_URL</code>) or Google OAuth (<code>GOOGLE_CLIENT_ID</code>) is missing. 
                If you just clicked "1-Click Deploy", make sure the database is provisioned and your credentials are configured.
              </p>
              <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent)', overflowX: 'auto', marginBottom: '1.5rem' }}>
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
DEVELOPER_EMAILS=your-email@gmail.com
JWT_SECRET=your-custom-jwt-secret-key</pre>

              <div style={{ margin: '2rem 0 0.5rem 0', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Or Run in Demo Mode (Zero-Config)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                  No database setup or Google credentials required. Instantly test the app locally using a persistent file-based database.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                  <button onClick={() => handleDemoLogin('admin@example.com')} className="btn btn-primary" style={{ width: '100%' }} disabled={actionLoading}>
                    ⚡ Log in as Admin (admin@example.com)
                  </button>
                  <button onClick={() => handleDemoLogin('tester@example.com')} className="btn btn-secondary" style={{ width: '100%' }} disabled={actionLoading}>
                    👤 Log in as Tester (tester@example.com)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. User Header
  const renderHeader = () => {
    if (!user) return null;
    return (
      <header>
        <div className="brand">
          <div className="brand-icon">📦</div>
          <span className="brand-title">Code Distributor</span>
          {user.demoMode && (
            <span className="user-email" style={{ borderColor: 'var(--warning)', color: 'var(--warning)', marginLeft: '0.75rem', fontSize: '0.7rem', padding: '0.2rem 0.5rem', fontWeight: 'bold' }}>
              ⚠️ DEMO MODE
            </span>
          )}
        </div>
        <div className="user-nav">
          <span className="user-email">{user.email}</span>
          <a href="/api/auth/logout" className="btn btn-secondary">Sign Out</a>
        </div>
      </header>
    );
  };

  // 4. Toast Alerts
  const renderToasts = () => (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <div style={{ fontSize: '1.25rem' }}>
            {t.type === 'success' ? '⚡' : t.type === 'error' ? '❌' : 'ℹ️'}
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t.message}</div>
        </div>
      ))}
    </div>
  );

  // 5. Common Footer
  const renderFooter = (systemText) => {
    const gameName = process.env.NEXT_PUBLIC_GAME_NAME;
    const gameUrl = process.env.NEXT_PUBLIC_GAME_URL || '#';

    return (
      <footer>
        {gameName && (
          <div style={{ marginBottom: '0.5rem' }}>
            Built by the creator of{' '}
            <a 
              href={gameUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}
            >
              {gameName}
            </a>
            . Go wish-list it on the Play Store!
          </div>
        )}
        Closed-Test Code Distributor System • {systemText}
      </footer>
    );
  };

  // Active Statistics mapping for currently selected campaign
  const activeStat = campaignsStats.find(s => s.dist_slug === selectedDist) || { total: 0, claimed: 0, remaining: 0 };
  const userRequestedDist = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('dist') || 'default' : 'default';

  return (
    <div className="container">
      {renderHeader()}
      {renderToasts()}

      {!user ? (
        /* Landing Page View */
        <>
          <div className="landing-container">
            <div className="hero-text">
              <h1>Closed-Testing Code Delivery</h1>
              <p>
                Authenticate securely using your Google account to claim your unique promo code for the closed beta program.
              </p>
              <div className="feature-list">
                <div className="feature-item">
                  <span className="feature-check">✓</span>
                  <span>Instant promo code generation</span>
                </div>
                <div className="feature-item">
                  <span className="feature-check">✓</span>
                  <span>Double-allocation protection using atomic isolation</span>
                </div>
                <div className="feature-item">
                  <span className="feature-check">✓</span>
                  <span>Direct integration with Google Play Console</span>
                </div>
              </div>
            </div>
            <div className="landing-auth-card card">
              <div className="brand-icon" style={{ width: '50px', height: '50px', fontSize: '1.5rem', marginBottom: '0.5rem' }}>📦</div>
              <h2>Join the Closed Beta</h2>
              <p>Sign in to register your testing account and claim your key.</p>
              <a href="/api/auth/login" className="btn btn-google btn-primary" style={{ background: 'white', color: '#1f2937', border: '1px solid #d1d5db', width: '100%' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </a>
            </div>
          </div>
          {renderFooter('Powered by Next.js & Vercel Postgres')}
        </>
      ) : user.isDeveloper ? (
        /* Developer Dashboard View */
        <>
          <div className="dev-container">
            {/* Top Workspace Selector Row */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <label htmlFor="campaign-select" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Active Campaign:
                  </label>
                  <select 
                    id="campaign-select"
                    value={selectedDist}
                    onChange={(e) => loadAdminDashboardData(e.target.value)}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1.5rem 0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Ensure default is always present */}
                    {campaignsStats.every(s => s.dist_slug !== 'default') && (
                      <option value="default">{getFriendlyName('default')}</option>
                    )}
                    {campaignsStats.map(s => (
                      <option key={s.dist_slug} value={s.dist_slug}>
                        {getFriendlyName(s.dist_slug)}
                      </option>
                    ))}
                  </select>

                  <button 
                    onClick={copyCampaignUrl} 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                    title="Copy unguessable URL for this campaign"
                  >
                    🔗 Copy Campaign Link
                  </button>
                </div>

                <button 
                  onClick={() => setShowCreateInput(!showCreateInput)} 
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  {showCreateInput ? 'Cancel' : '➕ Create New Campaign'}
                </button>
              </div>

              {/* Create new campaign toggle input */}
              {showCreateInput && (
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '1rem 0 0.5rem 0',
                  borderTop: '1px solid var(--border)',
                  animation: 'slideIn 0.15s forwards'
                }}>
                  <input 
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="E.g. Alpha Wave 1"
                    style={{
                      flex: 1,
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.75rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                  <button onClick={handleCreateCampaign} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                    Generate Slug
                  </button>
                </div>
              )}

              {/* Display copyable link helper */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                <strong>Share URL: </strong> 
                <code style={{ color: 'var(--accent)' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/?dist=${selectedDist}` : `/?dist=${selectedDist}`}
                </code>
              </div>
            </div>

            {/* Campaign Counters */}
            <div className="stats-grid">
              <div className="stat-card total">
                <span className="stat-label">Total Uploaded Codes</span>
                <span className="stat-value">{activeStat.total}</span>
              </div>
              <div className="stat-card claimed">
                <span className="stat-label">Claimed Codes</span>
                <span className="stat-value">{activeStat.claimed}</span>
              </div>
              <div className="stat-card remaining">
                <span className="stat-label">Remaining Codes</span>
                <span className="stat-value">{activeStat.remaining}</span>
              </div>
            </div>

            <div className="dev-panels">
              {/* Left Panel: CSV importer */}
              <div className="card">
                <div className="panel-header">
                  <h2>Import Codes for "{getFriendlyName(selectedDist)}"</h2>
                  {activeStat.total > 0 && (
                    <button onClick={handleClear} className="btn btn-danger btn-sm" disabled={actionLoading}>
                      Clear Campaign
                    </button>
                  )}
                </div>
                
                <div 
                  className={`upload-area ${dragActive ? 'dragover' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    id="csv-file" 
                    accept=".csv,.txt" 
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                    disabled={actionLoading}
                    style={{ display: 'none' }}
                  />
                  <div className="upload-icon">📥</div>
                  <div className="upload-text">
                    <span>Click to upload</span> or drag and drop
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Accepts CSV or TXT exports from Google Play</div>
                </div>

                <div className="divider">Or paste codes manually</div>

                <div className="paste-area">
                  <textarea 
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder="Paste codes here (one per line, e.g. A1B2C3D4...)" 
                    disabled={actionLoading}
                  />
                  <button onClick={handlePasteSubmit} className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Uploading...' : 'Process & Upload'}
                  </button>
                </div>
              </div>

              {/* Right Panel: Claims list log */}
              <div className="card">
                <div className="panel-header">
                  <h2>Distribution Log</h2>
                  <span className="user-email" style={{ fontSize: '0.75rem' }}>{claimsList.length} Claimed</span>
                </div>
                
                <div className="table-wrapper">
                  <table className="claims-table">
                    <thead>
                      <tr>
                        <th>Email Address</th>
                        <th>Assigned Code</th>
                        <th>Claim Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claimsList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="table-empty">No promo codes claimed for this campaign yet.</td>
                        </tr>
                      ) : (
                        claimsList.map((row, index) => (
                          <tr key={index}>
                            <td className="email-cell" title={row.claimed_by_email}>{row.claimed_by_email}</td>
                            <td className="code-cell">{row.code}</td>
                            <td className="time-cell">{new Date(row.claimed_at).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          {renderFooter('Developer Panel')}
        </>
      ) : (
        /* User Claim View */
        <>
          <div className="user-container">
            <div className="card">
              {claimedCode ? (
                <>
                  <div className="claim-header">
                    <h1>Claim Success!</h1>
                    <p style={{ marginTop: '0.5rem' }}>
                      Your testing promo code for <strong>"{getFriendlyName(userRequestedDist)}"</strong> is allocated below.
                    </p>
                  </div>
                  
                  <div className="claim-box">
                    <span className="claim-label">Google Play Promo Code</span>
                    <div className="promo-code-display">{claimedCode}</div>
                    <div className="claim-actions">
                      <button onClick={() => copyToClipboard(claimedCode, 'Promo code copied!')} className="btn btn-secondary">Copy Code</button>
                      <a href={`https://play.google.com/store?code=${claimedCode}`} target="_blank" className="btn btn-primary">Redeem Code</a>
                    </div>
                  </div>

                  <div className="instructions-card">
                    <h3>Next Steps:</h3>
                    <ol>
                      <li>Click <span>Redeem Code</span> to apply it to your Google Play Account.</li>
                      <li>Ensure you are signed in on your testing device with <span>{user.email}</span>.</li>
                      <li>Download the app and join the active closed-testing phase.</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">⚠️</div>
                  <h2>No Promo Codes Available</h2>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.5' }}>
                    All promo codes for the campaign <strong>"{getFriendlyName(userRequestedDist)}"</strong> have already been allocated. 
                    Please contact the developers or check back later.
                  </p>
                </div>
              )}
            </div>
          </div>
          {renderFooter('Powered by Next.js & Vercel Postgres')}
        </>
      )}
    </div>
  );
}
