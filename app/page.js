'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const [claimedCode, setClaimedCode] = useState(null);
  const [stats, setStats] = useState({ total: 0, claimed: 0, remaining: 0 });
  const [claimsList, setClaimsList] = useState([]);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
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

  // 1. Session check on mount
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
          await Promise.all([fetchAdminStats(), fetchClaimedCodes()]);
        } else {
          await checkOrClaimCode();
        }
      }
    } catch (err) {
      showToast('Error validating profile session.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Developer Stats
  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
      } else {
        showToast(data.error || 'Failed to load stats.', 'error');
      }
    } catch (err) {
      showToast('Network error loading admin stats.', 'error');
    }
  };

  // 3. Fetch Claims Log
  const fetchClaimedCodes = async () => {
    try {
      const res = await fetch('/api/admin/codes');
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

  // 4. Claim Code for standard user
  const checkOrClaimCode = async () => {
    try {
      const res = await fetch('/api/claim', { method: 'POST' });
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

  // 5. Bulk upload new codes
  const handleUpload = async (codes) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully uploaded ${data.count} codes!`, 'success');
        await Promise.all([fetchAdminStats(), fetchClaimedCodes()]);
      } else {
        showToast(data.error || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to database upload service.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Purge / Clear all codes
  const handleClear = async () => {
    if (!confirm('Are you absolutely sure you want to delete ALL promo codes and claim records? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/codes', { method: 'DELETE' });
      if (res.ok) {
        showToast('All codes and claims have been cleared.', 'success');
        setStats({ total: 0, claimed: 0, remaining: 0 });
        setClaimsList([]);
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

  // ============================================================================
  // CSV Importer Parsing
  // ============================================================================
  const extractCodesFromText = (text) => {
    const lines = text.split(/\r?\n/);
    const codes = new Set();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = line.split(/[,\t;]/).map(c => c.replace(/^["']|["']$/g, '').trim());
      
      for (const cell of cells) {
        // Collect alphanumeric promo codes between 8 and 30 characters
        if (cell.length >= 8 && cell.length <= 30 && /^[A-Z0-9_\-]+$/i.test(cell)) {
          const upper = cell.toUpperCase();
          if (upper !== 'CODE' && upper !== 'PROMO' && upper !== 'PROMOCODE' && upper !== 'PROMOTION') {
            codes.add(cell);
          }
        }
      }
    }
    return Array.from(codes);
  };

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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Promo code copied!', 'success'))
      .catch(() => showToast('Failed to copy.', 'error'));
  };

  // ============================================================================
  // Views Renders
  // ============================================================================

  // 1. Loading screen
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

  // 2. Config Missing Alert Screen
  if (configMissing) {
    return (
      <div className="container">
        <div className="user-container" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <div className="card" style={{ borderColor: 'var(--warning)' }}>
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h1 style={{ marginBottom: '1rem' }}>Configuration Required</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                Vercel Postgres (<code>POSTGRES_URL</code>) or Google OAuth (<code>GOOGLE_CLIENT_ID</code>) is missing. 
                If you just clicked "1-Click Deploy", make sure the database is provisioned and your Google OAuth Credentials are saved in the project environment variables.
              </p>
              <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent)', overflowX: 'auto', marginBottom: '1.5rem' }}>
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
DEVELOPER_EMAILS=your-email@gmail.com
JWT_SECRET=your-custom-jwt-secret-key</pre>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Restart your application server once environment variables are set.
              </p>
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
        </div>
        <div className="user-nav">
          <span className="user-email">{user.email}</span>
          <a href="/api/auth/logout" className="btn btn-secondary">Sign Out</a>
        </div>
      </header>
    );
  };

  // 4. Toast Render Container
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

  return (
    <div className="container">
      {renderHeader()}
      {renderToasts()}

      {!user ? (
        /* Landing View */
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
          <footer>
            <div style={{ marginBottom: '0.5rem' }}>
              Built by the creator of <a href="#" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>Your Game Name</a>. Go wish-list it on the Play Store!
            </div>
            Closed-Test Code Distributor System • Powered by Next.js & Vercel Postgres
          </footer>
        </>
      ) : user.isDeveloper ? (
        /* Developer Dashboard View */
        <>
          <div className="dev-container">
            <div className="stats-grid">
              <div className="stat-card total">
                <span className="stat-label">Total Uploaded Codes</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-card claimed">
                <span className="stat-label">Claimed Codes</span>
                <span className="stat-value">{stats.claimed}</span>
              </div>
              <div className="stat-card remaining">
                <span className="stat-label">Remaining Codes</span>
                <span className="stat-value">{stats.remaining}</span>
              </div>
            </div>

            <div className="dev-panels">
              {/* Left Panel: Upload codes */}
              <div className="card">
                <div className="panel-header">
                  <h2>Import Promo Codes</h2>
                  {stats.total > 0 && (
                    <button onClick={handleClear} className="btn btn-danger btn-sm" disabled={actionLoading}>
                      Clear Data
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

              {/* Right Panel: Distribution Records */}
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
                          <td colSpan={3} className="table-empty">No promo codes have been claimed yet.</td>
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
          <footer>
            <div style={{ marginBottom: '0.5rem' }}>
              Built by the creator of <a href="#" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>Your Game Name</a>. Go wish-list it on the Play Store!
            </div>
            Closed-Test Code Distributor System • Developer Panel
          </footer>
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
                    <p>Your unique testing promo code has been allocated below.</p>
                  </div>
                  
                  <div className="claim-box">
                    <span className="claim-label">Google Play Promo Code</span>
                    <div className="promo-code-display">{claimedCode}</div>
                    <div className="claim-actions">
                      <button onClick={() => copyToClipboard(claimedCode)} className="btn btn-secondary">Copy Code</button>
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
                    All promo codes for this testing session have already been allocated. 
                    Please contact the developers or check back later.
                  </p>
                </div>
              )}
            </div>
          </div>
          <footer>
            <div style={{ marginBottom: '0.5rem' }}>
              Built by the creator of <a href="#" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>Your Game Name</a>. Go wish-list it on the Play Store!
            </div>
            Closed-Test Code Distributor System
          </footer>
        </>
      )}
    </div>
  );
}
