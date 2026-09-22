import re
import os

def fix_go_function(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    old_go = '''function go(id, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('on'));
  const pg = document.getElementById('pg-'+id);
  if (pg) pg.classList.add('on');
  if (el) el.classList.add('on');
  startProgress('Loading ' + id + ' telemetry & metrics...');
  const loaders = {analytics:loadAnalytics,users:loadUsers,subscriptions:()=>loadSubs(''),location:loadLocation,devices:loadDevices,revenue:loadRevenue,'adv-analytics':loadAdvancedAnalytics,'health-intel':loadHealthcareIntel,'user-insights':loadUserInsights,notifications:loadNotifications,security:loadSecurity};
  if (loaders[id]) loaders[id]();
  else endProgress(true);
}'''

    new_go = '''function go(id, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('on'));
  const pg = document.getElementById('pg-'+id);
  if (pg) pg.classList.add('on');
  
  if (el) {
    el.classList.add('on');
  } else {
    const navBtn = Array.from(document.querySelectorAll('.nav')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(`go('${id}'`));
    if (navBtn) navBtn.classList.add('on');
  }

  startProgress('Loading ' + id + ' telemetry & metrics...');
  const loaders = {
    dashboard: loadAll,
    analytics: loadAnalytics,
    users: loadUsers,
    subscriptions: () => loadSubs(''),
    location: loadLocation,
    devices: loadDevices,
    revenue: loadRevenue,
    'adv-analytics': loadAdvancedAnalytics,
    'health-intel': loadHealthcareIntel,
    'user-insights': loadUserInsights,
    notifications: loadNotifications,
    security: loadSecurity
  };

  if (loaders[id]) {
    Promise.resolve(loaders[id]()).finally(() => {
      endProgress(true);
    });
  } else {
    endProgress(true);
  }
}'''

    if old_go in content:
        content = content.replace(old_go, new_go)
        print(f"Successfully fixed go() in {filepath}")
    else:
        print(f"Old go() pattern not matched in {filepath}, using regex fallback...")
        pattern = r'function go\(id, el\)\s*\{.*?\n\}'
        if re.search(pattern, content, flags=re.DOTALL):
            content = re.sub(pattern, new_go, content, flags=re.DOTALL)
            print(f"Regex successfully fixed go() in {filepath}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

fix_go_function("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    fix_go_function("../pillcare-website/admin/index.html")
