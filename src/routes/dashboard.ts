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
      var nations = _lastData && _lastData.topNations ? _lastData.topNations.slice(0,10) : [];
      var header = '<div style="padding:6px 14px 8px;color:#aaa;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid #f0f0f0;margin-bottom:4px;">TOP NATIONS</div>';
      var rows = nations.length
        ? nations.map(function(n) {
            return '<div style="padding:7px 14px;cursor:default;display:flex;justify-content:space-between;align-items:center;">'
              + '<span style="font-weight:500;">' + n.nation + '</span>'
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

  // ── Render data ──────────────────────────────────────────────────────────────
  function render(d) {
    _lastData = d;

    // KPIs
    document.querySelectorAll('.kpi').forEach(function(kpi) {
      var lbl  = (kpi.querySelector('.kpi-lbl')||{}).textContent||'';
      var val  = kpi.querySelector('.kpi-val');
      var delt = kpi.querySelector('.kpi-delta');
      if (!val) return;
      lbl = lbl.trim();
      if (lbl === 'Verified Fans') {
        val.textContent = Number(d.totalUsers||0).toLocaleString();
        if (delt) delt.textContent = '↑ Live from Fanpath';
      } else if (lbl === 'Premium Members') {
        val.textContent = Number(d.premiumUsers||0).toLocaleString();
        if (delt) delt.textContent = '↑ ' + (d.premiumConversionRate||0) + '% conv. rate';
      } else if (lbl === 'Housing Matches') {
        val.textContent = Number(d.activeHousingListings||0).toLocaleString();
        if (delt) delt.textContent = 'Avg $' + (d.avgPricePerNight||0) + '/night';
      }
    });

    // Housing Intel mini card
    document.querySelectorAll('.mini').forEach(function(mini) {
      var lbl = (mini.querySelector('.mini-lbl')||{}).textContent||'';
      var val = mini.querySelector('.mini-val');
      if (!val) return;
      lbl = lbl.trim();
      if (lbl === 'Active Listings') {
        val.textContent = Number(d.activeHousingListings||0).toLocaleString();
      } else if (lbl === 'Avg. Price / Night') {
        val.textContent = '$' + Number(d.avgPricePerNight||0).toLocaleString();
      }
    });

    // Signup bars
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

    // City rows
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
        if (nm)    nm.textContent    = city.city;
        if (cnt)   cnt.textContent   = city.count.toLocaleString();
        if (pctEl) pctEl.textContent = pct + '%';
        if (fill)  fill.style.width  = Math.max(4, pct) + '%';
      });
    }

    // Top nations pills
    if (d.topNations && d.topNations.length) {
      var nationCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Top Nations'); });
      if (nationCard) {
        var card = nationCard.closest('.card');
        var existing = card.querySelectorAll('.nation-row-live');
        existing.forEach(function(el) { el.remove(); });
        var total = d.topNations.reduce(function(s,n){return s+n.count;}, 0) || 1;
        d.topNations.slice(0,8).forEach(function(n) {
          var pct = Math.round((n.count / total) * 100);
          var row = document.createElement('div');
          row.className = 'nation-row-live';
          row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;';
          row.innerHTML = '<span style="width:80px;font-weight:600;">' + n.nation + '</span>'
            + '<div style="flex:1;height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
            + '<div style="width:' + pct + '%;height:100%;background:var(--green);border-radius:2px;"></div></div>'
            + '<span style="font-family:monospace;font-size:11px;color:var(--faint);">' + n.count.toLocaleString() + '</span>';
          card.appendChild(row);
        });
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
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Identity & Onboarding', [
              evRow('Sign-ups', ce.signed_up),
              evRow('Logins', ce.logged_in),
              evRow('Profile Completed', ce.profile_completed),
              evRow('Joined Nation', ce.joined_nation),
              evRow('Switched Nation', ce.switched_nation),
            ]) +
            evCard('Events & Meetups', [
              evRow('Event List Viewed', ce.event_list_viewed),
              evRow('Event Opened', ce.event_opened),
              evRow("RSVP'd", ce.event_rsvp),
              evRow('Event Created', ce.event_created),
            ]) +
            evCard('Housing', [
              evRow('List Viewed', ce.housing_list_viewed),
              evRow('Listing Opened', ce.housing_opened),
              evRow('Post Created', ce.housing_post_created),
              evRow('Contact Clicked', ce.housing_contact_clicked),
              evRow('Saved', ce.housing_saved),
            ]) +
          '</div>' +
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Tickets', [
              evRow('Board Viewed', ce.ticket_board_viewed),
              evRow('Ticket Opened', ce.ticket_opened),
              evRow('Post Created', ce.ticket_post_created),
              evRow('Contact Clicked', ce.ticket_contact_clicked),
            ]) +
            evCard('My Path & Monetization', [
              evRow('My Path Started', ce.my_path_started),
              evRow('Path Generated', ce.my_path_generated),
              evRow('Path Saved', ce.my_path_saved),
              evRow('Paywall Viewed', ce.paywall_viewed),
              evRow('Purchase Started', ce.purchase_started),
              evRow('Purchase Completed', ce.purchase_completed),
            ]) +
            evCard('Social & Squads', [
              evRow('Chat Opened', ce.chat_opened),
              evRow('Message Sent', ce.message_sent),
              evRow('DM Started', ce.dm_started),
              evRow('Friend Added', ce.friend_added),
              evRow('Profile Viewed', ce.profile_viewed),
              evRow('Squad Created', ce.squad_created),
              evRow('Invite Accepted', ce.squad_invite_accepted),
              evRow('Squad Confirmed', ce.squad_confirmed),
            ]) +
          '</div>' +
          '<div class="g3" style="margin-bottom:14px;">' +
            evCard('Simulator & Brackets', [
              evRow('Simulator Opened', ce.simulator_opened),
              evRow('Bracket Started', ce.bracket_started),
              evRow('Bracket Saved', ce.bracket_saved),
            ]) +
            evCard('Intel & Community Feed', [
              evRow('Intel Feed Viewed', ce.intel_feed_viewed),
              evRow('Intel Post Opened', ce.intel_post_opened),
              evRow('Post Reacted', ce.post_reacted),
              evRow('Post Commented', ce.post_commented),
              evRow('Post Reposted', ce.post_reposted),
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
