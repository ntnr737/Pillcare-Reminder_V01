import re
import os

def update_admin_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update Navigation Sidebar: move Push Notifications up right below Dashboard, rename duplicate Users tab to User Insights
    old_nav = '''    <button class="nav on" onclick="go('dashboard',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Dashboard</button>
    <button class="nav" onclick="go('analytics',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/><polyline points="12 12 20 7.5"/><polyline points="12 12 12 21"/><polyline points="12 12 4 7.5"/></svg> Analytics</button>
    <button class="nav" onclick="go('users',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Users</button>
    <button class="nav" onclick="go('subscriptions',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><path d="M1 10h22"/></svg> Subscriptions</button>
    <button class="nav" onclick="go('location',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Location</button>
    <button class="nav" onclick="go('devices',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M2 17h20"/></svg> Devices</button>
    <button class="nav" onclick="go('revenue',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Revenue</button>
    <button class="nav" onclick="go('adv-analytics',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M9 17V9M15 17V5M21 17v-1"/></svg> Analytics+</button>
    <button class="nav" onclick="go('health-intel',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Health Intel</button>
    <button class="nav" onclick="go('user-insights',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg> Users</button>
    <button class="nav" onclick="go('notifications',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Push Notifications</button>
    <button class="nav" onclick="go('security',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Security</button>'''

    new_nav = '''    <button class="nav on" onclick="go('dashboard',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Dashboard</button>
    <button class="nav" onclick="go('notifications',this)" style="background:rgba(145,132,217,0.15);border:1px solid rgba(145,132,217,0.4);color:var(--ac);font-weight:700"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9184d9" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> 📢 Push Notifications <span style="font-size:9px;background:var(--ac);color:#fff;padding:2px 6px;border-radius:10px;margin-left:auto">LIVE</span></button>
    <button class="nav" onclick="go('analytics',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/><polyline points="12 12 20 7.5"/><polyline points="12 12 12 21"/><polyline points="12 12 4 7.5"/></svg> Analytics</button>
    <button class="nav" onclick="go('users',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 1-4-4H5a4 4 0 0 1-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> User Directory</button>
    <button class="nav" onclick="go('subscriptions',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><path d="M1 10h22"/></svg> Subscriptions</button>
    <button class="nav" onclick="go('location',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Location</button>
    <button class="nav" onclick="go('devices',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M2 17h20"/></svg> Devices</button>
    <button class="nav" onclick="go('revenue',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Revenue</button>
    <button class="nav" onclick="go('adv-analytics',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M9 17V9M15 17V5M21 17v-1"/></svg> Analytics+</button>
    <button class="nav" onclick="go('health-intel',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Health Intel</button>
    <button class="nav" onclick="go('user-insights',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg> User Insights</button>
    <button class="nav" onclick="go('security',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Security</button>'''

    if old_nav in content:
        content = content.replace(old_nav, new_nav)
        print(f"Updated navbar in {filepath}")
    else:
        print(f"Old nav pattern not exact in {filepath}, trying regex...")

    # 2. Add Quick Push Broadcast Widget to Dashboard Page
    dash_target = '<div class="kpis">'
    quick_push_widget = '''<!-- QUICK PUSH BROADCAST BAR -->
      <div class="card" style="margin-bottom:1.25rem;border:1px solid rgba(145,132,217,0.3);background:linear-gradient(90deg, rgba(145,132,217,0.12), rgba(26,29,39,0.95))">
        <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">📢</span>
            <div>
              <h4 style="font-size:14px;font-weight:700;color:var(--tx)">Instant Push Notification Broadcast</h4>
              <p style="font-size:11px;color:var(--tm);margin-top:2px">Dispatch real-time lockscreen alert to mobile devices & in-app feed</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn primary" onclick="go('notifications')" style="padding:8px 16px;font-size:13px;font-weight:700;background:var(--ac)">🚀 Open Push Control Center</button>
          </div>
        </div>
      </div>
'''
    if quick_push_widget not in content and dash_target in content:
        content = content.replace(dash_target, quick_push_widget + "\n      " + dash_target, 1)
        print(f"Added Quick Push Widget to Dashboard in {filepath}")

    # 3. Upgrade Notifications Page `#pg-notifications`
    pg_notif_old_start = '<div class="page" id="pg-notifications">'
    pg_notif_new_html = '''    <div class="page" id="pg-notifications">
      <div class="topbar">
        <h2>📱 Push Notification & Live Broadcast Control Center</h2>
        <div style="display:flex;gap:8px">
          <button class="btn green" onclick="registerTestPushToken()">🧪 Add Test Push Token</button>
          <button class="btn" onclick="loadNotifications()">↻ Refresh Telemetry</button>
        </div>
      </div>

      <!-- DEVICE PUSH TELEMETRY STATUS BAR -->
      <div class="card" style="margin-bottom:1.25rem;border:1px solid rgba(74,222,128,0.3);background:linear-gradient(90deg, rgba(74,222,128,0.08), rgba(26,29,39,0.95))">
        <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:10px;height:10px;border-radius:50%;background:var(--gr);box-shadow:0 0 10px var(--gr)"></div>
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--tx)">Push Token Registry: <span id="push-token-count" style="color:var(--gr)">Fetching...</span> Active Device(s)</div>
              <div style="font-size:11px;color:var(--tm);margin-top:2px">Expo Push API: <span style="color:var(--gr);font-weight:700">ONLINE ●</span> | Delivery Mode: <span style="color:var(--ac);font-weight:700">Real-Time Lockscreen + In-App Feed</span></div>
            </div>
          </div>
          <button class="btn" onclick="registerTestPushToken()" style="font-size:12px;padding:6px 14px">🧪 Register Test Device Token (Instant Test)</button>
        </div>
      </div>
      
      <!-- PRIMARY EXPO PUSH NOTIFICATION BROADCASTER -->
      <div class="card" style="margin-bottom:1.5rem;border:1px solid rgba(145,132,217,0.3);background:linear-gradient(180deg, var(--sf), rgba(26,29,39,0.95))">
        <div class="card-h" style="background:rgba(145,132,217,0.08)">
          <h3>🚀 Dispatch Device Push Notification Broadcast (Expo Push API)</h3>
          <span style="font-size:11px;color:var(--gr);font-weight:600">● iOS & Android Lockscreen Alerts</span>
        </div>
        <div class="card-b" style="display:flex;flex-direction:column;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Notification Title</label>
              <input type="text" id="notif-title" placeholder="e.g. 💊 PillCare Dosage Reminder" maxlength="100" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:14px;outline:none">
            </div>
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Target Audience Cohort</label>
              <select id="notif-target-filter" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:14px;outline:none">
                <option value="all">🌐 All Mobile App Devices</option>
                <option value="premium">⭐ Premium Subscribers Only</option>
                <option value="free">🆓 Free Plan Users Only</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Push Message Content</label>
            <textarea id="notif-body" placeholder="e.g. It's time to record your 8:00 PM Metformin dose! Open PillCare to mark as taken." maxlength="300" rows="3" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:14px;outline:none;resize:none;font-family:inherit"></textarea>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:11px;color:var(--tm)">Dispatches batch payload via Expo Push API to all active device push tokens & syncs in-app feed</span>
            <button class="btn primary" onclick="sendNotification()" style="font-size:14px;padding:12px 24px;font-weight:800;background:var(--ac);box-shadow:0 0 15px rgba(145,132,217,0.4)">🚀 Dispatch Push Notification Broadcast Now</button>
          </div>
          <div id="notif-result" style="display:none;font-size:13px;padding:14px;background:rgba(74,222,128,0.1);border-radius:9px;border:1px solid rgba(74,222,128,0.3);color:var(--gr);font-weight:600"></div>
        </div>
      </div>

      <!-- RECENT PUSH BROADCAST DISPATCH LOGS -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-h"><h3>📜 Push Broadcast Dispatch History</h3></div>
        <table>
          <thead><tr><th>Title & Target</th><th>Message Content</th><th>Tokens Targeted</th><th>Delivery Status</th><th>Timestamp</th></tr></thead>
          <tbody id="push-history-table-body"><tr><td colspan="5" class="empty">Loading push logs...</td></tr></tbody>
        </table>
      </div>

      <!-- REGISTERED DEVICE PUSH TOKENS TABLE -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-h"><h3>📲 Registered Mobile Device Push Tokens</h3></div>
        <table>
          <thead><tr><th>User / Email</th><th>Device Push Token</th><th>Subscription Plan</th><th>Last Token Update</th></tr></thead>
          <tbody id="push-token-table-body"><tr><td colspan="4" class="empty">Loading registered tokens...</td></tr></tbody>
        </table>
      </div>

      <!-- Swiggy / Zomato Flash In-App Announcement Publisher -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-h"><h3>⚡ Swiggy / Zomato In-App Flash Announcement Banners</h3><span style="font-size:11px;color:var(--ac)">Real-time Mobile Banner</span></div>
        <div class="card-b" style="display:flex;flex-direction:column;gap:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Title</label>
              <input type="text" id="flash-title" placeholder="e.g. ⚡ Flash Offer" style="width:100%;padding:9px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:13px;outline:none">
            </div>
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Badge Style</label>
              <select id="flash-type" style="width:100%;padding:9px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:13px;outline:none">
                <option value="offer">🎁 Special Offer</option>
                <option value="info">📢 Information / Feature Release</option>
                <option value="warning">⚠️ Warning / Maintenance</option>
                <option value="alert">🚨 Critical System Alert</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Target Tier</label>
              <select id="flash-target" style="width:100%;padding:9px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:13px;outline:none">
                <option value="all">🌐 All Users</option>
                <option value="free">Free Users Only</option>
                <option value="basic">Pro Dharma (Basic) Only</option>
                <option value="premium">Elite Moksha (Premium) Only</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Message Content</label>
              <input type="text" id="flash-body" placeholder="e.g. Upgrade to Elite Moksha for ₹99 and unlock unlimited AI Medicine Scanner!" style="width:100%;padding:9px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:13px;outline:none">
            </div>
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Action URL (Optional)</label>
              <input type="text" id="flash-link" placeholder="https://pillcare.in/upgrade" style="width:100%;padding:9px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:13px;outline:none">
            </div>
          </div>
          <button class="btn primary" onclick="publishFlashAnnouncement()">📣 Publish In-App Flash Announcement</button>
        </div>
      </div>

      <!-- Active Announcements Table -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-h"><h3>Active Live Announcements</h3></div>
        <table>
          <thead><tr><th>Type & Title</th><th>Content</th><th>Target</th><th>Published Date</th><th>Action</th></tr></thead>
          <tbody id="flash-table-body"><tr><td colspan="5" class="empty">Loading announcements...</td></tr></tbody>
        </table>
      </div>
    </div>'''

    pattern_notif = r'<div class="page" id="pg-notifications">.*?<!-- Active Announcements Table -->\s*<div class="card" style="margin-bottom:1rem">\s*<div class="card-h"><h3>Active Live Announcements</h3></div>\s*<table>\s*<thead><tr><th>Type & Title</th><th>Content</th><th>Target</th><th>Published Date</th><th>Action</th></tr></thead>\s*<tbody id="flash-table-body"><tr><td colspan="5" class="empty">Loading announcements\.\.\.</td></tr></tbody>\s*</table>\s*</div>\s*</div>'
    if re.search(pattern_notif, content, flags=re.DOTALL):
        content = re.sub(pattern_notif, pg_notif_new_html, content, flags=re.DOTALL)
        print(f"Updated pg-notifications section in {filepath}")
    else:
        print(f"pg-notifications regex match failed in {filepath}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

update_admin_file("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    update_admin_file("../pillcare-website/admin/index.html")
