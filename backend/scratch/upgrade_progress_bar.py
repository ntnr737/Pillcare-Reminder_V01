import re

filepath = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Progress Bar CSS for maximum visibility & neon glow
old_bar_css = """#topProgressBarContainer{position:fixed;top:0;left:0;right:0;height:4px;background:transparent;z-index:99999;pointer-events:none}
#topProgressBar{height:100%;width:0%;background:linear-gradient(90deg,#9184d9,#4ade80,#f472b6);box-shadow:0 0 10px rgba(145,132,217,0.8);transition:width 0.25s ease,opacity 0.4s ease;border-radius:0 2px 2px 0}"""

new_bar_css = """#topProgressBarContainer{position:fixed;top:0;left:0;right:0;height:6px;background:rgba(15,17,23,0.4);z-index:99999;pointer-events:none}
#topProgressBar{height:100%;width:0%;background:linear-gradient(90deg,#9184d9,#4ade80,#38bdf8,#f472b6);box-shadow:0 0 14px rgba(145,132,217,0.9);transition:width 0.3s cubic-bezier(0.4, 0, 0.2, 1),opacity 0.4s ease;border-radius:0 3px 3px 0}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }"""

content = content.replace(old_bar_css, new_bar_css, 1)

# 2. Add pageLoadingNotice banner to .main
old_main = '<div class="main">'
new_main = """<div class="main">

  <!-- PAGE-LEVEL LOADING BAR NOTICE -->
  <div id="pageLoadingNotice" style="display:none;align-items:center;gap:10px;padding:10px 16px;background:rgba(145,132,217,0.12);border:1px solid rgba(145,132,217,0.3);border-radius:10px;margin-bottom:1.25rem;font-size:13px;color:var(--ac);font-weight:600">
    <div style="width:16px;height:16px;border:2.5px solid var(--ac);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></div>
    <span id="pageLoadingNoticeText">Fetching telemetry & syncing live API data...</span>
  </div>"""

content = content.replace(old_main, new_main, 1)

# 3. Upgrade startProgress and endProgress to guarantee minimum 750ms visible duration
old_progress_js = """let activeRequests = 0;
function startProgress() {
  activeRequests++;
  const bar = document.getElementById('topProgressBar');
  if (bar) {
    bar.style.opacity = '1';
    bar.style.width = '30%';
    setTimeout(() => { if (activeRequests > 0) bar.style.width = '75%'; }, 300);
  }
}
function endProgress(success = true) {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) {
    const bar = document.getElementById('topProgressBar');
    if (bar) {
      bar.style.width = '100%';
      if (!success) bar.style.background = 'var(--rd)';
      setTimeout(() => {
        bar.style.opacity = '0';
        setTimeout(() => {
          bar.style.width = '0%';
          bar.style.background = 'linear-gradient(90deg, #9184d9, #4ade80, #f472b6)';
        }, 400);
      }, 300);
    }
  }
}"""

new_progress_js = """let activeRequests = 0;
let progressStartTime = 0;

function startProgress(msg) {
  activeRequests++;
  progressStartTime = Date.now();
  const bar = document.getElementById('topProgressBar');
  const notice = document.getElementById('pageLoadingNotice');
  const txt = document.getElementById('pageLoadingNoticeText');
  if (notice) notice.style.display = 'flex';
  if (txt && msg) txt.textContent = msg;
  if (bar) {
    bar.style.opacity = '1';
    bar.style.width = '40%';
    bar.style.background = 'linear-gradient(90deg, #9184d9, #4ade80, #38bdf8)';
    setTimeout(() => { if (activeRequests > 0) bar.style.width = '80%'; }, 250);
  }
}

function endProgress(success = true) {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) {
    const elapsed = Date.now() - progressStartTime;
    const remainingTime = Math.max(0, 750 - elapsed); // Enforce minimum 750ms visible loading duration
    
    setTimeout(() => {
      const bar = document.getElementById('topProgressBar');
      const notice = document.getElementById('pageLoadingNotice');
      if (notice) notice.style.display = 'none';
      if (bar) {
        bar.style.width = '100%';
        if (!success) bar.style.background = 'var(--rd)';
        setTimeout(() => {
          bar.style.opacity = '0';
          setTimeout(() => {
            bar.style.width = '0%';
            bar.style.background = 'linear-gradient(90deg, #9184d9, #4ade80, #38bdf8)';
          }, 400);
        }, 350);
      }
    }, remainingTime);
  }
}"""

content = content.replace(old_progress_js, new_progress_js, 1)

# 4. Trigger startProgress when switching tabs in go()
old_go = """function go(id, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('on'));
  document.getElementById('pg-'+id).classList.add('on');
  el.classList.add('on');
  const loaders = {analytics:loadAnalytics,users:loadUsers,subscriptions:()=>loadSubs(''),location:loadLocation,devices:loadDevices,revenue:loadRevenue,'adv-analytics':loadAdvancedAnalytics,'health-intel':loadHealthcareIntel,'user-insights':loadUserInsights,notifications:loadAnnouncements,security:loadSecurity};
  if (loaders[id]) loaders[id]();
}"""

new_go = """function go(id, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('on'));
  const pg = document.getElementById('pg-'+id);
  if (pg) pg.classList.add('on');
  if (el) el.classList.add('on');
  startProgress('Loading ' + id + ' telemetry & metrics...');
  const loaders = {analytics:loadAnalytics,users:loadUsers,subscriptions:()=>loadSubs(''),location:loadLocation,devices:loadDevices,revenue:loadRevenue,'adv-analytics':loadAdvancedAnalytics,'health-intel':loadHealthcareIntel,'user-insights':loadUserInsights,notifications:loadAnnouncements,security:loadSecurity};
  if (loaders[id]) loaders[id]();
  else endProgress(true);
}"""

content = content.replace(old_go, new_go, 1)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Successfully upgraded progress loading bar with guaranteed 750ms duration & tab-level spinner notice.")
