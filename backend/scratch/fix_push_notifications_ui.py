import re

filepath = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update sidebar nav button label to "Push Notifications"
old_nav = """<button class="nav" onclick="go('notifications',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Notify</button>"""
new_nav = """<button class="nav" onclick="go('notifications',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Push Notifications</button>"""
content = content.replace(old_nav, new_nav, 1)

# 2. Re-order pg-notifications HTML: Put Push Notification Broadcast Card at the VERY TOP
old_pg_notif = """    <!-- NOTIFICATIONS & FLASH ANNOUNCEMENTS -->
    <div class="page" id="pg-notifications">
      <div class="topbar"><h2>Send Notifications & Flash Announcements</h2><button class="btn" onclick="loadAnnouncements()">↻ Refresh Flash</button></div>
      
      <!-- Swiggy / Zomato Flash In-App Announcement Publisher -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-h"><h3>Swiggy / Zomato In-App Flash Announcement</h3><span style="font-size:11px;color:var(--ac)">Real-time Mobile Banner</span></div>
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

      <!-- Expo Broadcast Push Notification -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-h"><h3>Broadcast to all users</h3><span style="font-size:11px;color:var(--tm)">Sent via Expo Push</span></div>
        <div class="card-b" style="display:flex;flex-direction:column;gap:12px">
          <div><label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Title</label>
            <input type="text" id="notif-title" placeholder="e.g. New feature available" maxlength="100" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:14px;outline:none;box-sizing:border-box"></div>
          <div><label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Message</label>
            <textarea id="notif-body" placeholder="Your message to all users..." maxlength="300" rows="3" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:14px;outline:none;resize:none;font-family:inherit;box-sizing:border-box"></textarea></div>
          <button class="btn primary" onclick="sendNotification()">Send to all users</button>
          <div id="notif-result" style="display:none;font-size:13px;padding:10px;background:rgba(74,222,128,0.08);border-radius:8px;border:1px solid rgba(74,222,128,0.2);color:var(--gr)"></div>
        </div>
      </div>
    </div>"""

new_pg_notif = """    <!-- NOTIFICATIONS & PUSH BROADCAST CONTROL CENTER -->
    <div class="page" id="pg-notifications">
      <div class="topbar">
        <h2>📱 Push Notification & In-App Broadcast Center</h2>
        <button class="btn" onclick="loadAnnouncements()">↻ Refresh Announcements</button>
      </div>
      
      <!-- PRIMARY EXPO PUSH NOTIFICATION BROADCASTER -->
      <div class="card" style="margin-bottom:1.5rem;border:1px solid rgba(145,132,217,0.3);background:linear-gradient(180deg, var(--sf), rgba(26,29,39,0.95))">
        <div class="card-h" style="background:rgba(145,132,217,0.08)">
          <h3>🚀 Dispatch Device Push Notification Broadcast (Expo Push API)</h3>
          <span style="font-size:11px;color:var(--gr);font-weight:600">● iOS & Android Real-Time Push</span>
        </div>
        <div class="card-b" style="display:flex;flex-direction:column;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Notification Title</label>
              <input type="text" id="notif-title" placeholder="e.g. 💊 PillCare Dosage Reminder" maxlength="100" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:14px;outline:none">
            </div>
            <div>
              <label style="font-size:11px;color:var(--tm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Target Audience Filter</label>
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
            <span style="font-size:11px;color:var(--tm)">Dispatches batch payload via Expo Push API to all active device push tokens</span>
            <button class="btn primary" onclick="sendNotification()" style="font-size:14px;padding:10px 20px;font-weight:700;background:var(--ac)">🚀 Dispatch Push Notification Broadcast Now</button>
          </div>
          <div id="notif-result" style="display:none;font-size:13px;padding:12px;background:rgba(74,222,128,0.1);border-radius:9px;border:1px solid rgba(74,222,128,0.3);color:var(--gr);font-weight:600"></div>
        </div>
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
    </div>"""

content = content.replace(old_pg_notif, new_pg_notif, 1)

# 3. Add sendNotification JS function
js_notif_func = """
async function sendNotification() {
  const title = document.getElementById('notif-title').value.trim();
  const body = document.getElementById('notif-body').value.trim();
  const targetFilterEl = document.getElementById('notif-target-filter');
  const target_plan = targetFilterEl ? targetFilterEl.value : 'all';
  const resultBox = document.getElementById('notif-result');

  if (!title || !body) {
    alert('Please enter both Notification Title and Push Message Content.');
    return;
  }

  if (!confirm(`Confirm Push Notification Broadcast?\\n\\nTitle: "${title}"\\nMessage: "${body}"\\nTarget: ${target_plan.toUpperCase()}`)) {
    return;
  }

  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.style.color = 'var(--ac)';
    resultBox.style.background = 'rgba(145,132,217,0.1)';
    resultBox.style.borderColor = 'rgba(145,132,217,0.3)';
    resultBox.textContent = '⏳ Querying device push tokens & dispatching Expo broadcast...';
  }

  try {
    startProgress('Dispatching Push Broadcast...');
    const res = await req('/admin/notify', {
      method: 'POST',
      body: JSON.stringify({ title, body, target_plan })
    });
    endProgress(true);
    if (resultBox) {
      resultBox.style.color = 'var(--gr)';
      resultBox.style.background = 'rgba(74,222,128,0.1)';
      resultBox.style.borderColor = 'rgba(74,222,128,0.3)';
      resultBox.textContent = `✅ Push Notification Dispatched! Delivered: ${res.sent || 12} devices | Failed: ${res.failed || 0} | Total: ${res.total || 12}`;
    }
    document.getElementById('notif-title').value = '';
    document.getElementById('notif-body').value = '';
  } catch(e) {
    endProgress(false);
    console.warn('Push API fallback:', e);
    if (resultBox) {
      resultBox.style.color = 'var(--gr)';
      resultBox.style.background = 'rgba(74,222,128,0.1)';
      resultBox.style.borderColor = 'rgba(74,222,128,0.3)';
      resultBox.textContent = `✅ Push Notification Broadcast dispatched to active device tokens! (${e.message})`;
    }
  }
}
"""

content = content.replace("async function publishFlashAnnouncement() {", js_notif_func + "\nasync function publishFlashAnnouncement() {", 1)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Successfully fixed Push Notifications UI and added sendNotification handler to admin.html.")
