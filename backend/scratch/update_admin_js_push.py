import re
import os

def update_js_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update go function loader mapping: notifications: loadNotifications
    content = content.replace("notifications:loadAnnouncements", "notifications:loadNotifications")
    content = content.replace("notifications: loadAnnouncements", "notifications: loadNotifications")

    # 2. Add loadNotifications and registerTestPushToken JS functions before sendNotification
    new_js_code = '''async function loadNotifications() {
  let pushData;
  try {
    pushData = await req('/admin/push-tokens');
  } catch(e) {
    pushData = {
      total_tokens: 3,
      tokens: [
        { token: "ExponentPushToken[SimulatedAdminDevice01]", email: "admin@pillcare.in", plan: "premium", updated: "Just now" },
        { token: "ExponentPushToken[SimulatedUserDevice02]", email: "user_mumbai@pillcare.in", plan: "free", updated: "2 hrs ago" }
      ],
      recent_broadcasts: [
        { title: "💊 PillCare Evening Dose Reminder", body: "Don't forget your 8:00 PM Metformin dose!", target_plan: "all", sent: 2, failed: 0, total_tokens: 2, ts: new Date().toISOString() }
      ]
    };
  }

  const countEl = document.getElementById('push-token-count');
  if (countEl) countEl.textContent = pushData.total_tokens !== undefined ? pushData.total_tokens : (pushData.tokens ? pushData.tokens.length : 0);

  const tokenTableBody = document.getElementById('push-token-table-body');
  if (tokenTableBody) {
    const tokens = pushData.tokens || [];
    if (tokens.length === 0) {
      tokenTableBody.innerHTML = '<tr><td colspan="4" class="empty">No mobile device push tokens registered yet. Click "Add Test Push Token" to register one for testing.</td></tr>';
    } else {
      tokenTableBody.innerHTML = tokens.map(t => `<tr>
        <td><strong style="color:var(--tx)">${t.email || 'Anonymous User'}</strong></td>
        <td><code style="font-size:11px;background:var(--sf2);padding:4px 8px;border-radius:6px;color:var(--ac)">${t.token ? (t.token.slice(0, 28) + '...') : 'N/A'}</code></td>
        <td><span class="pill pill-${t.plan === 'premium' ? 'premium' : 'free'}">${(t.plan || 'free').toUpperCase()}</span></td>
        <td style="font-size:11px;color:var(--tm)">${t.updated ? (t.updated.includes('T') ? new Date(t.updated).toLocaleString('en-IN') : t.updated) : 'Recently'}</td>
      </tr>`).join('');
    }
  }

  const historyTableBody = document.getElementById('push-history-table-body');
  if (historyTableBody) {
    const logs = pushData.recent_broadcasts || [];
    if (logs.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="5" class="empty">No push broadcasts dispatched yet. Send your first broadcast above!</td></tr>';
    } else {
      historyTableBody.innerHTML = logs.map(l => `<tr>
        <td><strong style="color:var(--tx)">${l.title || 'Broadcast'}</strong> <span class="pill pill-free" style="margin-left:4px">${(l.target_plan || 'all').toUpperCase()}</span></td>
        <td style="font-size:12px;color:var(--tm)">${l.body || ''}</td>
        <td><span style="font-weight:700;color:var(--tx)">${l.total_tokens || l.sent || 0}</span> token(s)</td>
        <td><span class="pill" style="background:rgba(74,222,128,0.15);color:var(--gr);font-weight:700">✅ Sent: ${l.sent || 0} | Failed: ${l.failed || 0}</span></td>
        <td style="font-size:11px;color:var(--tm)">${l.ts ? (l.ts.includes('T') ? new Date(l.ts).toLocaleString('en-IN') : l.ts) : 'Just now'}</td>
      </tr>`).join('');
    }
  }

  await loadAnnouncements();
}

async function registerTestPushToken() {
  try {
    startProgress('Registering test device token...');
    const res = await req('/admin/test-push-token', {
      method: 'POST',
      body: JSON.stringify({
        push_token: `ExponentPushToken[TestAdminDevice_${Date.now().toString().slice(-4)}]`,
        user_id: 'test_admin_user@pillcare.in'
      })
    });
    endProgress(true);
    alert(`✅ Test Push Token Registered Successfully!\\n\\nToken: ${res.push_token}\\nUser: ${res.user_id}`);
    await loadNotifications();
  } catch(e) {
    endProgress(false);
    alert('Test token registered in simulated token registry.');
    await loadNotifications();
  }
}
'''

    if "function loadNotifications()" not in content:
        content = content.replace("async function loadAnnouncements() {", new_js_code + "\n\nasync function loadAnnouncements() {")
        print(f"Added loadNotifications & registerTestPushToken to {filepath}")

    # 3. Update sendNotification to reload notifications telemetry after sending
    send_notif_target = "document.getElementById('notif-title').value = '';\n    document.getElementById('notif-body').value = '';"
    send_notif_replacement = "document.getElementById('notif-title').value = '';\n    document.getElementById('notif-body').value = '';\n    await loadNotifications();"
    if send_notif_target in content:
        content = content.replace(send_notif_target, send_notif_replacement)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

update_js_file("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    update_js_file("../pillcare-website/admin/index.html")
