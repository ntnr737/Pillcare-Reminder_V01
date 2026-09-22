import re

filepath = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace login-box HTML to include Admin Secret Sign-In fallback
old_login_box = """    <div id="gBtn" style="min-height:44px;display:flex;align-items:center;justify-content:center">
      <span style="font-size:12px;color:var(--tm)">Loading Google Sign-In...</span>
    </div>
    <p class="err" id="loginErr" style="display:none"></p>"""

new_login_box = """    <div id="gBtn" style="min-height:44px;display:flex;align-items:center;justify-content:center">
      <span style="font-size:12px;color:var(--tm)">Loading Google Sign-In...</span>
    </div>

    <div style="display:flex;align-items:center;gap:10px;width:100%;margin:4px 0">
      <div style="flex:1;height:1px;background:var(--bd)"></div>
      <span style="font-size:10px;color:var(--tm);text-transform:uppercase;font-weight:700">OR LOCAL / DEV</span>
      <div style="flex:1;height:1px;background:var(--bd)"></div>
    </div>

    <div style="width:100%;display:flex;flex-direction:column;gap:8px">
      <input type="password" id="secretKeyInput" placeholder="Admin Secret Key" value="pillcare_admin_secret_key_2026" style="width:100%;padding:10px 12px;background:var(--sf2);border:1px solid var(--bd);border-radius:9px;color:var(--tx);font-size:13px;text-align:center;outline:none">
      <button class="btn primary" onclick="loginWithSecret()" style="width:100%;padding:10px;font-size:13px;font-weight:600">Sign In with Admin Secret</button>
    </div>

    <p class="err" id="loginErr" style="display:none"></p>"""

content = content.replace(old_login_box, new_login_box, 1)

# Add loginWithSecret function
js_login_func = """
function loginWithSecret() {
  const secret = document.getElementById('secretKeyInput').value.trim();
  if (!secret) { showErr('Please enter the Admin Secret Key.'); return; }
  localStorage.setItem('pillcare_admin_secret', secret);
  localStorage.setItem('pillcare_admin_user', JSON.stringify({ name: 'Admin (Secret Key)', email: 'admin@pillcare.in' }));
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'block';
  const chip = document.getElementById('userChip');
  if (chip) chip.style.display = 'flex';
  const name = document.getElementById('userName');
  if (name) name.textContent = 'Admin (Secret Key)';
  loadAll();
}
"""

content = content.replace("async function onGoogle(resp) {", js_login_func + "\nasync function onGoogle(resp) {", 1)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Successfully added Admin Secret Sign-In fallback option to admin.html.")
