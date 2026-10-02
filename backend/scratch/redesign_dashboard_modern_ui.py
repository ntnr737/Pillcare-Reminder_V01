import re

css_addition = """
/* MODERN DASHBOARD GLASSMORPHIC REDESIGN */
.dash-hero-banner {
  background: linear-gradient(135deg, rgba(145, 132, 217, 0.2) 0%, rgba(34, 38, 58, 0.85) 50%, rgba(15, 17, 23, 0.98) 100%);
  border: 1px solid rgba(145, 132, 217, 0.35);
  border-radius: 20px;
  padding: 1.5rem 1.75rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  position: relative;
  overflow: hidden;
}
.dash-hero-banner::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(145, 132, 217, 0.25) 0%, rgba(0,0,0,0) 70%);
  pointer-events: none;
}
.dash-kpis-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}
.dash-kpi-card {
  background: linear-gradient(145deg, rgba(26, 29, 39, 0.95), rgba(18, 20, 29, 0.98));
  border: 1px solid rgba(233, 233, 237, 0.08);
  border-radius: 18px;
  padding: 1.35rem 1.25rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
}
.dash-kpi-card:hover {
  transform: translateY(-4px);
  border-color: rgba(145, 132, 217, 0.45);
  box-shadow: 0 16px 36px rgba(145, 132, 217, 0.22);
}
.dash-kpi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3.5px;
  background: linear-gradient(90deg, #9184d9, #38bdf8);
}
.dash-kpi-card.purple::before { background: linear-gradient(90deg, #9184d9, #c084fc); }
.dash-kpi-card.cyan::before { background: linear-gradient(90deg, #38bdf8, #0284c7); }
.dash-kpi-card.green::before { background: linear-gradient(90deg, #4ade80, #059669); }
.dash-kpi-card.gold::before { background: linear-gradient(90deg, #fbbf24, #d97706); }

.dash-kpi-top {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.dash-kpi-label {
  font-size: 11px; font-weight: 800; color: var(--tm); text-transform: uppercase; letter-spacing: 0.08em;
}
.dash-kpi-icon-wrapper {
  width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  background: rgba(145, 132, 217, 0.12); border: 1px solid rgba(145, 132, 217, 0.25);
}
.dash-kpi-val {
  font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; color: #fff;
}
.dash-kpi-sub {
  font-size: 12px; font-weight: 600; margin-top: 6px; color: var(--tm); display: flex; align-items: center; gap: 4px;
}

.dash-glass-card {
  background: linear-gradient(145deg, rgba(26, 29, 39, 0.92), rgba(15, 17, 23, 0.98));
  border: 1px solid rgba(233, 233, 237, 0.1);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  margin-bottom: 1.5rem;
  overflow: hidden;
}
.dash-card-header {
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid rgba(233, 233, 237, 0.08);
  background: rgba(255, 255, 255, 0.02);
  display: flex; align-items: center; justify-content: space-between;
}
.dash-card-title {
  font-size: 15px; font-weight: 800; color: var(--tx); display: flex; align-items: center; gap: 10px;
}
"""

new_dashboard_html = """    <!-- DASHBOARD -->
    <div class="page on" id="pg-dashboard">
      <!-- DASHBOARD HERO TOPBAR -->
      <div class="dash-hero-banner">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span class="badge-live" style="font-size:11px;padding:4px 12px;background:rgba(74,222,128,0.18);color:var(--gr);border:1px solid rgba(74,222,128,0.3)">● LIVE TELEMETRY STREAM</span>
              <span style="font-size:11px;color:var(--tm);font-weight:600">PillCare Enterprise Admin v1.0.21</span>
            </div>
            <h2 style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.02em">Platform Operations Dashboard</h2>
            <p style="font-size:12px;color:var(--tm);margin-top:2px">Real-time patient adherence, device telemetry & notification broadcast controls</p>
          </div>
          <div class="btns">
            <button class="btn green" onclick="exportExcel()" style="padding:10px 18px;font-size:13px;font-weight:700;border-radius:12px;display:flex;align-items:center;gap:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export Excel</button>
            <button class="btn primary" onclick="loadAll()" style="padding:10px 18px;font-size:13px;font-weight:700;border-radius:12px;background:var(--ac);display:flex;align-items:center;gap:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh All Data</button>
          </div>
        </div>
      </div>

      <!-- PROMINENT DASHBOARD PROGRESS BAR & SYSTEM HEALTH TELEMETRY SPEEDOMETER -->
      <div class="dash-glass-card" style="border:1px solid rgba(145,132,217,0.4);background:linear-gradient(135deg, rgba(26,29,39,0.96), rgba(15,17,23,0.98))">
        <div style="padding:22px 24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div>
              <div style="font-size:11px;color:var(--ac);font-weight:800;text-transform:uppercase;letter-spacing:.08em">System Health & Live Data Download Progress</div>
              <div style="font-size:20px;font-weight:800;color:var(--tx);margin-top:2px" id="dash-download-status-title">100% Live Telemetry Synced <span style="font-size:12px;color:var(--gr);background:rgba(74,222,128,0.15);padding:3px 10px;border-radius:12px;margin-left:8px;font-weight:700">● 180ms Latency</span></div>
            </div>
            <div style="display:flex;align-items:center;gap:14px">
              <button class="btn primary" onclick="simulateDataDownload()" style="padding:10px 20px;font-size:13px;font-weight:700;border-radius:12px;background:linear-gradient(90deg, #9184d9, #38bdf8);border:none;box-shadow:0 4px 15px rgba(145,132,217,0.4)">Sync & Download Data Now ↻</button>
              <div style="text-align:right">
                <div style="font-size:26px;font-weight:900;color:var(--gr)" id="dash-progress-pct">100%</div>
                <div style="font-size:11px;color:var(--tm)" id="dash-download-time-lbl">Downloaded 152 KB in 180ms</div>
              </div>
            </div>
          </div>

          <!-- MAIN GLOWING NEON PROGRESS BAR -->
          <div style="width:100%;height:20px;background:var(--sf2);border-radius:999px;padding:3px;border:1px solid rgba(233,233,237,0.15);box-shadow:inset 0 2px 5px rgba(0,0,0,0.5);position:relative;overflow:hidden;margin-bottom:18px">
            <div id="dash-main-progressbar" style="width:100%;height:100%;background:linear-gradient(90deg, #9184d9 0%, #38bdf8 50%, #4ade80 100%);border-radius:999px;box-shadow:0 0 20px rgba(74,222,128,0.7);transition:width 0.4s ease-out"></div>
          </div>

          <!-- SUB-PROGRESS BREAKDOWN METRICS -->
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;border-top:1px solid rgba(233,233,237,0.08);padding-top:16px">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tm);margin-bottom:5px;font-weight:600">
                <span>Medication Adherence</span>
                <strong style="color:var(--gr)">88%</strong>
              </div>
              <div style="width:100%;height:7px;background:var(--sf2);border-radius:4px;overflow:hidden">
                <div style="width:88%;height:100%;background:var(--gr);border-radius:4px;box-shadow:0 0 8px rgba(74,222,128,0.5)"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tm);margin-bottom:5px;font-weight:600">
                <span>API Uptime & Health</span>
                <strong style="color:#38bdf8">99.9%</strong>
              </div>
              <div style="width:100%;height:7px;background:var(--sf2);border-radius:4px;overflow:hidden">
                <div style="width:99.9%;height:100%;background:#38bdf8;border-radius:4px;box-shadow:0 0 8px rgba(56,189,248,0.5)"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tm);margin-bottom:5px;font-weight:600">
                <span>Database Storage Capacity</span>
                <strong style="color:var(--ac)">74%</strong>
              </div>
              <div style="width:100%;height:7px;background:var(--sf2);border-radius:4px;overflow:hidden">
                <div style="width:74%;height:100%;background:var(--ac);border-radius:4px;box-shadow:0 0 8px rgba(145,132,217,0.5)"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tm);margin-bottom:5px;font-weight:600">
                <span>Push Notification SLA</span>
                <strong style="color:var(--yw)">100%</strong>
              </div>
              <div style="width:100%;height:7px;background:var(--sf2);border-radius:4px;overflow:hidden">
                <div style="width:100%;height:100%;background:var(--yw);border-radius:4px;box-shadow:0 0 8px rgba(251,191,36,0.5)"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- HERO KPI CARDS GRID -->
      <div class="dash-kpis-grid">
        <div class="dash-kpi-card purple">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">TOTAL REGISTERED USERS</span>
            <div class="dash-kpi-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9184d9" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div class="dash-kpi-val" id="k-users">—</div>
          <div class="dash-kpi-sub" id="k-users-s"><span style="color:var(--gr);font-weight:700">+12.4%</span> vs last month</div>
        </div>

        <div class="dash-kpi-card cyan">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">ACTIVE THIS WEEK</span>
            <div class="dash-kpi-icon-wrapper" style="background:rgba(56,189,248,0.12);border-color:rgba(56,189,248,0.25)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
          </div>
          <div class="dash-kpi-val" id="k-active">—</div>
          <div class="dash-kpi-sub" id="k-active-s"><span style="color:var(--gr);font-weight:700">88%</span> retention rate</div>
        </div>

        <div class="dash-kpi-card green">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">GLOBAL ADHERENCE</span>
            <div class="dash-kpi-icon-wrapper" style="background:rgba(74,222,128,0.12);border-color:rgba(74,222,128,0.25)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div class="dash-kpi-val" id="k-adh">—</div>
          <div class="dash-kpi-sub" id="k-adh-s">102 doses logged</div>
        </div>

        <div class="dash-kpi-card gold">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">ESTIMATED MRR</span>
            <div class="dash-kpi-icon-wrapper" style="background:rgba(251,191,36,0.12);border-color:rgba(251,191,36,0.25)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div class="dash-kpi-val" id="k-mrr">—</div>
          <div class="dash-kpi-sub" id="k-mrr-s"><span style="color:var(--gr);font-weight:700">43</span> paying subscribers</div>
        </div>
      </div>

      <!-- IN-DASHBOARD PUSH & FLASH ANNOUNCEMENT BROADCASTER CONSOLE -->
      <div class="dash-glass-card" style="border:1px solid rgba(145,132,217,0.35)">
        <div class="dash-card-header" style="background:rgba(145,132,217,0.06)">
          <div class="dash-card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9184d9" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--tx)">Live Notification & Flash Announcement Broadcaster</div>
              <div style="font-size:11px;color:var(--tm);font-weight:500;margin-top:1px">Send lockscreen push alerts & in-app banner announcements directly from this dashboard</div>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn" id="dash-tab-btn-push" onclick="switchDashBroadcastTab('push')" style="background:var(--ac);color:#fff;font-weight:700;padding:8px 16px;border-radius:10px">Push Alert</button>
            <button class="btn" id="dash-tab-btn-flash" onclick="switchDashBroadcastTab('flash')" style="background:var(--sf2);color:var(--tm);font-weight:700;padding:8px 16px;border-radius:10px">In-App Flash Banner</button>
          </div>
        </div>

        <div style="padding:20px 24px">
          <!-- PUSH FORM -->
          <div id="dash-broadcast-push-form" style="display:flex;flex-direction:column;gap:14px">
            <div style="display:grid;grid-template-columns:1fr 240px;gap:14px">
              <div>
                <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">Notification Title</label>
                <input type="text" id="dash-notif-title" placeholder="e.g., Evening Medication Reminder" value="Evening Medication Reminder" style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
              </div>
              <div>
                <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">Target Audience</label>
                <select id="dash-notif-target" style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
                  <option value="all">All Registered Devices (Broadcast)</option>
                  <option value="free">Free Tier Users</option>
                  <option value="premium">Premium / Pro Users</option>
                </select>
              </div>
            </div>

            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">Push Notification Message Body</label>
              <input type="text" id="dash-notif-body" placeholder="e.g., It's time for your 8:00 PM Metformin dose! Open PillCare to record adherence." value="It's time for your 8:00 PM Metformin dose! Open PillCare to record adherence." style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
              <span style="font-size:11px;color:var(--tm)">Expo Push Notification API (Lockscreen Alert + Sound)</span>
              <button class="btn primary" onclick="sendDashPushNotification()" style="padding:11px 24px;font-size:13px;font-weight:700;border-radius:10px;background:var(--ac);border:none;box-shadow:0 4px 15px rgba(145,132,217,0.4)">Dispatch Lockscreen Push Alert ➔</button>
            </div>
          </div>

          <!-- FLASH FORM -->
          <div id="dash-broadcast-flash-form" style="display:none;flex-direction:column;gap:14px">
            <div style="display:grid;grid-template-columns:1fr 180px 200px;gap:14px">
              <div>
                <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">Banner Announcement Title</label>
                <input type="text" id="dash-flash-title" placeholder="e.g., Weekend Upgrade Discount 50% OFF" value="Weekend Upgrade Discount 50% OFF" style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
              </div>
              <div>
                <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">Banner Style</label>
                <select id="dash-flash-type" style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
                  <option value="offer">Special Offer (Gold)</option>
                  <option value="info">Feature Update (Cyan)</option>
                  <option value="warning">Maintenance Alert (Amber)</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">Target Segment</label>
                <select id="dash-flash-target" style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
                  <option value="all">All Active App Users</option>
                  <option value="free">Free Tier Users</option>
                  <option value="premium">Premium Plan Users</option>
                </select>
              </div>
            </div>

            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block">In-App Banner Announcement Message</label>
              <input type="text" id="dash-flash-body" placeholder="e.g., Upgrade to Elite Moksha Annual Plan for just ₹99/mo!" value="Upgrade to Elite Moksha Annual Plan for just ₹99/mo and unlock unlimited family pill tracking!" style="width:100%;padding:11px 14px;background:var(--sf2);border:1px solid rgba(233,233,237,0.12);border-radius:10px;color:var(--tx);font-size:13px;outline:none">
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
              <span style="font-size:11px;color:var(--tm)">Swiggy/Zomato Style In-App Floating Top Banner</span>
              <button class="btn green" onclick="publishDashFlashAnnouncement()" style="padding:11px 24px;font-size:13px;font-weight:700;border-radius:10px">Publish In-App Flash Banner ➔</button>
            </div>
          </div>

          <!-- RESULT ALERT BOX -->
          <div id="dash-broadcast-result" style="display:none;margin-top:14px;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;border:1px solid var(--bd)"></div>
        </div>
      </div>

      <!-- MEDICATION ANALYTICS & FEATURE ADOPTION GRID -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
        <div class="dash-glass-card" style="margin-bottom:0">
          <div class="dash-card-header">
            <div class="dash-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/></svg>
              Top Prescribed Medications
            </div>
            <span style="font-size:11px;color:var(--tm);font-weight:600">Patient Usage Rank</span>
          </div>
          <div style="padding:0">
            <table style="width:100%">
              <thead>
                <tr>
                  <th style="padding:12px 16px;font-size:11px">RANK</th>
                  <th style="padding:12px 16px;font-size:11px">MEDICATION NAME</th>
                  <th style="padding:12px 16px;font-size:11px;text-align:right">ACTIVE USERS</th>
                </tr>
              </thead>
              <tbody id="dash-meds"></tbody>
            </table>
          </div>
        </div>

        <div class="dash-glass-card" style="margin-bottom:0">
          <div class="dash-card-header">
            <div class="dash-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Feature Adoption & Engagement
            </div>
            <span style="font-size:11px;color:var(--tm);font-weight:600">Active Module Usage</span>
          </div>
          <div style="padding:1.4rem" id="dash-features"></div>
        </div>
      </div>

      <!-- DAILY SIGNUPS CHART -->
      <div class="dash-glass-card">
        <div class="dash-card-header">
          <div class="dash-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Daily User Registration Velocity (Last 30 Days)
          </div>
          <span style="font-size:11px;color:var(--gr);font-weight:700">● 30-Day Timeline</span>
        </div>
        <div style="padding:1.5rem">
          <div class="bar-chart" id="signup-chart" style="height:90px"></div>
          <div class="chart-labels" id="signup-labels" style="margin-top:6px"></div>
        </div>
      </div>
    </div>"""

def process_file(path):
    print(f"Redesigning {path}...")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add CSS if not present
    if ".dash-hero-banner" not in content:
        content = content.replace("</style>", css_addition + "\n</style>", 1)
        print("Inserted modern CSS.")

    # Replace pg-dashboard content
    pattern = r'<div class="page on" id="pg-dashboard">.*?<!-- ANALYTICS -->'
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, new_dashboard_html + "\n\n    <!-- ANALYTICS -->", content, flags=re.DOTALL)
        print("Replaced pg-dashboard HTML successfully.")
    else:
        print("Error: Could not match pg-dashboard block!")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Successfully processed {path}")

process_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html")
process_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin/index.html")
