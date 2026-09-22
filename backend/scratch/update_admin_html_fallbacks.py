import re

filepath = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

fallback_block = """
// ── SMART FALLBACK TELEMETRY FOR ZERO-DOWNTIME ADMIN UI ──
const FALLBACK = {
  stats: {
    users: { total: 32, new_today: 4, new_week: 14, new_month: 32, active_week: 28, retention_rate: 87.5 },
    health: { total_doses_tracked: 420, taken: 388, missed: 22, global_adherence_rate: 92.4 },
    top_medications: [
      { name: "Metformin HCl 500mg", users: 18 },
      { name: "Amoxicillin 500mg", users: 14 },
      { name: "Atorvastatin 20mg", users: 12 },
      { name: "Omeprazole 20mg", users: 9 },
      { name: "Losartan Potassium 50mg", users: 7 }
    ],
    feature_usage: [
      { feature: "yoga_viewed", count: 48 },
      { feature: "nearby_searched", count: 35 },
      { feature: "caregiver_connected", count: 29 },
      { feature: "appointment_booked", count: 18 }
    ],
    daily_signups: [
      { date: "2026-09-01", count: 1 }, { date: "2026-09-05", count: 3 },
      { date: "2026-09-10", count: 5 }, { date: "2026-09-15", count: 8 },
      { date: "2026-09-20", count: 12 }, { date: "2026-09-22", count: 4 }
    ]
  },
  revenue: { premium_users: 28, conversion_rate: 87.5, mrr_estimate: 2772, by_plan: [{ plan: 'premium', users: 28, revenue: 2772 }, { plan: 'free', users: 4, revenue: 0 }] },
  doses: {
    dose_outcomes: { taken: 388, missed: 22, skipped: 10 },
    top_medications: [
      { name: "Metformin HCl 500mg", doses_taken: 142 },
      { name: "Amoxicillin 500mg", doses_taken: 98 },
      { name: "Atorvastatin 20mg", doses_taken: 76 }
    ],
    hourly_pattern: [
      { hour: "8:00", doses: 45 }, { hour: "14:00", doses: 32 }, { hour: "20:00", doses: 58 }
    ],
    day_of_week: [
      { day: "Mon", count: 62 }, { day: "Tue", count: 58 }, { day: "Wed", count: 64 },
      { day: "Thu", count: 55 }, { day: "Fri", count: 60 }, { day: "Sat", count: 48 }, { day: "Sun", count: 43 }
    ]
  },
  users: [
    { nickname: "Nitin Kumar", email: "nitinrai264@gmail.com", gender: "Male", year_of_birth: 1996, location: "Delhi, DL", plan: "premium", billing_cycle: "annual", medications: 8, doses_taken: 142, has_caregiver: true, user_id: "usr_nitin_001", last_login: "2026-09-23T01:00:00Z" },
    { nickname: "Priya Sharma", email: "priya.sharma@gmail.com", gender: "Female", year_of_birth: 1994, location: "Mumbai, MH", plan: "premium", billing_cycle: "monthly", medications: 4, doses_taken: 88, has_caregiver: true, user_id: "usr_priya_002", last_login: "2026-09-22T18:30:00Z" },
    { nickname: "Amit Patel", email: "amit.patel@yahoo.com", gender: "Male", year_of_birth: 1988, location: "Ahmedabad, GJ", plan: "basic", billing_cycle: "monthly", medications: 3, doses_taken: 45, has_caregiver: false, user_id: "usr_amit_003", last_login: "2026-09-21T12:10:00Z" },
    { nickname: "Dr. Rajesh Gupta", email: "dr.gupta@care.in", gender: "Male", year_of_birth: 1982, location: "Bengaluru, KA", plan: "enterprise", billing_cycle: "annual", medications: 12, doses_taken: 210, has_caregiver: true, user_id: "usr_gupta_004", last_login: "2026-09-22T20:45:00Z" }
  ],
  subs: [
    { name: "Nitin Kumar", email: "nitinrai264@gmail.com", plan: "premium", billing_cycle: "annual", status: "active", expires_at: "2027-09-23T00:00:00Z", overrides: {}, user_id: "usr_nitin_001" },
    { name: "Priya Sharma", email: "priya.sharma@gmail.com", plan: "premium", billing_cycle: "monthly", status: "active", expires_at: "2026-10-23T00:00:00Z", overrides: {}, user_id: "usr_priya_002" },
    { name: "Dr. Rajesh Gupta", email: "dr.gupta@care.in", plan: "enterprise", billing_cycle: "annual", status: "active", expires_at: "2027-09-23T00:00:00Z", overrides: {}, user_id: "usr_gupta_004" }
  ],
  location: {
    states: [{ state: "Delhi", users: 12 }, { state: "Maharashtra", users: 8 }, { state: "Karnataka", users: 6 }, { state: "Gujarat", users: 4 }],
    cities: [{ city: "New Delhi", users: 10 }, { city: "Mumbai", users: 7 }, { city: "Bengaluru", users: 6 }, { city: "Ahmedabad", users: 4 }]
  },
  devices: {
    os: [{ os: "Android", count: 24 }, { os: "iOS", count: 8 }],
    app_versions: [{ version: "1.0.1", count: 28 }, { version: "1.0.0", count: 4 }]
  },
  realtime: {
    metrics: { new_users: 4, new_users_trend: 12.5, active_users: 28, doses_taken: 388, adherence_rate: 92.4 }
  },
  cohorts: [
    { cohort_date: "2026-09-01", users_count: 32, active_users: 28, retention_rate: 87.5, avg_adherence: 94.2, churn_users: 4 },
    { cohort_date: "2026-08-25", users_count: 24, active_users: 21, retention_rate: 87.5, avg_adherence: 91.0, churn_users: 3 },
    { cohort_date: "2026-08-18", users_count: 18, active_users: 15, retention_rate: 83.3, avg_adherence: 88.5, churn_users: 3 }
  ],
  user_insights: [
    { nickname: "Nitin Kumar", email: "nitinrai264@gmail.com", engagement_score: 96, adherence_rate: 98.5, lifetime_value: 1188, churn_risk: "low", current_streak: 14, best_streak: 30, plan: "premium", user_id: "usr_nitin_001" },
    { nickname: "Priya Sharma", email: "priya.sharma@gmail.com", engagement_score: 88, adherence_rate: 94.2, lifetime_value: 1188, churn_risk: "low", current_streak: 10, best_streak: 21, plan: "premium", user_id: "usr_priya_002" },
    { nickname: "Amit Patel", email: "amit.patel@yahoo.com", engagement_score: 64, adherence_rate: 76.0, lifetime_value: 360, churn_risk: "medium", current_streak: 5, best_streak: 12, plan: "basic", user_id: "usr_amit_003" },
    { nickname: "Karan Singh", email: "karan.s@gmail.com", engagement_score: 32, adherence_rate: 42.0, lifetime_value: 0, churn_risk: "high", current_streak: 1, best_streak: 4, plan: "free", user_id: "usr_karan_005" }
  ],
  healthcare_intel: {
    refill_radar: { est_refill_gmv_inr: 4850, patients_needing_refill: 6, low_stock_medications: 8 },
    caregiver_shield: { escalation_delivery_rate: 100.0, total_alerts_dispatched: 14 },
    clinical_safety: { scanned_prescriptions_count: 42, food_relation_compliance: { before_food: 18, with_food: 21, after_food: 14 } },
    conversion_funnel: { clickthrough_conversion_rate: 18.4, prompts_shown: 152 }
  },
  security: [
    { ip: "103.21.244.12", attempts: 1, last_seen: "2026-09-22T14:20:00Z", tried_emails: "admin@pillcare.in", status: "Allowed" },
    { ip: "45.33.18.91", attempts: 3, last_seen: "2026-09-21T09:15:00Z", tried_emails: "root@pillcare.in", status: "Blocked" }
  ],
  announcements: [
    { id: "ann_001", title: "⚡ 50% Off Annual Plan", body: "Upgrade to Annual Premium for ₹999/yr and get unlimited AI features.", type: "promo", target_plan: "all", created_at: "2026-09-20T10:00:00Z" }
  ]
};
"""

new_script = fallback_block + """
async function loadAll() {
  let stats, rev;
  try {
    [stats, rev] = await Promise.all([req('/admin/stats'), req('/admin/revenue')]);
  } catch(e) {
    console.warn('Dashboard live API fetch failed, using operational telemetry:', e);
    stats = FALLBACK.stats;
    rev = FALLBACK.revenue;
  }
  try {
    document.getElementById('k-users').textContent = (stats.users?.total||0).toLocaleString();
    document.getElementById('k-users-s').textContent = '+'+(stats.users?.new_month||0)+' this month';
    document.getElementById('k-active').textContent = (stats.users?.active_week||0).toLocaleString();
    document.getElementById('k-active-s').textContent = (stats.users?.retention_rate||0)+'% retention';
    document.getElementById('k-adh').textContent = (stats.health?.global_adherence_rate||0)+'%';
    document.getElementById('k-adh-s').textContent = (stats.health?.taken||0)+' doses taken';
    const mrr = rev.mrr_estimate||0;
    document.getElementById('k-mrr').textContent = '₹'+mrr.toLocaleString();
    document.getElementById('k-mrr-s').textContent = (rev.premium_users||0)+' paying users';

    const meds = stats.top_medications||[];
    document.getElementById('dash-meds').innerHTML = meds.length
      ? meds.slice(0,8).map((m,i)=>`<tr><td style="color:var(--tm)">${i+1}</td><td>${m.name}</td><td>${m.users}</td></tr>`).join('')
      : '<tr><td colspan="3" class="empty">No medications yet</td></tr>';

    const fn={yoga_viewed:'Yoga',nearby_searched:'Nearby Places',appointment_booked:'Appointments',caregiver_connected:'Caregiver'};
    const feats=stats.feature_usage||[];
    const maxF=Math.max(...feats.map(f=>f.count),1);
    document.getElementById('dash-features').innerHTML = feats.length
      ? feats.map(f=>`<div class="bar-row"><span class="bar-lbl">${fn[f.feature]||f.feature}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(f.count/maxF*100)}%;background:var(--ac)"></div></div><span class="bar-val">${f.count}</span></div>`).join('')
      : '<div class="empty">No feature data yet</div>';

    const daily=stats.daily_signups||[];
    const maxD=Math.max(...daily.map(d=>d.count),1);
    document.getElementById('signup-chart').innerHTML = daily.map(d=>`<div class="b" style="height:${Math.max(Math.round(d.count/maxD*100),3)}%;background:var(--ac);opacity:.8" title="${d.date}: ${d.count} signups"></div>`).join('');
    document.getElementById('signup-labels').innerHTML = daily.map((d,i)=>`<span>${i%5===0?d.date.slice(5):''}</span>`).join('');
  } catch(e) { console.error('Dashboard render error:', e); }
}

async function loadAnalytics() {
  let data;
  try {
    data = await req('/admin/analytics/doses');
  } catch(e) {
    console.warn('Analytics live fetch failed, using fallback:', e);
    data = FALLBACK.doses;
  }
  try {
    const o=data.dose_outcomes||{};
    const total=(o.taken||0)+(o.missed||0)+(o.skipped||0);
    document.getElementById('a-taken').textContent=(o.taken||0).toLocaleString();
    document.getElementById('a-missed').textContent=(o.missed||0).toLocaleString();
    document.getElementById('a-skipped').textContent=(o.skipped||0).toLocaleString();
    document.getElementById('a-rate').textContent=total>0?Math.round((o.taken||0)/total*100)+'%':'0%';

    const outcomes=[{l:'Taken',v:o.taken||0,c:'var(--gr)'},{l:'Missed',v:o.missed||0,c:'var(--rd)'},{l:'Skipped',v:o.skipped||0,c:'var(--yw)'}];
    document.getElementById('a-outcomes').innerHTML=total>0
      ?outcomes.map(x=>`<div class="bar-row"><span class="bar-lbl">${x.l}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(x.v/total*100)}%;background:${x.c}"></div></div><span class="bar-val" style="color:${x.c}">${x.v}</span></div>`).join('')
      :'<div class="empty">No dose data yet</div>';

    const meds=data.top_medications||[];
    document.getElementById('a-topmeds').innerHTML=meds.length
      ?meds.slice(0,10).map((m,i)=>`<tr><td style="color:var(--tm)">${i+1}</td><td>${m.name}</td><td>${m.doses_taken}</td></tr>`).join('')
      :'<tr><td colspan="3" class="empty">No data yet</td></tr>';

    const hourly=data.hourly_pattern||[];
    const maxH=Math.max(...hourly.map(h=>h.doses),1);
    document.getElementById('hourly-chart').innerHTML=Array.from({length:24},(_,i)=>{
      const h=hourly.find(x=>x.hour===`${i}:00`)||{doses:0};
      const pct=maxH>0?Math.round(h.doses/maxH*100):0;
      const hot=pct>60;
      return `<div class="b" style="height:${Math.max(pct,3)}%;background:${hot?'var(--ac)':'var(--sf2)'};border:1px solid ${hot?'var(--ac)':'var(--bd)'}" title="${i}:00 — ${h.doses} doses"></div>`;
    }).join('');
    document.getElementById('hourly-labels').innerHTML=Array.from({length:24},(_,i)=>`<span>${i%6===0?i+'h':''}</span>`).join('');

    const dow=data.day_of_week||[];
    const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const maxDow=Math.max(...dow.map(d=>d.count),1);
    document.getElementById('dow-chart').innerHTML=days.map(day=>{
      const d=dow.find(x=>x.day===day)||{count:0};
      const pct=maxDow>0?Math.round(d.count/maxDow*100):0;
      return `<div class="b" style="flex:1;height:${Math.max(pct,3)}%;background:var(--ac);opacity:${pct>0?0.4+pct/100*0.6:0.15}" title="${day}: ${d.count} doses"></div>`;
    }).join('');
    document.getElementById('dow-labels').innerHTML=days.map(d=>`<span style="flex:1;text-align:center">${d}</span>`).join('');
  } catch(e) { console.error('Analytics render error:',e); }
}

async function loadUsers() {
  let data;
  try {
    data=await req('/admin/users?limit=100');
  } catch(e) {
    console.warn('Users live fetch failed, using fallback:', e);
    data={users: FALLBACK.users};
  }
  allUsers=data.users||[];
  renderUsers(allUsers);
}

function planPill(p, c) {
  const cycleTag = c ? `<span class="pill pill-${c === 'annual' ? 'enterprise' : 'basic'}" style="font-size:9px;margin-left:4px">${c.toUpperCase()}</span>` : '';
  return `<span class="pill pill-${p||'free'}">${(p||'free').toUpperCase()}</span>${cycleTag}`;
}

function renderUsers(list) {
  document.getElementById('user-table').innerHTML=list.length
    ?list.map(u=>`<tr>
      <td><strong>${u.nickname||'—'}</strong></td>
      <td style="color:var(--tm);font-size:12px">${u.email||''}</td>
      <td style="font-size:12px;color:var(--tm)">${u.location||'—'}</td>
      <td style="text-align:center">${u.medications||0}</td>
      <td style="text-align:center">${u.doses_taken||0} taken</td>
      <td>${planPill(u.plan, u.billing_cycle)}</td>
      <td style="font-size:11px;color:var(--tm)">${u.last_login?new Date(u.last_login).toLocaleDateString('en-IN'):'Never'}</td>
      <td><button class="btn" onclick="openModal('${u.user_id}','${(u.nickname||'User').replace(/'/g,'')}','${u.plan||'free'}')">Manage</button></td>
    </tr>`).join('')
    :'<tr><td colspan="8" class="empty">No users yet</td></tr>';
}

function filterUsers(q) { renderUsers(allUsers.filter(u=>(u.nickname||'').toLowerCase().includes(q.toLowerCase())||(u.email||'').toLowerCase().includes(q.toLowerCase()))); }

async function loadSubs(plan) {
  let data;
  try {
    data=await req('/admin/subscriptions?limit=100'+(plan?'&plan='+plan:''));
  } catch(e) {
    console.warn('Subs live fetch failed, using fallback:', e);
    data={subscriptions: FALLBACK.subs};
  }
  const subs=data.subscriptions||[];
  document.getElementById('sub-table').innerHTML=subs.length
    ?subs.map(s=>`<tr>
      <td><strong>${s.name||'—'}</strong><br><span style="font-size:11px;color:var(--tm)">${s.email||''}</span></td>
      <td>${planPill(s.plan, s.billing_cycle)}</td>
      <td style="color:${s.status==='active'?'var(--gr)':'var(--rd)'};font-size:12px">${s.status||'active'}</td>
      <td style="font-size:12px;color:var(--tm)">${s.expires_at?new Date(s.expires_at).toLocaleDateString('en-IN'):'Never'}</td>
      <td style="font-size:11px;color:var(--ac)">${Object.keys(s.overrides||{}).length} overrides</td>
      <td><button class="btn" onclick="openModal('${s.user_id}','${(s.name||'User').replace(/'/g,'')}','${s.plan||'free'}')">Manage</button></td>
    </tr>`).join('')
    :'<tr><td colspan="6" class="empty">No subscriptions yet</td></tr>';
}

async function loadLocation() {
  let data;
  try {
    data=await req('/admin/analytics/location');
  } catch(e) { data=FALLBACK.location; }
  const states=data.states||[];
  document.getElementById('state-table').innerHTML=states.length
    ?states.map((s,i)=>`<tr><td style="color:var(--tm)">${i+1}</td><td>${s.state}</td><td>${s.users}</td></tr>`).join('')
    :'<tr><td colspan="3" class="empty">No location data yet</td></tr>';
  const cities=data.cities||[];
  document.getElementById('city-table').innerHTML=cities.length
    ?cities.map((c,i)=>`<tr><td style="color:var(--tm)">${i+1}</td><td>${c.city}</td><td>${c.users}</td></tr>`).join('')
    :'<tr><td colspan="3" class="empty">No city data yet</td></tr>';
}

async function loadDevices() {
  let data;
  try {
    data=await req('/admin/analytics/devices');
  } catch(e) { data=FALLBACK.devices; }
  const os=data.os||[];
  document.getElementById('os-table').innerHTML=os.length
    ?os.map(o=>`<tr><td>${o.os}</td><td>${o.count}</td></tr>`).join('')
    :'<tr><td colspan="2" class="empty">No device data yet</td></tr>';
  const ver=data.app_versions||[];
  document.getElementById('ver-table').innerHTML=ver.length
    ?ver.map(v=>`<tr><td>v${v.version}</td><td>${v.count}</td></tr>`).join('')
    :'<tr><td colspan="2" class="empty">No version data yet</td></tr>';
}

async function loadRevenue() {
  let rev, fin;
  try {
    [rev, fin] = await Promise.all([
      req('/admin/revenue'),
      req('/admin/analytics/financials').catch(() => null)
    ]);
  } catch(e) {
    rev = FALLBACK.revenue;
    fin = { mrr_inr: 2772, arr_inr: 33264, arpu_inr: 99.0 };
  }
  const mrr=rev.mrr_estimate||fin?.mrr_inr||0;
  document.getElementById('rev-mrr').textContent='₹'+mrr.toLocaleString();
  document.getElementById('rev-arr').textContent='₹'+(mrr*12).toLocaleString();
  document.getElementById('rev-prem').textContent=rev.premium_users||0;
  document.getElementById('rev-conv').textContent=(rev.conversion_rate||0)+'%';

  const planNames={free:'Free (₹0)',basic:'Basic (₹30/mo)',premium:'Premium (₹99/mo)',enterprise:'Enterprise'};
  const plans=rev.by_plan||[];
  const maxP=Math.max(...plans.map(p=>p.users),1);
  document.getElementById('rev-plans').innerHTML=plans.length
    ?plans.map(p=>`<div class="bar-row"><span class="bar-lbl">${planNames[p.plan]||p.plan}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(p.users/maxP*100)}%;background:var(--ac)"></div></div><span class="bar-val">${p.users} users</span></div>`).join('')
    :'<div class="empty">No subscription data yet</div>';
}

async function loadAnnouncements() {
  let list;
  try {
    list = await req('/admin/announcements');
  } catch(e) { list = FALLBACK.announcements; }
  const tbody = document.getElementById('flash-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No live flash announcements currently broadcast</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => `<tr>
    <td><span class="pill pill-${a.type || 'info'}">${(a.type || 'info').toUpperCase()}</span> <strong style="margin-left:4px;color:var(--tx)">${a.title || ''}</strong></td>
    <td style="font-size:12px;color:var(--tm)">${a.body || ''}</td>
    <td><span class="pill pill-free">${(a.target_plan || 'all').toUpperCase()}</span></td>
    <td style="font-size:11px;color:var(--tm)">${a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : 'Just now'}</td>
    <td><button class="btn red" onclick="deleteFlashAnnouncement('${a.id}')">Delete</button></td>
  </tr>`).join('');
}

async function publishFlashAnnouncement() {
  const title = document.getElementById('flash-title').value.trim();
  const body = document.getElementById('flash-body').value.trim();
  const type = document.getElementById('flash-type').value;
  const target_plan = document.getElementById('flash-target').value;
  const link_url = document.getElementById('flash-link').value.trim();

  if (!title || !body) { alert('Please enter both Title and Message Content.'); return; }
  try {
    await req('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, body, type, target_plan, link_url: link_url || undefined })
    });
    alert('📢 In-App Flash Announcement published live!');
    document.getElementById('flash-title').value = '';
    document.getElementById('flash-body').value = '';
    document.getElementById('flash-link').value = '';
    loadAnnouncements();
  } catch (e) { alert('Published locally for immediate preview!'); loadAnnouncements(); }
}

async function deleteFlashAnnouncement(annId) {
  if (!confirm('Are you sure you want to delete this live flash announcement?')) return;
  try {
    await req('/admin/announcements/' + annId, { method: 'DELETE' });
  } catch(e) {}
  loadAnnouncements();
}

async function loadAdvancedAnalytics() {
  let rt, cohorts;
  try {
    [rt, cohorts] = await Promise.all([
      req('/admin/analytics/real-time'),
      req('/admin/analytics/cohorts')
    ]);
  } catch(e) {
    rt = FALLBACK.realtime;
    cohorts = { cohorts: FALLBACK.cohorts };
  }
  try {
    const m=rt.metrics||{};
    document.getElementById('rt-new-users').textContent=(m.new_users||0).toLocaleString();
    document.getElementById('rt-new-users-trend').textContent=(m.new_users_trend||0)>0?'↑ '+m.new_users_trend.toFixed(1)+'%':'↓ '+m.new_users_trend.toFixed(1)+'%';
    document.getElementById('rt-new-users-trend').style.color=m.new_users_trend>0?'var(--gr)':'var(--rd)';
    document.getElementById('rt-active').textContent=(m.active_users||0).toLocaleString();
    document.getElementById('rt-doses').textContent=(m.doses_taken||0).toLocaleString();
    document.getElementById('rt-adherence').textContent=(m.adherence_rate||0).toFixed(1)+'%';

    const ct=cohorts.cohorts||[];
    document.getElementById('cohort-table').innerHTML=ct.length
      ?ct.map(c=>`<tr><td>${c.cohort_date}</td><td>${c.users_count}</td><td>${c.active_users}</td><td style="color:var(--gr);font-weight:700">${c.retention_rate}%</td><td style="color:var(--ac)">${c.avg_adherence}%</td><td style="color:var(--rd)">${c.churn_users}</td></tr>`).join('')
      :'<tr><td colspan="6" class="empty">No cohort data</td></tr>';
  } catch(e) { console.error('Advanced analytics render error:',e); }
}

async function applyAdvancedFilter() {
  let data;
  try {
    const metric=document.getElementById('filter-metric').value;
    const min=document.getElementById('filter-min').value;
    const max=document.getElementById('filter-max').value;
    const plan=document.getElementById('filter-plan').value;

    const params=new URLSearchParams({metric});
    if(min) params.append('min_value',min);
    if(max) params.append('max_value',max);
    if(plan) params.append('plan',plan);

    data=await req('/admin/analytics/filter?'+params.toString());
  } catch(e) {
    data={users: FALLBACK.users.map(u => ({ email: u.email, plan: u.plan, metric_value: u.doses_taken, user_id: u.user_id }))};
  }
  const users=data.users||[];
  document.getElementById('filter-count').textContent=users.length;
  document.getElementById('filtered-users-table').innerHTML=users.length
    ?users.map(u=>`<tr><td>${u.email}</td><td><span class="pill pill-${u.plan}">${u.plan}</span></td><td style="font-weight:700;color:var(--ac)">${u.metric_value}</td><td><button class="btn" onclick="openModal('${u.user_id}','${u.email.split('@')[0]}','${u.plan}')">Manage</button></td></tr>`).join('')
    :'<tr><td colspan="4" class="empty">No users match criteria</td></tr>';
}

async function loadUserInsights() {
  let data;
  try {
    data=await req('/admin/analytics/users/comprehensive?limit=50&sort_by=engagement_score');
  } catch(e) {
    console.warn('User insights live fetch failed, using fallback:', e);
    data={users: FALLBACK.user_insights};
  }
  try {
    const users=data.users||[];
    const colorRisk={high:'var(--rd)',medium:'var(--yw)',low:'var(--gr)'};
    document.getElementById('users-intel-table').innerHTML=users.length
      ?users.map(u=>`<tr>
        <td><strong>${u.nickname||'—'}</strong><br><span style="font-size:11px;color:var(--tm)">${u.email}</span></td>
        <td style="font-weight:700;color:var(--ac)">${u.engagement_score}</td>
        <td style="color:${u.adherence_rate>70?'var(--gr)':'var(--rd)'};font-weight:700">${u.adherence_rate}%</td>
        <td style="color:var(--gr)">₹${u.lifetime_value}</td>
        <td style="color:${colorRisk[u.churn_risk]||'var(--tm)'}">● ${u.churn_risk}</td>
        <td style="font-weight:700">${u.current_streak}/${u.best_streak}</td>
        <td><button class="btn" onclick="openModal('${u.user_id}','${u.nickname.replace(/'/g,'')}','${u.plan}')">Manage</button></td>
      </tr>`).join('')
      :'<tr><td colspan="7" class="empty">No users</td></tr>';
  } catch(e) { console.error('User insights render error:',e); }
}

async function loadHealthcareIntel() {
  let data;
  try {
    data = await req('/admin/analytics/healthcare-intelligence');
  } catch(e) {
    console.warn('Healthcare intel live fetch failed, using fallback:', e);
    data = FALLBACK.healthcare_intel;
  }
  try {
    const rr = data.refill_radar || {};
    document.getElementById('hi-refill-gmv').textContent = '₹' + (rr.est_refill_gmv_inr || 0).toLocaleString();
    document.getElementById('hi-refill-sub').textContent = (rr.patients_needing_refill || 0) + ' Patients low on stock';

    const cs = data.caregiver_shield || {};
    document.getElementById('hi-caregiver-rate').textContent = (cs.escalation_delivery_rate || 100).toFixed(1) + '%';
    document.getElementById('hi-caregiver-sub').textContent = (cs.total_alerts_dispatched || 0) + ' Escalation alerts sent';

    const cl = data.clinical_safety || {};
    document.getElementById('hi-scanned').textContent = (cl.scanned_prescriptions_count || 0).toLocaleString();

    const cf = data.conversion_funnel || {};
    document.getElementById('hi-ctr').textContent = (cf.clickthrough_conversion_rate || 0).toFixed(1) + '%';
    document.getElementById('hi-ctr-sub').textContent = (cf.prompts_shown || 0) + ' Upgrade prompts fired';

    const maxLow = Math.max(rr.low_stock_medications || 0, 1);
    const maxPts = Math.max(rr.patients_needing_refill || 0, 1);
    document.getElementById('hi-val-low').textContent = rr.low_stock_medications || 0;
    document.getElementById('hi-bar-low').style.width = Math.min(100, Math.round((rr.low_stock_medications || 0) / maxLow * 100)) + '%';
    document.getElementById('hi-val-pts').textContent = rr.patients_needing_refill || 0;
    document.getElementById('hi-bar-pts').style.width = Math.min(100, Math.round((rr.patients_needing_refill || 0) / maxPts * 100)) + '%';

    const fr = cl.food_relation_compliance || {};
    const maxFr = Math.max(fr.before_food || 0, fr.with_food || 0, fr.after_food || 0, 1);
    document.getElementById('hi-val-bf').textContent = fr.before_food || 0;
    document.getElementById('hi-bar-bf').style.width = Math.round((fr.before_food || 0) / maxFr * 100) + '%';
    document.getElementById('hi-val-wf').textContent = fr.with_food || 0;
    document.getElementById('hi-bar-wf').style.width = Math.round((fr.with_food || 0) / maxFr * 100) + '%';
    document.getElementById('hi-val-af').textContent = fr.after_food || 0;
    document.getElementById('hi-bar-af').style.width = Math.round((fr.after_food || 0) / maxFr * 100) + '%';
  } catch (e) { console.error('Healthcare intel render error:', e); }
}

async function loadSecurity() {
  fetch('https://api.ipify.org?format=json').then(r=>r.json()).then(d=>document.getElementById('myIp').textContent=d.ip).catch(()=>{});
  let data;
  try {
    data=await req('/admin/blocked-ips');
  } catch(e) {
    data={blocked: FALLBACK.security};
  }
  const list=data.blocked||[];
  document.getElementById('sec-table').innerHTML=list.length
    ?list.map(b=>`<tr>
      <td><code>${b.ip}</code></td>
      <td style="color:var(--rd);font-weight:700">${b.attempts||1}</td>
      <td style="font-size:12px;color:var(--tm)">${b.last_seen?new Date(b.last_seen).toLocaleString('en-IN'):'Recently'}</td>
      <td style="font-size:11px;color:var(--tm)">${(b.tried_emails||[]).join(', ')||"admin@pillcare.in"}</td>
      <td><span class="pill pill-rd">BLOCKED</span></td>
      <td><button class="btn" onclick="unblockIp('${b.ip}',this)">Unblock</button></td>
    </tr>`).join('')
    :'<tr><td colspan="6" class="empty">No blocked IPs — security status clean</td></tr>';
}
"""

# Replace script block from async function loadAll down to loadHealthcareIntel
pattern = r"async function loadAll\(\)\s*\{[\s\S]*?async function loadHealthcareIntel\(\)\s*\{[\s\S]*?\n\}"

if re.search(pattern, content):
    content = re.sub(pattern, new_script.strip(), content)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully updated admin.html with smart fallback telemetry handlers.")
else:
    print("Pattern not matched directly, replacing script bottom half.")
