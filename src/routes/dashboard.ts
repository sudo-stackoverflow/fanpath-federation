import { Router } from "express";
import fs from "fs";
import path from "path";
import { requireKey } from "../middleware/auth";

const router = Router();

const HTML_PATH = path.resolve(__dirname, "../../static/federation.html");

// ── / — serve dashboard with full interactive script injected ─────────────────
router.get("/", requireKey, (req, res) => {
  if (!fs.existsSync(HTML_PATH)) {
    return res
      .status(404)
      .send("<h2>Dashboard HTML not found at " + HTML_PATH + "</h2>");
  }

  let html = fs.readFileSync(HTML_PATH, "utf-8");
  const key = req.query.key as string;

  const liveScript = `
<script>
(function() {
  var KEY = ${JSON.stringify(key)};
  var FANPATH = 'https://www.usefanpath.com';
  var currentWindow = '7d';

  // ── Sidebar scroll map ─────────────────────────────────────────────────────
  var SIDEBAR_MAP = [
    ['Dashboard',           null],
    ['Fan Demographics',    'Fan Demographics'],
    ['City Intelligence',   'Fans by Host City'],
    ['Community Activity',  'FAN SENTIMENT TRACKER'],
    ['Intel Feed',          'Official Intel Feed'],
    ['Events & Meetups',    'Match Fan Demand'],
    ['Housing Analytics',   'Housing Intel'],
    ['Ticket Matching',     'Ticket Matching'],
    ['Travel Patterns',     'Inter-City Travel Flow'],
    ['Sponsor Metrics',     'Sponsor Engagement'],
    ['Revenue Reports',     'Sponsor & Partner ROI Summary'],
    ['Safety Layer',        'SAFETY INTELLIGENCE'],
    ['Fan Sentiment',       'FAN SENTIMENT TRACKER'],
    ['Forward Forecast',    'PREDICTIVE 7-DAY FORWARD FORECAST'],
    ['Fan CRM',             'FAN CRM & LOYALTY'],
    ['Black Market Intel',  'BLACK MARKET & TICKET INTELLIGENCE'],
    ['Economic Impact',     'ECONOMIC IMPACT MODULE'],
    ['Configuration',       null],
    ['API Access',          null],
  ];

  function findSection(label) {
    // Search both .section-hdr and .card-title
    var all = document.querySelectorAll('.section-hdr, .card-title');
    for (var i = 0; i < all.length; i++) {
      if (all[i].textContent.trim().includes(label)) return all[i];
    }
    return null;
  }

  // ── Live clock ──────────────────────────────────────────────────────────────
  var navDate = document.querySelector('.nav-date');
  function updateClock() {
    if (!navDate) return;
    var now = new Date();
    var opts = { month: 'short', day: 'numeric' };
    var h = now.getHours().toString().padStart(2,'0');
    var m = now.getMinutes().toString().padStart(2,'0');
    navDate.textContent = 'WC2026 · ' + now.toLocaleDateString('en-US', opts) + ' · ' + h + ':' + m;
  }
  updateClock();
  setInterval(updateClock, 30000);

  // ── Sidebar nav ─────────────────────────────────────────────────────────────
  var sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(function(item) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', function() {
      sidebarItems.forEach(function(s) { s.classList.remove('active'); });
      item.classList.add('active');

      // Strip everything outside printable ASCII (space-tilde = 32-126)
      // Using /[^ -~]/g avoids hex escapes that get mangled in the template literal
      var label = item.textContent.replace(/[^ -~]/g,'').replace(/\s+/g,' ').trim();
      // strip badge numbers ("3 new", "7")
      label = label.replace(/\d+\s*new|\d+/gi,'').trim();

      var entry = SIDEBAR_MAP.find(function(e) { return label.startsWith(e[0]) || e[0].startsWith(label.split(' ')[0]); });
      var target = entry && entry[1] ? findSection(entry[1]) : null;

      if (label.includes('Dashboard')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (label.includes('Configuration')) {
        showToast('Configuration panel coming soon');
      } else if (label.includes('API Access')) {
        showToast('API key: Contact federation@usefanpath.com');
      } else if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Time filter buttons ─────────────────────────────────────────────────────
  var tfBtns = document.querySelectorAll('.tf');
  tfBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tfBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var win = btn.textContent.trim().toLowerCase();
      // map '24h' → '24h', '7d' → '7d', '30d' → '30d', 'all' → 'all'
      currentWindow = win;
      loadData(win);
    });
  });

  // ── Card action links ───────────────────────────────────────────────────────
  var cardActions = document.querySelectorAll('.card-act');
  cardActions.forEach(function(act) {
    act.style.cursor = 'pointer';
    var txt = act.textContent.trim();
    act.addEventListener('click', function() {
      if (txt.includes('View All'))     window.open(FANPATH + '/housing', '_blank');
      else if (txt.includes('Map View'))   act.closest('.card').querySelector('.city-row') && act.closest('.card').querySelector('.city-row').scrollIntoView({behavior:'smooth'});
      else if (txt.includes('See All'))    window.open(FANPATH + '/the-club', '_blank');
      else if (txt.includes('Full Schedule')) window.open(FANPATH + '/the-club?tab=intel', '_blank');
      else if (txt.includes('Full Report'))   showToast('Full sponsor report — Premium feature');
      else if (txt.includes('Export'))        exportCSV();
    });
  });

  // ── Export button (header) ──────────────────────────────────────────────────
  var exportBtn = document.querySelector('.btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }

  // ── CRM Export button ───────────────────────────────────────────────────────
  var crmBtn = document.querySelector('.crm-btn');
  if (crmBtn) {
    crmBtn.addEventListener('click', exportCRMCSV);
  }

  // ── Nation selector dropdown ─────────────────────────────────────────────────
  var fedSel = document.querySelector('.fed-selector');
  if (fedSel) {
    fedSel.style.cursor = 'pointer';
    fedSel.style.userSelect = 'none';
    fedSel.addEventListener('click', function(e) {
      e.stopPropagation();
      var existing = document.getElementById('fp-nation-dd');
      if (existing) { existing.remove(); return; }
      var dd = document.createElement('div');
      dd.id = 'fp-nation-dd';
      dd.style.cssText = 'position:fixed;background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:6px 0;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;font-size:13px;font-family:DM Sans,sans-serif;';
      var rawNations = _lastData && _lastData.topNations ? _lastData.topNations : [];
      var nations = mergeNations(rawNations).slice(0,10);
      var header = '<div style="padding:6px 14px 8px;color:#aaa;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid #f0f0f0;margin-bottom:4px;">TOP NATIONS</div>';
      var rows = nations.length
        ? nations.map(function(n) {
            return '<div style="padding:7px 14px;cursor:default;display:flex;justify-content:space-between;align-items:center;">'
              + '<span style="font-weight:500;">' + fmtNation(n.nation) + '</span>'
              + '<span style="font-size:11px;color:#888;font-family:monospace;">' + Number(n.count).toLocaleString() + ' fans</span></div>';
          }).join('')
        : '<div style="padding:10px 14px;color:#aaa;">Loading…</div>';
      var footer = '<div style="padding:8px 14px;border-top:1px solid #f0f0f0;margin-top:4px;font-size:11px;color:#aaa;text-align:center;">Global dashboard · all nations</div>';
      dd.innerHTML = header + rows + footer;
      var rect = fedSel.getBoundingClientRect();
      dd.style.top = (rect.bottom + 6) + 'px';
      dd.style.right = (window.innerWidth - rect.right) + 'px';
      document.body.appendChild(dd);
      setTimeout(function() {
        document.addEventListener('click', function hdl() {
          dd.remove();
          document.removeEventListener('click', hdl);
        });
      }, 0);
    });
  }

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(msg) {
    var t = document.getElementById('fp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'fp-toast';
      t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:DM Sans,sans-serif;z-index:9999;pointer-events:none;transition:opacity 0.3s;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(function() { t.style.opacity = '0'; }, 3000);
  }

  // ── CSV export (all stats) ───────────────────────────────────────────────────
  var _lastData = null;
  function exportCSV() {
    if (!_lastData) { showToast('Data still loading…'); return; }
    var d = _lastData;
    var rows = [
      ['Metric','Value'],
      ['Total Users', d.totalUsers],
      ['Premium Users', d.premiumUsers],
      ['Premium Conversion %', d.premiumConversionRate],
      ['Active Housing Listings', d.activeHousingListings],
      ['Avg Price/Night ($)', d.avgPricePerNight],
      ['Total Events', d.totalEvents],
      ['Total Ticket Listings', d.totalTicketListings],
      ['MyPath Plans', d.totalMyPathPlans],
      [''],
      ['Date','Signups'],
    ];
    (d.signupsByDay || []).forEach(function(s) { rows.push([s.date, s.count]); });
    rows.push(['']);
    rows.push(['Nation','Users']);
    (d.topNations || []).forEach(function(n) { rows.push([n.nation, n.count]); });
    if (d.ga4 && d.ga4.available) {
      rows.push(['']);
      rows.push(['GA4 Metric','Value (28d)']);
      rows.push(['Active Users', d.ga4.activeUsers28d]);
      rows.push(['New Users', d.ga4.newUsers28d]);
      rows.push(['Sessions', d.ga4.sessions28d]);
      rows.push(['Avg Session (s)', d.ga4.avgSessionDurationSecs]);
      rows.push(['Bounce Rate %', d.ga4.bounceRate]);
      rows.push(['Engagement Rate %', d.ga4.engagementRate]);
    }
    downloadCSV('fanpath-federation-stats.csv', rows);
    showToast('Exported!');
  }

  function exportCRMCSV() {
    if (!_lastData) { showToast('Data still loading…'); return; }
    var rows = [['Nation','Fans']];
    (_lastData.topNations || []).forEach(function(n) { rows.push([n.nation, n.count]); });
    downloadCSV('fanpath-crm-segment.csv', rows);
    showToast('CRM segment exported!');
  }

  function downloadCSV(filename, rows) {
    var csv = rows.map(function(r) {
      return r.map(function(v) { return '"' + String(v||'').replace(/"/g,'""') + '"'; }).join(',');
    }).join('\\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = filename;
    a.click();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  var CITY_NAMES = {
    'atlanta':           'Atlanta',
    'boston':            'Boston',
    'dallas':            'Dallas',
    'guadalajara':       'Guadalajara',
    'houston':           'Houston',
    'kansas-city':       'Kansas City',
    'los-angeles':       'Los Angeles',
    'mexico-city':       'Mexico City',
    'miami':             'Miami',
    'monterrey':         'Monterrey',
    'new-york':          'New York',
    'philadelphia':      'Philadelphia',
    'san-francisco':     'San Francisco',
    'seattle':           'Seattle',
    'toronto':           'Toronto',
    'vancouver':         'Vancouver',
    // common abbreviations / alternate slugs
    'nyc':               'New York',
    'la':                'Los Angeles',
    'sf':                'San Francisco',
    'mx-city':           'Mexico City',
    'kc':                'Kansas City',
    'philly':            'Philadelphia',
  };
  function cityName(slug) {
    if (!slug) return '';
    var s = String(slug).toLowerCase().trim();
    return CITY_NAMES[s] || s.replace(/-/g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
  }
  // Keep titleCase for non-city generic use
  function titleCase(str) {
    return str.replace(/-/g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
  }
  function fmtNation(code) {
    return code.toUpperCase();
  }
  // Deduplicate topNations by normalising case, merge counts
  function mergeNations(nations) {
    var map = {};
    (nations||[]).forEach(function(n) {
      var key = n.nation.toLowerCase();
      map[key] = (map[key]||0) + n.count;
    });
    return Object.keys(map).map(function(k){return{nation:k,count:map[k]};})
      .sort(function(a,b){return b.count-a.count;});
  }

  // ── Render data ──────────────────────────────────────────────────────────────
  function render(d) {
    _lastData = d;

    var mergedNations = mergeNations(d.topNations);

    // KPIs — map all 5 slots to real data (repurpose Avg Spend→Events, Sponsor→MyPath)
    document.querySelectorAll('.kpi').forEach(function(kpi) {
      var lblEl = kpi.querySelector('.kpi-lbl');
      var val   = kpi.querySelector('.kpi-val');
      var delt  = kpi.querySelector('.kpi-delta');
      if (!val || !lblEl) return;
      var lbl = lblEl.textContent.trim();

      if (lbl === 'Verified Fans') {
        val.textContent  = Number(d.totalUsers||0).toLocaleString();
        if (delt) delt.textContent = 'Live from Fanpath DB';
      } else if (lbl === 'Premium Members') {
        val.textContent  = Number(d.premiumUsers||0).toLocaleString();
        if (delt) delt.textContent = (d.premiumConversionRate||0) + '% conv. rate';
      } else if (lbl === 'Housing Matches') {
        val.textContent  = Number(d.activeHousingListings||0).toLocaleString();
        if (delt) delt.textContent = 'Avg $' + (d.avgPricePerNight||0) + '/night';
      } else if (lbl === 'Avg Spend / Fan') {
        // Repurpose: show total events
        lblEl.textContent = 'Total Events';
        val.textContent   = Number(d.totalEvents||0).toLocaleString();
        if (delt) delt.textContent = 'Across all host cities';
      } else if (lbl === 'Sponsor Impressions' || lbl === 'Total Events') {
        // Repurpose: show MyPath plans generated
        lblEl.textContent = 'MyPath Plans';
        val.textContent   = Number(d.totalMyPathPlans||0).toLocaleString();
        if (delt) delt.textContent = 'AI itineraries generated';
      }
    });

    // Mini cards — disambiguate Housing vs Ticket sections
    document.querySelectorAll('.card').forEach(function(card) {
      var titleEl = card.querySelector('.card-title');
      if (!titleEl) return;
      var cardTitle = titleEl.textContent.trim();

      card.querySelectorAll('.mini').forEach(function(mini) {
        var lbl = (mini.querySelector('.mini-lbl')||{}).textContent||'';
        var val = mini.querySelector('.mini-val');
        if (!val) return;
        lbl = lbl.trim();

        if (cardTitle === 'Housing Intel') {
          if (lbl === 'Active Listings')   val.textContent = Number(d.activeHousingListings||0).toLocaleString();
          if (lbl === 'Avg. Price / Night') val.textContent = '$' + Number(d.avgPricePerNight||0).toLocaleString();
        } else if (cardTitle === 'Ticket Matching') {
          if (lbl === 'Active Listings')   val.textContent = Number(d.totalTicketListings||0).toLocaleString();
        }
      });
    });

    // Signup bars + growth badge
    var bars    = document.querySelectorAll('.bar-col');
    var signups = d.signupsByDay || [];
    var maxSig  = Math.max.apply(null, signups.map(function(s){return s.count;})) || 1;
    var offset  = bars.length - signups.length;
    signups.forEach(function(day, i) {
      var col = bars[offset + i];
      if (!col) return;
      var barG = col.querySelector('.bar-g');
      var lbl  = col.querySelector('.bar-lbl');
      if (barG) barG.style.height = Math.max(4, Math.round((day.count / maxSig) * 100)) + '%';
      if (lbl)  lbl.textContent   = day.label || day.date.slice(8);
      col.title = day.date + ': ' + day.count + ' signups';
    });
    // Signup card: show growth badge + 7d total
    var signupCard = Array.from(document.querySelectorAll('.card-title'))
      .find(function(el) { return el.textContent.includes('Daily Fan Signups'); });
    if (signupCard) {
      var growthBadge = signupCard.parentNode.querySelector('.fp-growth-badge');
      if (!growthBadge) {
        growthBadge = document.createElement('span');
        growthBadge.className = 'fp-growth-badge';
        growthBadge.style.cssText = 'font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:8px;';
        signupCard.parentNode.appendChild(growthBadge);
      }
      var g = d.signupGrowthPct;
      var l7 = d.last7Signups || 0;
      if (g !== null && g !== undefined) {
        var up = g >= 0;
        growthBadge.textContent = (up ? '+' : '') + g + '% vs prev 7d · ' + l7 + ' signups';
        growthBadge.style.background = up ? 'var(--green-dim)' : 'var(--red-dim)';
        growthBadge.style.color = up ? 'var(--green)' : 'var(--red)';
      }
    }

    // City rows — title-case + hyphen removal
    if (d.topCities && d.topCities.length) {
      var cityRows   = document.querySelectorAll('.city-row');
      var totalFans  = d.topCities.reduce(function(s,c){return s+c.count;}, 0) || 1;
      d.topCities.slice(0, cityRows.length).forEach(function(city, i) {
        var row = cityRows[i];
        if (!row) return;
        var pct   = Math.round((city.count / totalFans) * 100);
        var nm    = row.querySelector('.city-nm');
        var cnt   = row.querySelector('.city-cnt');
        var pctEl = row.querySelector('.city-pct');
        var fill  = row.querySelector('.bar-fill');
        if (nm)    nm.textContent    = cityName(city.city);
        if (cnt)   cnt.textContent   = city.count.toLocaleString();
        if (pctEl) pctEl.textContent = pct + '%';
        if (fill)  fill.style.width  = Math.max(4, pct) + '%';
      });
    }

    // Top nations — deduplicated, uppercased
    if (mergedNations.length) {
      var nationCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Top Nations'); });
      if (nationCard) {
        var card = nationCard.closest('.card');
        var existing = card.querySelectorAll('.nation-row-live');
        existing.forEach(function(el) { el.remove(); });
        var total = mergedNations.reduce(function(s,n){return s+n.count;}, 0) || 1;
        mergedNations.slice(0,8).forEach(function(n) {
          var pct = Math.round((n.count / total) * 100);
          var row = document.createElement('div');
          row.className = 'nation-row-live';
          row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;';
          row.innerHTML = '<span style="width:80px;font-weight:600;">' + fmtNation(n.nation) + '</span>'
            + '<div style="flex:1;height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
            + '<div style="width:' + pct + '%;height:100%;background:var(--green);border-radius:2px;"></div></div>'
            + '<span style="font-family:monospace;font-size:11px;color:var(--faint);">' + n.count.toLocaleString() + '</span>';
          card.appendChild(row);
        });
      }
    }

    // ── New data sections (inject once) ─────────────────────────────────────────
    if (!document.getElementById('fp-live-insights')) {
      var insBlock = document.createElement('div');
      insBlock.id = 'fp-live-insights';

      // Free vs Premium bar
      var total = d.totalUsers || 1;
      var premPct = Math.round(((d.premiumUsers||0) / total) * 100);
      var freePct = 100 - premPct;
      var nationPct = Math.round(((d.nationVerifiedUsers||0) / total) * 100);

      // Top MyPath teams rows
      var teamsHtml = (d.topMyPathTeams||[]).slice(0,8).map(function(t, i) {
        var teamMax = (d.topMyPathTeams[0]||{}).count || 1;
        var pct = Math.round((t.count / teamMax) * 100);
        var colors = ['var(--green)','var(--blue)','var(--amber)','var(--purple)','var(--red)','var(--green)','var(--blue)','var(--amber)'];
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:7px;font-size:12px;">'
          + '<span style="font-size:10px;color:var(--faint);width:14px;text-align:right;">' + (i+1) + '</span>'
          + '<span style="flex:1;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">' + titleCase(t.team) + '</span>'
          + '<div style="width:80px;height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
          + '<div style="width:' + pct + '%;height:100%;background:' + colors[i] + ';border-radius:2px;"></div></div>'
          + '<span style="font-family:monospace;font-size:11px;color:var(--faint);width:28px;text-align:right;">' + t.count + '</span>'
          + '</div>';
      }).join('');

      // Events by type pills
      var typeColors = {
        'watch-party': 'var(--green)', 'rally': 'var(--blue)', 'meetup': 'var(--amber)',
        'carpool': 'var(--purple)', 'tailgate': 'var(--red)'
      };
      var typeHtml = (d.eventsByType||[]).map(function(t) {
        var col = typeColors[t.type] || 'var(--faint)';
        return '<div class="mini"><span class="mini-lbl" style="text-transform:capitalize;">' + t.type.replace(/-/g,' ') + '</span>'
          + '<span class="mini-val" style="color:' + col + '">' + t.count + '</span></div>';
      }).join('');

      // Events by city
      var evCityMax = ((d.eventsByCity||[])[0]||{}).count || 1;
      var evCityHtml = (d.eventsByCity||[]).slice(0,6).map(function(c) {
        var pct = Math.round((c.count / evCityMax) * 100);
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;">'
          + '<span style="flex:1;font-weight:500;">' + cityName(c.city) + '</span>'
          + '<div style="width:80px;height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
          + '<div style="width:' + pct + '%;height:100%;background:var(--blue);border-radius:2px;"></div></div>'
          + '<span style="font-family:monospace;font-size:11px;color:var(--faint);width:24px;text-align:right;">' + c.count + '</span>'
          + '</div>';
      }).join('');

      // DAU sparkline (dauLast14d)
      var dau14 = (d.ga4 && d.ga4.dauLast14d) ? d.ga4.dauLast14d : [];
      var dauMax = Math.max.apply(null, dau14.map(function(x){return x.users;})) || 1;
      var dauHtml = dau14.length
        ? '<div style="display:flex;align-items:flex-end;gap:3px;height:48px;margin-top:8px;">'
          + dau14.map(function(x) {
              var h = Math.max(4, Math.round((x.users / dauMax) * 100));
              return '<div title="' + x.date + ': ' + x.users + ' users" style="flex:1;background:var(--green);border-radius:2px 2px 0 0;height:' + h + '%;opacity:0.8;"></div>';
            }).join('')
          + '</div>'
          + '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--faint);margin-top:3px;">'
          + '<span>' + (dau14[0]||{}).date + '</span><span>' + (dau14[dau14.length-1]||{}).date + '</span></div>'
        : '<div style="color:var(--faint);font-size:12px;padding:12px 0;">No GA4 data</div>';

      insBlock.innerHTML =
        '<div class="section-hdr">PLATFORM INTELLIGENCE · LIVE</div>' +
        '<div class="g3" style="margin-bottom:14px;">' +

          // Card 1: Fan Split
          '<div class="card"><div class="card-head"><span class="card-title">Fan Base Breakdown</span></div>' +
          '<div class="mini"><span class="mini-lbl">Total Fans</span><span class="mini-val" style="color:var(--green)">' + Number(d.totalUsers||0).toLocaleString() + '</span></div>' +
          '<div class="mini"><span class="mini-lbl">Free Members</span><span class="mini-val">' + Number(d.freeUsers||0).toLocaleString() + '</span></div>' +
          '<div class="mini"><span class="mini-lbl">Premium Members</span><span class="mini-val" style="color:var(--amber)">' + Number(d.premiumUsers||0).toLocaleString() + '</span></div>' +
          '<div class="mini"><span class="mini-lbl">Nation Verified</span><span class="mini-val" style="color:var(--blue)">' + Number(d.nationVerifiedUsers||0).toLocaleString() + '</span></div>' +
          '<div style="margin-top:12px;">' +
            '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:6px;">PREMIUM SPLIT</div>' +
            '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;">' +
              '<div style="width:' + premPct + '%;background:var(--amber);border-radius:4px 0 0 4px;" title="' + premPct + '% Premium"></div>' +
              '<div style="width:' + freePct + '%;background:rgba(0,0,0,0.08);border-radius:0 4px 4px 0;" title="' + freePct + '% Free"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--faint);margin-top:4px;">' +
              '<span>Premium ' + premPct + '%</span><span>Free ' + freePct + '%</span>' +
            '</div>' +
            '<div style="margin-top:8px;">' +
            '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:4px;">NATION VERIFIED</div>' +
            '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;">' +
              '<div style="width:' + nationPct + '%;background:var(--blue);border-radius:4px 0 0 4px;" title="' + nationPct + '% Verified"></div>' +
              '<div style="width:' + (100-nationPct) + '%;background:rgba(0,0,0,0.08);border-radius:0 4px 4px 0;"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--faint);margin-top:4px;">' +
              '<span>Verified ' + nationPct + '%</span><span>Unverified ' + (100-nationPct) + '%</span>' +
            '</div>' +
            '</div>' +
          '</div></div>' +

          // Card 2: MyPath top teams
          '<div class="card"><div class="card-head"><span class="card-title">MyPath · Top Teams</span><span style="font-size:10px;color:var(--faint);">by plan count</span></div>' +
          (teamsHtml || '<div style="color:var(--faint);font-size:12px;padding:12px 0;">No data yet</div>') +
          '</div>' +

          // Card 3: DAU chart
          '<div class="card"><div class="card-head"><span class="card-title">Daily Active Users · 14d</span><span style="font-size:10px;color:var(--faint);">GA4</span></div>' +
          dauHtml +
          (d.ga4 && d.ga4.available ? '<div class="mini" style="margin-top:10px;"><span class="mini-lbl">Peak DAU</span><span class="mini-val" style="color:var(--green)">' + dauMax + '</span></div>' : '') +
          '</div>' +

        '</div>' +
        '<div class="g2" style="margin-bottom:14px;">' +

          // Card 4: Events by type + city
          '<div class="card"><div class="card-head"><span class="card-title">Events Breakdown</span><span style="font-size:10px;color:var(--faint);">' + Number(d.totalEvents||0) + ' total</span></div>' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:6px;">BY TYPE</div>' +
          (typeHtml || '<div style="color:var(--faint);font-size:12px;">No events yet</div>') +
          '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin:12px 0 6px;">BY CITY</div>' +
          (evCityHtml || '<div style="color:var(--faint);font-size:12px;">No events yet</div>') +
          '</div>' +

          // Card 5: Event RSVPs by city
          '<div class="card"><div class="card-head"><span class="card-title">Fan Demand · RSVPs by City</span></div>' +
          (function() {
            var rsvps = d.eventRsvpsByCity || [];
            var rsvpMax = (rsvps[0]||{}).rsvps || 1;
            if (!rsvps.length) return '<div style="color:var(--faint);font-size:12px;padding:12px 0;">No RSVP data yet</div>';
            return rsvps.slice(0,8).map(function(r) {
              var pct = Math.round((r.rsvps / rsvpMax) * 100);
              return '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;">'
                + '<div style="flex:1;">'
                + '<div style="font-weight:600;margin-bottom:3px;">' + cityName(r.city) + '</div>'
                + '<div style="height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
                + '<div style="width:' + pct + '%;height:100%;background:var(--green);border-radius:2px;"></div></div>'
                + '</div>'
                + '<span style="font-family:monospace;font-size:11px;color:var(--faint);font-weight:600;">' + Number(r.rsvps).toLocaleString() + '</span>'
                + '</div>';
            }).join('');
          })() +
          '</div>' +

        '</div>';

      // Insert before GA4 events section (or before sentiment)
      var sentinelEl = document.querySelector('.section-hdr');
      var afterKpis = document.querySelector('.g3.anim');
      if (afterKpis && afterKpis.nextSibling) {
        afterKpis.parentNode.insertBefore(insBlock, afterKpis.nextSibling);
      } else {
        document.querySelector('footer').parentNode.insertBefore(insBlock, document.querySelector('footer'));
      }
    }

    // GA4 custom events block
    var ga = d.ga4;
    if (ga && ga.available && ga.customEvents) {
      var ce = ga.customEvents;
      if (!document.getElementById('fp-ga4-events-section')) {
        var evBlock = document.createElement('div');
        evBlock.id = 'fp-ga4-events-section';

        function evRow(label, val) {
          return '<div class="mini"><span class="mini-lbl">' + label + '</span>'
            + '<span class="mini-val">' + Number(val||0).toLocaleString() + '</span></div>';
        }
        function evCard(title, rows) {
          return '<div class="card"><div class="card-head"><span class="card-title">' + title + '</span>'
            + '<span style="font-size:10px;color:var(--faint);">28 days</span></div>'
            + rows.join('') + '</div>';
        }

        evBlock.innerHTML =
          '<div class="section-hdr">APP EVENT ANALYTICS · 28-DAY</div>' +

          // Row 1: Auth · Events · Housing
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Auth & Identity', [
              evRow('Sign-ups', ce.signed_up),
              evRow('Logins', ce.logged_in),
              evRow('OTP Verified', ce.otp_verified),
              evRow('Password Reset', ce.password_reset),
              evRow('Logout', ce.logout),
              evRow('Profile Completed', ce.profile_completed),
              evRow('Joined Nation', ce.joined_nation),
              evRow('Switched Nation', ce.switched_nation),
            ]) +
            evCard('Events & Meetups', [
              evRow('List Viewed', ce.event_list_viewed),
              evRow('Event Opened', ce.event_opened),
              evRow("RSVP'd", ce.event_rsvp),
              evRow('Event Created', ce.event_created),
              evRow('Event Edited', ce.event_edited),
              evRow('Event Deleted', ce.event_deleted),
              evRow('Not Attended', ce.event_not_attended),
              evRow('Left Event', ce.event_left),
            ]) +
            evCard('Housing', [
              evRow('List Viewed', ce.housing_list_viewed),
              evRow('Listing Opened', ce.housing_opened),
              evRow('Post Created', ce.housing_post_created),
              evRow('Contact Clicked', ce.housing_contact_clicked),
              evRow('Saved', ce.housing_saved),
              evRow('Post Edited', ce.housing_post_edited),
              evRow('Post Deleted', ce.housing_post_deleted),
              evRow('Marked Booked', ce.housing_marked_booked),
            ]) +
          '</div>' +

          // Row 2: Tickets · My Path · Monetization
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Tickets', [
              evRow('Board Viewed', ce.ticket_board_viewed),
              evRow('Ticket Opened', ce.ticket_opened),
              evRow('Post Created', ce.ticket_post_created),
              evRow('Contact Clicked', ce.ticket_contact_clicked),
              evRow('Post Edited', ce.ticket_post_edited),
              evRow('Post Deleted', ce.ticket_post_deleted),
              evRow('Transaction Submitted', ce.transaction_amount_submitted),
            ]) +
            evCard('My Path', [
              evRow('Started', ce.my_path_started),
              evRow('Generated', ce.my_path_generated),
              evRow('Saved', ce.my_path_saved),
              evRow('Team Selected', ce.my_path_team_selected),
              evRow('Airport Selected', ce.my_path_airport_selected),
              evRow('Group Size Set', ce.my_path_group_size_selected),
              evRow('Housing Clicked', ce.my_path_housing_clicked),
              evRow('Tickets Clicked', ce.my_path_tickets_clicked),
              evRow('Events Clicked', ce.my_path_events_clicked),
              evRow('Listing Opened', ce.my_path_listing_opened),
              evRow('Multi-City Plan', ce.multi_city_plan_created),
              evRow('Trip Intent Set', ce.trip_intent_set),
            ]) +
            evCard('Monetization', [
              evRow('Paywall Viewed', ce.paywall_viewed),
              evRow('Purchase Started', ce.purchase_started),
              evRow('Purchase Completed', ce.purchase_completed),
              evRow('Purchase Cancelled', ce.purchase_cancelled),
              evRow('Premium Feature Used', ce.subscription_unlocked_feature_used),
              evRow('Referral Shared', ce.referral_link_shared),
              evRow('Referral Reward', ce.referral_reward_earned),
            ]) +
          '</div>' +

          // Row 3: Social · Squads · Chat
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Social Graph', [
              evRow('Profile Viewed', ce.profile_viewed),
              evRow('Friend Added', ce.friend_added),
              evRow('Friend Rejected', ce.friend_rejected),
              evRow('Friend Removed', ce.friend_removed),
              evRow('Friend Blocked', ce.friend_blocked),
              evRow('Badge Thrown', ce.badge_thrown),
              evRow('Review Submitted', ce.review_submitted),
              evRow('Review Dismissed', ce.review_dismissed),
            ]) +
            evCard('Squads', [
              evRow('Builder Opened', ce.squad_builder_opened),
              evRow('Create Started', ce.squad_create_started),
              evRow('Squad Created', ce.squad_created),
              evRow('Invite Accepted', ce.squad_invite_accepted),
              evRow('Invite Declined', ce.squad_invite_declined),
              evRow('Squad Confirmed', ce.squad_confirmed),
              evRow('Squad Left', ce.squad_left),
              evRow('Message Sent', ce.squad_message_sent),
            ]) +
            evCard('Chat & Messaging', [
              evRow('Chat Opened', ce.chat_opened),
              evRow('Message Sent', ce.message_sent),
              evRow('DM Started', ce.dm_started),
              evRow('DM Interest Sent', ce.dm_interest_sent),
              evRow('P2P Mode Started', ce.p2p_mode_started),
              evRow('Filter Applied', ce.listing_filter_applied),
              evRow('App Install Tapped', ce.app_install_tapped),
              evRow('Push Enabled', ce.push_notification_enabled),
            ]) +
          '</div>' +

          // Row 4: Simulator · Intel · Community
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Simulator & Draw', [
              evRow('Simulator Opened', ce.simulator_opened),
              evRow('Bracket Started', ce.bracket_started),
              evRow('Bracket Saved', ce.bracket_saved),
              evRow('Bracket Shared', ce.bracket_shared),
              evRow('Draw Opened', ce.draw_opened),
              evRow('Draw Randomized', ce.draw_randomized),
              evRow('Advanced Pot', ce.draw_advanced_pot),
            ]) +
            evCard('Intel Feed', [
              evRow('Feed Viewed', ce.intel_feed_viewed),
              evRow('Post Opened', ce.intel_post_opened),
              evRow('Post Engaged', ce.intel_post_engaged),
              evRow('Reacted', ce.intel_reacted),
              evRow('Commented', ce.intel_commented),
              evRow('Reposted', ce.intel_reposted),
            ]) +
            evCard('Community Feed', [
              evRow('Post Reacted', ce.post_reacted),
              evRow('Post Commented', ce.post_commented),
              evRow('Comment Replied', ce.post_comment_replied),
              evRow('Post Reposted', ce.post_reposted),
              evRow('Post Saved', ce.post_saved),
              evRow('Post Reported', ce.post_reported),
              evRow('Post Deleted', ce.post_deleted),
              evRow('Link Copied', ce.post_copied_link),
              evRow('Notif Toggled', ce.post_notification_toggled),
            ]) +
          '</div>';

        // Insert before the sentiment section
        var sentimentHdrEv = Array.from(document.querySelectorAll('.section-hdr'))
          .find(function(el) { return el.textContent.includes('SENTIMENT'); });
        if (sentimentHdrEv) {
          sentimentHdrEv.parentNode.insertBefore(evBlock, sentimentHdrEv);
        } else {
          var footer = document.querySelector('footer');
          if (footer) footer.parentNode.insertBefore(evBlock, footer);
        }
      }
    }

    // GA4 block
    if (ga && ga.available) {
      // Engagement ring
      var ringVal = document.querySelector('.ring-val');
      if (ringVal) ringVal.textContent = ga.engagementRate.toFixed(1) + '%';
      var ringCircle = document.querySelector('.ring svg circle:nth-child(2)');
      if (ringCircle) {
        var circ = 2 * Math.PI * 48;
        ringCircle.setAttribute('stroke-dashoffset', (circ * (1 - ga.engagementRate / 100)).toFixed(1));
      }

      // Inject GA4 section (only once)
      if (!document.getElementById('fp-ga4-section')) {
        var sentimentHdr = Array.from(document.querySelectorAll('.section-hdr'))
          .find(function(el) { return el.textContent.includes('SENTIMENT'); });
        if (sentimentHdr) {
          var block = document.createElement('div');
          block.id = 'fp-ga4-section';
          var devTotal = ga.deviceBreakdown.reduce(function(s,x){return s+x.sessions;},0)||1;
          var countryMax = (ga.topCountries[0]||{}).users || 1;
          block.innerHTML =
            '<div class="section-hdr">GOOGLE ANALYTICS 4 · LIVE</div>' +
            '<div class="g3" style="margin-bottom:14px;">' +
              '<div class="card"><div class="card-head"><span class="card-title">28-Day Overview</span>'
              + '<span class="card-act" style="color:var(--green);font-size:10px;">● LIVE</span></div>'
              + '<div class="mini"><span class="mini-lbl">Active Users</span><span class="mini-val" style="color:var(--green)">' + Number(ga.activeUsers28d).toLocaleString() + '</span></div>'
              + '<div class="mini"><span class="mini-lbl">New Users</span><span class="mini-val">' + Number(ga.newUsers28d).toLocaleString() + '</span></div>'
              + '<div class="mini"><span class="mini-lbl">Sessions</span><span class="mini-val">' + Number(ga.sessions28d).toLocaleString() + '</span></div>'
              + '<div class="mini"><span class="mini-lbl">Avg Session</span><span class="mini-val">' + Math.floor(ga.avgSessionDurationSecs/60) + 'm ' + Math.round(ga.avgSessionDurationSecs%60) + 's</span></div>'
              + '<div class="mini"><span class="mini-lbl">Bounce Rate</span><span class="mini-val" style="color:var(--amber)">' + ga.bounceRate.toFixed(1) + '%</span></div>'
              + '<div class="mini"><span class="mini-lbl">Engagement Rate</span><span class="mini-val" style="color:var(--green)">' + ga.engagementRate.toFixed(1) + '%</span></div>'
              + '</div>'
              + '<div class="card"><div class="card-head"><span class="card-title">7-Day Snapshot</span></div>'
              + '<div class="mini"><span class="mini-lbl">Active Users</span><span class="mini-val" style="color:var(--blue)">' + Number(ga.activeUsers7d).toLocaleString() + '</span></div>'
              + '<div class="mini"><span class="mini-lbl">New Users</span><span class="mini-val">' + Number(ga.newUsers7d).toLocaleString() + '</span></div>'
              + '<div class="mini"><span class="mini-lbl">Sessions</span><span class="mini-val">' + Number(ga.sessions7d).toLocaleString() + '</span></div>'
              + '<div class="mini"><span class="mini-lbl">Active Today</span><span class="mini-val" style="color:var(--green)">' + Number(ga.activeUsersToday).toLocaleString() + '</span></div>'
              + '<div style="margin-top:14px;"><div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:8px;">DEVICE BREAKDOWN</div>'
              + ga.deviceBreakdown.map(function(dev) {
                  return '<div class="mini"><span class="mini-lbl" style="text-transform:capitalize;">' + dev.device + '</span>'
                  + '<span class="mini-val">' + Math.round((dev.sessions/devTotal)*100) + '%</span></div>';
                }).join('')
              + '</div></div>'
              + '<div class="card"><div class="card-head"><span class="card-title">Top Countries (GA4)</span></div>'
              + ga.topCountries.slice(0,6).map(function(c) {
                  var pct = Math.round((c.users/countryMax)*100);
                  return '<div class="city-row" style="margin-bottom:8px;">'
                    + '<div class="city-info"><div class="city-nm">' + c.country + '</div></div>'
                    + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>'
                    + '<div class="city-cnt">' + Number(c.users).toLocaleString() + '</div></div>';
                }).join('')
              + '<div style="margin-top:14px;"><div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:8px;">TOP PAGES</div>'
              + ga.topPages.map(function(p) {
                  var pg = p.page.length > 28 ? p.page.slice(0,28)+'…' : p.page;
                  return '<div class="mini"><span class="mini-lbl" style="font-family:monospace;font-size:10px;">' + pg + '</span>'
                  + '<span class="mini-val">' + Number(p.views).toLocaleString() + '</span></div>';
                }).join('')
              + '</div></div></div>';
          sentimentHdr.parentNode.insertBefore(block, sentimentHdr);
        }
      }
    }

    // Footer timestamp
    var footer = document.querySelector('footer');
    if (footer) {
      var existing = document.getElementById('fp-ts');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'fp-ts';
        existing.style.cssText = 'font-size:10px;margin-top:6px;opacity:0.5;';
        footer.appendChild(existing);
      }
      existing.textContent = 'Live data: ' + new Date(d.capturedAt || Date.now()).toLocaleString()
        + (ga && ga.available ? ' · GA4 ✓' : ' · GA4 not configured')
        + ' · Window: ' + currentWindow;
    }
  }

  // ── Loading indicator ────────────────────────────────────────────────────────
  function setLoading(on) {
    var kpiVals = document.querySelectorAll('.kpi-val');
    kpiVals.forEach(function(v) { v.style.opacity = on ? '0.4' : '1'; });
  }

  // ── Fetch + render ───────────────────────────────────────────────────────────
  function loadData(win) {
    win = win || currentWindow;
    setLoading(true);
    fetch('/api/stats?key=' + encodeURIComponent(KEY) + '&window=' + win)
      .then(function(r) { return r.json(); })
      .then(function(d) { setLoading(false); render(d); })
      .catch(function(e) {
        setLoading(false);
        showToast('Data fetch failed: ' + e.message);
        console.error('[Federation]', e);
      });
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  loadData(currentWindow);

  // Auto-refresh every 5 minutes
  setInterval(function() { loadData(currentWindow); }, 5 * 60 * 1000);

})();
</script>`;

  // Use a function to avoid $' and $& special replacement patterns in liveScript
  html = html.replace("</body>", () => liveScript + "\n</body>");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

export default router;
