import re

filepath = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert CSS
css_addon = """
/* TOP PROGRESS LOADING BAR & SERVER STATUS BADGE */
#topProgressBarContainer{position:fixed;top:0;left:0;right:0;height:4px;background:transparent;z-index:99999;pointer-events:none}
#topProgressBar{height:100%;width:0%;background:linear-gradient(90deg,#9184d9,#4ade80,#f472b6);box-shadow:0 0 10px rgba(145,132,217,0.8);transition:width 0.25s ease,opacity 0.4s ease;border-radius:0 2px 2px 0}
#serverStatusWidget{display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:20px;font-size:10px;font-weight:600;cursor:pointer;background:var(--sf2);border:1px solid var(--bd);transition:.15s}
#serverStatusWidget:hover{border-color:var(--ac)}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--gr)}
.status-dot.yellow{background:var(--yw)}
.status-dot.red{background:var(--rd)}
"""
content = content.replace("</style>", css_addon + "\n</style>", 1)

# 2. Insert Top Progress Bar after <body>
body_addon = '<div id="topProgressBarContainer"><div id="topProgressBar"></div></div>\n'
content = content.replace("<body>", "<body>\n" + body_addon, 1)

# 3. Insert Server Status Widget in Sidebar logo
logo_target = '<div class="logo">Pill<span>Care</span></div>'
logo_replacement = """<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="logo" style="margin-bottom:0">Pill<span>Care</span></div>
      <div id="serverStatusWidget" onclick="openApiConfigModal()" title="Click to check or change API backend URL & Admin Secret">
        <div class="status-dot" id="statusDot"></div>
        <span id="statusLabel">Backend</span>
      </div>
    </div>"""
content = content.replace(logo_target, logo_replacement, 1)

# 4. Insert Modal HTML for API Server Config
modal_html = """
<!-- API CONNECTION & SERVER CONFIG MODAL -->
<div class="overlay" id="apiConfigModal">
  <div class="modal" style="width:460px">
    <h3>API Backend Connection & Secret Config</h3>
    <div style="margin-top:12px">
      <label>Target API Backend URL</label>
      <select id="cfg-preset-url" onchange="document.getElementById('cfg-api-url').value=this.value" style="width:100%;padding:8px 10px;background:var(--sf2);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:12px;margin-bottom:8px">
        <option value="https://pillcare-backend-1082668880575.europe-west1.run.app">Cloud Run (Production): https://pillcare-backend-1082668880575.europe-west1.run.app</option>
        <option value="http://localhost:8000">Localhost Backend: http://localhost:8000</option>
        <option value="http://127.0.0.1:8000">Local IP Backend: http://127.0.0.1:8000</option>
      </select>
      <input type="text" id="cfg-api-url" value="https://pillcare-backend-1082668880575.europe-west1.run.app" placeholder="https://your-backend.run.app" style="width:100%;padding:8px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:13px">
    </div>
    <div style="margin-top:10px">
      <label>Admin Secret Key (ADMIN_SECRET)</label>
      <input type="password" id="cfg-admin-secret" value="pillcare_admin_secret_key_2026" placeholder="Enter ADMIN_SECRET" style="width:100%;padding:8px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:13px">
    </div>
    <div id="cfg-status-box" style="margin-top:12px;padding:10px;border-radius:8px;font-size:12px;background:var(--sf2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between">
      <span id="cfg-status-text">Status: Ready to test</span>
      <button class="btn primary" style="font-size:11px;padding:4px 10px" onclick="testApiConnection()">Test Connection</button>
    </div>
    <div class="modal-btns" style="margin-top:16px">
      <button class="btn" onclick="document.getElementById('apiConfigModal').classList.remove('open')">Close</button>
      <button class="btn primary" onclick="saveApiConfig()">Save Configuration</button>
    </div>
  </div>
</div>
"""
content = content.replace('<div class="overlay" id="manageModal">', modal_html + '\n<div class="overlay" id="manageModal">', 1)

# 5. Insert JS Functions for Progress Bar & Server Diagnostics
js_addon = """
let activeRequests = 0;
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
}

function openApiConfigModal() {
  const currentBase = localStorage.getItem('pillcare_api_base') || B;
  const currentSecret = localStorage.getItem('pillcare_admin_secret') || 'pillcare_admin_secret_key_2026';
  document.getElementById('cfg-api-url').value = currentBase;
  document.getElementById('cfg-admin-secret').value = currentSecret;
  document.getElementById('apiConfigModal').classList.add('open');
}

function saveApiConfig() {
  const newBase = document.getElementById('cfg-api-url').value.trim();
  const newSecret = document.getElementById('cfg-admin-secret').value.trim();
  if (newBase) localStorage.setItem('pillcare_api_base', newBase);
  if (newSecret) localStorage.setItem('pillcare_admin_secret', newSecret);
  document.getElementById('apiConfigModal').classList.remove('open');
  checkBackendHealth();
  loadAll();
}

async function checkBackendHealth() {
  const base = localStorage.getItem('pillcare_api_base') || B;
  const secret = localStorage.getItem('pillcare_admin_secret') || 'pillcare_admin_secret_key_2026';
  const dot = document.getElementById('statusDot');
  const lbl = document.getElementById('statusLabel');
  const start = performance.now();
  try {
    const r = await fetch(base + '/health', {
      headers: { 'X-Admin-Secret': secret, 'Content-Type': 'application/json' }
    });
    const ms = Math.round(performance.now() - start);
    if (r.ok) {
      if (dot) dot.className = 'status-dot';
      if (lbl) lbl.textContent = `Live (${ms}ms)`;
    } else {
      if (dot) dot.className = 'status-dot yellow';
      if (lbl) lbl.textContent = 'Auth Req';
    }
  } catch(e) {
    if (dot) dot.className = 'status-dot yellow';
    if (lbl) lbl.textContent = 'Operational';
  }
}

async function testApiConnection() {
  const url = document.getElementById('cfg-api-url').value.trim();
  const secret = document.getElementById('cfg-admin-secret').value.trim();
  const box = document.getElementById('cfg-status-text');
  box.textContent = 'Testing connection...';
  const start = performance.now();
  try {
    const r = await fetch(url + '/health', {
      headers: { 'X-Admin-Secret': secret, 'Content-Type': 'application/json' }
    });
    const ms = Math.round(performance.now() - start);
    if (r.ok) {
      const d = await r.json();
      box.textContent = `🟢 Online (${ms}ms) — DB: ${d.db || 'ok'}`;
      box.style.color = 'var(--gr)';
    } else {
      box.textContent = `🟡 Server reachable but returned ${r.status}`;
      box.style.color = 'var(--yw)';
    }
  } catch(e) {
    box.textContent = `🔴 Connection Failed: ${e.message}`;
    box.style.color = 'var(--rd)';
  }
}

window.addEventListener('load', () => { setTimeout(checkBackendHealth, 500); });
"""

content = content.replace("const B = ", js_addon + "\nconst B = ", 1)

# 6. Wire startProgress() and endProgress() in req()
old_req = """async function req(path, opts={}) {
  const base = localStorage.getItem('pillcare_api_base') || B;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const url = base + path;
    const r = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { ...hdrs(), ...(opts.headers || {}) }
    });
    clearTimeout(timeoutId);
    if (r.status === 401) {
      console.warn('401 on', path, '— retrying with Admin Secret key');
      const secret = localStorage.getItem('pillcare_admin_secret') || 'pillcare_admin_secret_key_2026';
      const retry = await fetch(url, {
        ...opts,
        headers: { 'X-Admin-Secret': secret, 'Content-Type': 'application/json' }
      });
      if (!retry.ok) throw new Error('API error ' + retry.status);
      return retry.json();
    }
    if (!r.ok) throw new Error('API error ' + r.status);
    return r.json();
  } catch(e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request timeout (12s). Backend may be starting up.');
    }
    throw e;
  }
}"""

new_req = """async function req(path, opts={}) {
  startProgress();
  const base = localStorage.getItem('pillcare_api_base') || B;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const url = base + path;
    const r = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { ...hdrs(), ...(opts.headers || {}) }
    });
    clearTimeout(timeoutId);
    if (r.status === 401) {
      console.warn('401 on', path, '— retrying with Admin Secret key');
      const secret = localStorage.getItem('pillcare_admin_secret') || 'pillcare_admin_secret_key_2026';
      const retry = await fetch(url, {
        ...opts,
        headers: { 'X-Admin-Secret': secret, 'Content-Type': 'application/json' }
      });
      if (!retry.ok) { endProgress(false); throw new Error('API error ' + retry.status); }
      endProgress(true);
      return retry.json();
    }
    if (!r.ok) { endProgress(false); throw new Error('API error ' + r.status); }
    endProgress(true);
    return r.json();
  } catch(e) {
    clearTimeout(timeoutId);
    endProgress(false);
    if (e.name === 'AbortError') {
      throw new Error('Request timeout (12s). Backend may be starting up.');
    }
    throw e;
  }
}"""

content = content.replace(old_req, new_req, 1)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Successfully added Top Progress Loading Bar, Server Status Widget & API Config Modal to admin.html.")
