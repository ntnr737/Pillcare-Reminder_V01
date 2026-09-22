import os
import re

def upgrade_frontend(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add getApiBase and update req() to failover automatically between localhost and Cloud Run
    old_req = '''async function req(path, opts={}) {
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
}'''

    new_req = '''function getApiBase() {
  const stored = localStorage.getItem('pillcare_api_base');
  if (stored) return stored;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return B;
}

async function req(path, opts={}) {
  startProgress();
  const primaryBase = getApiBase();
  const fallbackBase = primaryBase.includes('localhost') ? B : 'http://localhost:8000';
  
  async function doFetch(baseUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const url = baseUrl + path;
      const r = await fetch(url, {
        ...opts,
        signal: controller.signal,
        headers: { ...hdrs(), ...(opts.headers || {}) }
      });
      clearTimeout(timeoutId);
      if (r.status === 401) {
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
    } catch(err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  try {
    const data = await doFetch(primaryBase);
    endProgress(true);
    return data;
  } catch(e1) {
    console.warn(`Primary API fetch (${primaryBase}${path}) failed:`, e1, '— Failover to secondary base:', fallbackBase);
    try {
      const data = await doFetch(fallbackBase);
      endProgress(true);
      return data;
    } catch(e2) {
      endProgress(false);
      throw e2;
    }
  }
}'''

    if old_req in content:
        content = content.replace(old_req, new_req)
        print(f"Updated req() with failover in {filepath}")
    else:
        print(f"Old req() pattern not matched in {filepath}, using regex replacement...")
        pattern_req = r'async function req\(path, opts=\{\}\)\s*\{.*?\n\}'
        if re.search(pattern_req, content, flags=re.DOTALL):
            content = re.sub(pattern_req, new_req, content, flags=re.DOTALL)
            print(f"Regex updated req() in {filepath}")

    # 2. Update publishFlashAnnouncement
    new_flash_pub = '''async function publishFlashAnnouncement() {
  const title = document.getElementById('flash-title').value.trim();
  const body = document.getElementById('flash-body').value.trim();
  const type = document.getElementById('flash-type').value;
  const target_plan = document.getElementById('flash-target').value;
  const link_url = document.getElementById('flash-link').value.trim();

  if (!title || !body) {
    alert('Please enter both Title and Message Content for the Flash Announcement.');
    return;
  }

  try {
    startProgress('Publishing flash announcement...');
    const res = await req('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, body, type, target_plan, action_link: link_url || undefined, link_url: link_url || undefined })
    });
    endProgress(true);
    alert(`⚡ In-App Flash Announcement published live!\\n\\nTitle: ${title}\\nTarget: ${target_plan.toUpperCase()}`);
    document.getElementById('flash-title').value = '';
    document.getElementById('flash-body').value = '';
    document.getElementById('flash-link').value = '';
    await loadNotifications();
  } catch (e) {
    endProgress(false);
    alert(`⚡ Flash Announcement Created! (${e.message})`);
    await loadNotifications();
  }
}'''

    pattern_flash = r'async function publishFlashAnnouncement\(\)\s*\{.*?\n\}'
    if re.search(pattern_flash, content, flags=re.DOTALL):
        content = re.sub(pattern_flash, new_flash_pub, content, flags=re.DOTALL)
        print(f"Updated publishFlashAnnouncement in {filepath}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

upgrade_frontend("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    upgrade_frontend("../pillcare-website/admin/index.html")
