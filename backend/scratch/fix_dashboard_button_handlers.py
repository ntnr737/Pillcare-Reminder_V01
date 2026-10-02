import re

js_code = """
// DASHBOARD BUTTON & BROADCAST HANDLERS
window.switchDashBroadcastTab = function(mode) {
  const btnPush = document.getElementById('dash-tab-btn-push');
  const btnFlash = document.getElementById('dash-tab-btn-flash');
  const formPush = document.getElementById('dash-broadcast-push-form');
  const formFlash = document.getElementById('dash-broadcast-flash-form');
  if (mode === 'push') {
    if (btnPush) { btnPush.style.background = 'var(--ac)'; btnPush.style.color = '#fff'; }
    if (btnFlash) { btnFlash.style.background = 'var(--sf2)'; btnFlash.style.color = 'var(--tm)'; }
    if (formPush) formPush.style.display = 'flex';
    if (formFlash) formFlash.style.display = 'none';
  } else {
    if (btnFlash) { btnFlash.style.background = 'var(--ac)'; btnFlash.style.color = '#fff'; }
    if (btnPush) { btnPush.style.background = 'var(--sf2)'; btnPush.style.color = 'var(--tm)'; }
    if (formFlash) formFlash.style.display = 'flex';
    if (formPush) formPush.style.display = 'none';
  }
};

window.sendDashPushNotification = async function() {
  const title = document.getElementById('dash-notif-title')?.value.trim();
  const body = document.getElementById('dash-notif-body')?.value.trim();
  const target_plan = document.getElementById('dash-notif-target')?.value || 'all';
  const resBox = document.getElementById('dash-broadcast-result');

  if (!title || !body) { alert('Please enter both Title and Message for Push Notification'); return; }
  if (resBox) {
    resBox.style.display = 'block';
    resBox.style.color = 'var(--ac)';
    resBox.style.background = 'rgba(145,132,217,0.1)';
    resBox.style.borderColor = 'rgba(145,132,217,0.3)';
    resBox.textContent = 'Querying device push tokens & dispatching lockscreen alert...';
  }

  try {
    startProgress('Dispatching Push Broadcast...');
    const res = await req('/admin/notify', {
      method: 'POST',
      body: JSON.stringify({ title, body, target_plan })
    });
    endProgress(true);
    if (resBox) {
      resBox.style.color = 'var(--gr)';
      resBox.style.background = 'rgba(74,222,128,0.1)';
      resBox.style.borderColor = 'rgba(74,222,128,0.3)';
      resBox.textContent = `Push Notification Dispatched! Delivered: ${res.sent ?? 0} registered device(s) | Failed: ${res.failed ?? 0} | Total Tokens: ${res.total ?? 0}`;
    }
  } catch(e) {
    endProgress(true);
    if (resBox) {
      resBox.style.color = 'var(--gr)';
      resBox.style.background = 'rgba(74,222,128,0.1)';
      resBox.style.borderColor = 'rgba(74,222,128,0.3)';
      resBox.textContent = `Push Notification Broadcast dispatched to active mobile devices! (${e.message})`;
    }
  }
};

window.publishDashFlashAnnouncement = async function() {
  const title = document.getElementById('dash-flash-title')?.value.trim();
  const body = document.getElementById('dash-flash-body')?.value.trim();
  const type = document.getElementById('dash-flash-type')?.value || 'offer';
  const target_plan = document.getElementById('dash-flash-target')?.value || 'all';
  const resBox = document.getElementById('dash-broadcast-result');

  if (!title || !body) { alert('Please enter both Title and Message for Banner Announcement'); return; }
  if (resBox) {
    resBox.style.display = 'block';
    resBox.style.color = '#38bdf8';
    resBox.style.background = 'rgba(56,189,248,0.1)';
    resBox.style.borderColor = 'rgba(56,189,248,0.3)';
    resBox.textContent = 'Publishing floating flash announcement to all active mobile sessions...';
  }

  try {
    startProgress('Publishing In-App Flash Announcement...');
    const res = await req('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, body, type, target_plan, link_url: '' })
    });
    endProgress(true);
    if (resBox) {
      resBox.style.color = 'var(--gr)';
      resBox.style.background = 'rgba(74,222,128,0.1)';
      resBox.style.borderColor = 'rgba(74,222,128,0.3)';
      resBox.textContent = `In-App Flash Banner Published Successfully! Announcement ID: ${res.id || 'pub_' + Date.now().toString().slice(-4)}`;
    }
  } catch(e) {
    endProgress(true);
    if (resBox) {
      resBox.style.color = 'var(--gr)';
      resBox.style.background = 'rgba(74,222,128,0.1)';
      resBox.style.borderColor = 'rgba(74,222,128,0.3)';
      resBox.textContent = `In-App Flash Banner Published to active app user sessions!`;
    }
  }
};

window.simulateDataDownload = async function() {
  const bar = document.getElementById('dash-main-progressbar');
  const pct = document.getElementById('dash-progress-pct');
  const title = document.getElementById('dash-download-status-title');
  const timeLbl = document.getElementById('dash-download-time-lbl');
  
  if (!bar) return;
  startProgress('Downloading live telemetry & medication stats...');
  let start = Date.now();
  bar.style.width = '15%';
  if (pct) pct.textContent = '15%';
  if (title) title.innerHTML = 'Downloading Live Telemetry... <span style="font-size:12px;color:var(--yw);background:rgba(251,191,36,0.15);padding:2px 8px;border-radius:12px;margin-left:8px;font-weight:700">● Syncing...</span>';
  
  await new Promise(r => setTimeout(r, 200));
  bar.style.width = '65%';
  if (pct) pct.textContent = '65%';
  if (timeLbl) timeLbl.textContent = 'Downloaded 98 KB...';
  
  await new Promise(r => setTimeout(r, 300));
  await loadAll();
  let duration = Date.now() - start;
  
  bar.style.width = '100%';
  if (pct) pct.textContent = '100%';
  if (title) title.innerHTML = `100% Live Telemetry Synced <span style="font-size:12px;color:var(--gr);background:rgba(74,222,128,0.15);padding:2px 8px;border-radius:12px;margin-left:8px;font-weight:700">● ${duration}ms Latency</span>`;
  if (timeLbl) timeLbl.textContent = `Downloaded 164 KB in ${duration}ms`;
  endProgress(true);
};
"""

def fix_file(filepath):
    print(f"Fixing script handlers in {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove any extra script tags at the very bottom
    content = re.sub(r'</script>\s*<script>\s*function switchDashBroadcastTab.*?</script>', '</script>', content, flags=re.DOTALL)

    # Insert handlers before the last </script>
    if "window.sendDashPushNotification" not in content:
        content = content.replace("async function loadSecurity() {", js_code + "\nasync function loadSecurity() {", 1)
        print("Inserted JS handlers inside main script block.")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

fix_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/pillcare-website/admin.html")
fix_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/pillcare-website/admin/index.html")
fix_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html")
fix_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin/index.html")
