import os

def fix_html(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    target = '''      <!-- Filtered Results -->
      <div class="card">
        <div class="card-h"><h3>Filtered Users (<span id="filter-count">0</span>)</h3></div>
        <table>
          <thead><tr><th>Email</th><th>Plan</th><th>Metric Value</th><th>Action</th></tr></thead>
          <tbody id="filtered-users-table"><tr><td colspan="4" class="empty">Apply filter to view results</td></tr></tbody>
        </table>
      </div>
    <!-- HEALTHCARE INTELLIGENCE & CONVERSION FUNNEL -->'''

    replacement = '''      <!-- Filtered Results -->
      <div class="card">
        <div class="card-h"><h3>Filtered Users (<span id="filter-count">0</span>)</h3></div>
        <table>
          <thead><tr><th>Email</th><th>Plan</th><th>Metric Value</th><th>Action</th></tr></thead>
          <tbody id="filtered-users-table"><tr><td colspan="4" class="empty">Apply filter to view results</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- HEALTHCARE INTELLIGENCE & CONVERSION FUNNEL -->'''

    if target in content:
        content = content.replace(target, replacement)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"SUCCESS: Fixed missing </div> for pg-adv-analytics in {filepath}")
    else:
        print(f"Target not matched in {filepath}")

fix_html("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    fix_html("../pillcare-website/admin/index.html")
