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
  var currentNation = 'arg'; // default — overridden by dropdown selection

  // ── Sidebar nav — index-based mapping (matches sidebar order exactly) ────────
  // Items must be in the EXACT same order as .sidebar-item elements in the HTML.
  // scope: 'card' = search .card-title, 'section' = search .section-hdr
  var SIDEBAR_MAP = [
    // OVERVIEW (0–4)
    {s: null,                             t: 'top'},                                          // 0  Dashboard
    {s: 'Top Nations on Platform',        t: 'card'},                                         // 1  Top Nations
    {s: 'Daily Fan Signups',              t: 'card'},                                         // 2  Fan Signups
    {s: 'Fan Demographics',               t: 'card'},                                         // 3  Fan Demographics
    {s: 'Fans by Host City',              t: 'card'},                                         // 4  City Intelligence
    // ANALYTICS (5–7)
    {s: 'PLATFORM INTELLIGENCE',          t: 'section'},                                      // 5  Platform Analytics
    {s: 'APP EVENT ANALYTICS',            t: 'section'},                                      // 6  App Events
    {s: 'GOOGLE ANALYTICS 4',             t: 'section'},                                      // 7  GA4 Overview
    // ENGAGEMENT (8–11)
    {s: 'Trending in',                    t: 'card'},                                         // 8  Community Activity
    {s: 'Official Intel Feed',            t: 'card'},                                         // 9  Intel Feed
    {s: 'Live Intel',                     t: 'card'},                                         // 10 Live Intel
    {s: 'Match Fan Demand',               t: 'card'},                                         // 11 Events & Meetups
    // COORDINATION (12–14)
    {s: 'Housing Intel',                  t: 'card'},                                         // 12 Housing Analytics
    {s: 'Ticket Matching',                t: 'card'},                                         // 13 Ticket Matching
    {s: 'Inter-City Travel',              t: 'card'},                                         // 14 Travel Patterns
    // REVENUE (15–16)
    {s: 'Sponsor Engagement',             t: 'card'},                                         // 15 Sponsor Metrics
    {s: 'Sponsor & Partner ROI',          t: 'card'},                                         // 16 Revenue Reports
    // INTELLIGENCE (17–23)
    {s: 'SAFETY INTELLIGENCE',            t: 'section'},                                      // 17 Safety Layer
    {s: 'FAN SENTIMENT',                  t: 'section'},                                      // 18 Fan Sentiment
    {s: 'PREDICTIVE',                     t: 'section'},                                      // 19 Forward Forecast
    {s: 'FAN CRM',                        t: 'section'},                                      // 20 Fan CRM
    {s: 'BLACK MARKET',                   t: 'section'},                                      // 21 Black Market Intel
    {s: 'Fraud Intelligence',             t: 'card'},                                         // 22 Fraud Intel
    {s: 'ECONOMIC IMPACT',                t: 'section'},                                      // 23 Economic Impact
    // SETTINGS (24–25)
    {s: null,                             t: 'toast', m: 'Configuration panel coming soon'},  // 24 Configuration
    {s: null,                             t: 'toast', m: 'API key: Contact federation@usefanpath.com'}, // 25 API Access
  ];

  function findSection(str, scope) {
    var sel = scope === 'section' ? '.section-hdr' : '.card-title';
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent.trim().includes(str)) return els[i];
    }
    // fallback: search both
    var all = document.querySelectorAll('.section-hdr, .card-title');
    for (var j = 0; j < all.length; j++) {
      if (all[j].textContent.trim().includes(str)) return all[j];
    }
    return null;
  }

  function scrollToEl(el) {
    if (!el) return;
    var navH = 72; // sticky nav height offset
    var top = el.getBoundingClientRect().top + window.pageYOffset - navH;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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

  // ── Sidebar click nav ────────────────────────────────────────────────────────
  var sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(function(item, idx) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', function() {
      sidebarItems.forEach(function(s) { s.classList.remove('active'); });
      item.classList.add('active');

      var entry = SIDEBAR_MAP[idx];
      if (!entry) return;

      if (entry.t === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (entry.t === 'toast') {
        showToast(entry.m);
      } else if (entry.s) {
        var el = findSection(entry.s, entry.t);
        if (el) {
          scrollToEl(el);
        } else {
          showToast('Section not yet loaded');
        }
      }
    });
  });

  // ── Scroll-spy — highlight sidebar item matching current viewport section ───
  function buildSectionAnchors() {
    var anchors = [];
    SIDEBAR_MAP.forEach(function(entry, idx) {
      if (!entry.s || entry.t === 'toast' || entry.t === 'top') return;
      var el = findSection(entry.s, entry.t);
      if (el) anchors.push({ idx: idx, el: el });
    });
    return anchors;
  }
  var _anchors = null;
  var _spyTick = false;
  function onScroll() {
    if (_spyTick) return;
    _spyTick = true;
    requestAnimationFrame(function() {
      _spyTick = false;
      if (!_anchors) _anchors = buildSectionAnchors();
      var navH = 80;
      var scrollY = window.pageYOffset;
      if (scrollY < 120) {
        sidebarItems.forEach(function(s) { s.classList.remove('active'); });
        if (sidebarItems[0]) sidebarItems[0].classList.add('active');
        return;
      }
      var active = null;
      for (var i = _anchors.length - 1; i >= 0; i--) {
        var top = _anchors[i].el.getBoundingClientRect().top + window.pageYOffset - navH;
        if (scrollY >= top - 10) { active = _anchors[i].idx; break; }
      }
      if (active !== null) {
        sidebarItems.forEach(function(s) { s.classList.remove('active'); });
        if (sidebarItems[active]) sidebarItems[active].classList.add('active');
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

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
  // ── Nation selector — updates label + reloads intel filtered by nation ────────
  function updateNationLabel(nation) {
    var sel = document.querySelector('.fed-selector');
    if (!sel) return;
    var info = NATION_MAP[nation];
    var flag = info ? info[0] : '🌍';
    var name = info ? info[1] : nation.toUpperCase();
    sel.textContent = flag + '  ' + name + ' ▾';
  }

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
      dd.style.cssText = 'position:fixed;background:#fff;border:1px solid #e5e5e5;border-radius:12px;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.14);z-index:9999;font-size:13px;font-family:DM Sans,sans-serif;display:flex;flex-direction:column;max-height:420px;overflow:hidden;';

      function buildRows(filter) {
        var lcFilter = filter ? filter.toLowerCase() : '';
        var filtered = WC2026_NATIONS.filter(function(slug) {
          if (!lcFilter) return true;
          var label = fmtNation(slug).toLowerCase();
          return label.includes(lcFilter);
        });
        list.innerHTML = '';
        if (!filtered.length) {
          var empty = document.createElement('div');
          empty.style.cssText = 'padding:14px;color:#aaa;text-align:center;font-size:12px;';
          empty.textContent = 'No nations found';
          list.appendChild(empty);
          return;
        }
        filtered.forEach(function(slug) {
          var isActive = slug === currentNation;
          var row = document.createElement('div');
          row.setAttribute('data-nation-slug', slug);
          row.style.cssText = 'padding:9px 16px;cursor:pointer;display:flex;align-items:center;'
            + (isActive ? 'background:#f5fff8;' : '');
          row.innerHTML = '<span style="font-weight:' + (isActive ? '700' : '500') + ';color:' + (isActive ? '#22c55e' : 'inherit') + ';font-size:13px;">' + fmtNation(slug) + '</span>';
          row.addEventListener('mouseenter', function() { if (!isActive) row.style.background = '#f8f8f8'; });
          row.addEventListener('mouseleave', function() { row.style.background = isActive ? '#f5fff8' : ''; });
          row.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var s = row.getAttribute('data-nation-slug');
            dd.remove();
            if (s && s !== currentNation) {
              currentNation = s;
              updateNationLabel(s);
              loadData(currentWindow);
            }
          });
          list.appendChild(row);
        });
      }

      // Search bar
      var searchWrap = document.createElement('div');
      searchWrap.style.cssText = 'padding:10px 12px 8px;border-bottom:1px solid #f0f0f0;flex-shrink:0;';
      var searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search nation…';
      searchInput.style.cssText = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;font-family:DM Sans,sans-serif;outline:none;color:#1a1a1a;';
      searchInput.addEventListener('click', function(ev) { ev.stopPropagation(); });
      searchInput.addEventListener('input', function() { buildRows(searchInput.value.trim()); });
      searchWrap.appendChild(searchInput);

      // Header label
      var hdr = document.createElement('div');
      hdr.style.cssText = 'padding:6px 16px 6px;color:#aaa;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;flex-shrink:0;';
      hdr.textContent = 'SELECT NATION';

      // Scrollable list
      var list = document.createElement('div');
      list.style.cssText = 'overflow-y:auto;flex:1;padding:4px 0;';

      dd.appendChild(searchWrap);
      dd.appendChild(hdr);
      dd.appendChild(list);
      buildRows('');

      var rect = fedSel.getBoundingClientRect();
      dd.style.top = (rect.bottom + 6) + 'px';
      dd.style.right = (window.innerWidth - rect.right) + 'px';
      document.body.appendChild(dd);

      // Focus search after mount
      setTimeout(function() { searchInput.focus(); }, 10);

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
  var NATION_MAP = {
    'usa': ['🇺🇸', 'United States'], 'arg': ['🇦🇷', 'Argentina'],
    'bra': ['🇧🇷', 'Brazil'],        'can': ['🇨🇦', 'Canada'],
    'mex': ['🇲🇽', 'Mexico'],        'fra': ['🇫🇷', 'France'],
    'eng': ['🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England'],      'esp': ['🇪🇸', 'Spain'],
    'ger': ['🇩🇪', 'Germany'],        'por': ['🇵🇹', 'Portugal'],
    'ned': ['🇳🇱', 'Netherlands'],    'bel': ['🇧🇪', 'Belgium'],
    'jpn': ['🇯🇵', 'Japan'],          'kor': ['🇰🇷', 'South Korea'],
    'aus': ['🇦🇺', 'Australia'],      'mar': ['🇲🇦', 'Morocco'],
    'sen': ['🇸🇳', 'Senegal'],        'nga': ['🇳🇬', 'Nigeria'],
    'col': ['🇨🇴', 'Colombia'],       'uru': ['🇺🇾', 'Uruguay'],
    'ecu': ['🇪🇨', 'Ecuador'],        'ven': ['🇻🇪', 'Venezuela'],
    'cri': ['🇨🇷', 'Costa Rica'],     'pan': ['🇵🇦', 'Panama'],
    'hon': ['🇭🇳', 'Honduras'],       'jam': ['🇯🇲', 'Jamaica'],
    'sco': ['🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Scotland'],      'aut': ['🇦🇹', 'Austria'],
    'che': ['🇨🇭', 'Switzerland'],    'den': ['🇩🇰', 'Denmark'],
    'pol': ['🇵🇱', 'Poland'],         'ukr': ['🇺🇦', 'Ukraine'],
    'cze': ['🇨🇿', 'Czechia'],        'srb': ['🇷🇸', 'Serbia'],
    'cro': ['🇭🇷', 'Croatia'],        'tur': ['🇹🇷', 'Turkey'],
    'hun': ['🇭🇺', 'Hungary'],        'sau': ['🇸🇦', 'Saudi Arabia'],
    'qat': ['🇶🇦', 'Qatar'],          'irn': ['🇮🇷', 'Iran'],
    'egy': ['🇪🇬', 'Egypt'],          'tun': ['🇹🇳', 'Tunisia'],
    'cmr': ['🇨🇲', 'Cameroon'],       'zaf': ['🇿🇦', 'South Africa'],
    'civ': ['🇨🇮', 'Ivory Coast'],    'cod': ['🇨🇩', 'DR Congo'],
    'alg': ['🇩🇿', 'Algeria'],        'mli': ['🇲🇱', 'Mali'],
    'irq': ['🇮🇶', 'Iraq'],           'jor': ['🇯🇴', 'Jordan'],
    'nzl': ['🇳🇿', 'New Zealand'],    'idn': ['🇮🇩', 'Indonesia'],
    // extras kept for user-base matching
    'ita': ['🇮🇹', 'Italy'],          'chi': ['🇨🇱', 'Chile'],
    'per': ['🇵🇪', 'Peru'],           'bol': ['🇧🇴', 'Bolivia'],
    'par': ['🇵🇾', 'Paraguay'],       'gha': ['🇬🇭', 'Ghana'],
    'swe': ['🇸🇪', 'Sweden'],         'nor': ['🇳🇴', 'Norway'],
    'gre': ['🇬🇷', 'Greece'],         'wal': ['🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Wales'],
    'irl': ['🇮🇪', 'Ireland'],        'svk': ['🇸🇰', 'Slovakia'],
    'ind': ['🇮🇳', 'India'],          'chn': ['🇨🇳', 'China'],
    'pak': ['🇵🇰', 'Pakistan'],       'phl': ['🇵🇭', 'Philippines'],
    'tha': ['🇹🇭', 'Thailand'],       'vnm': ['🇻🇳', 'Vietnam'],
    'gbr': ['🇬🇧', 'Great Britain'],
  };

  // All 48 WC2026 qualified nations — shown in full in the nation dropdown
  var WC2026_NATIONS = [
    // Hosts (CONCACAF)
    'usa','mex','can',
    // CONMEBOL
    'arg','bra','col','uru','ecu','ven',
    // CONCACAF (remaining)
    'pan','hon','jam','cri',
    // UEFA
    'ger','esp','fra','eng','por','ned','bel','che','cro','aut','hun','den','sco','srb','cze','tur',
    // CAF
    'mar','sen','egy','nga','civ','zaf','cod','cmr','tun',
    // AFC
    'jpn','kor','irn','sau','aus','qat','jor','irq','idn',
    // OFC
    'nzl',
  ];
  function fmtNation(code) {
    var k = (code||'').toLowerCase();
    var e = NATION_MAP[k];
    if (e) return e[0] + ' ' + e[1];
    return code.toUpperCase();
  }

  // Team slug (full name) → flag emoji, for MyPath Top Teams card
  var TEAM_FLAGS = {
    'argentina':          '🇦🇷',
    'mexico':             '🇲🇽',
    'germany':            '🇩🇪',
    'brazil':             '🇧🇷',
    'usa':                '🇺🇸',
    'united states':      '🇺🇸',
    'portugal':           '🇵🇹',
    'panama':             '🇵🇦',
    'france':             '🇫🇷',
    'spain':              '🇪🇸',
    'england':            '🏴',
    'netherlands':        '🇳🇱',
    'italy':              '🇮🇹',
    'colombia':           '🇨🇴',
    'uruguay':            '🇺🇾',
    'canada':             '🇨🇦',
    'morocco':            '🇲🇦',
    'japan':              '🇯🇵',
    'south korea':        '🇰🇷',
    'korea':              '🇰🇷',
    'australia':          '🇦🇺',
    'senegal':            '🇸🇳',
    'nigeria':            '🇳🇬',
    'ghana':              '🇬🇭',
    'ecuador':            '🇪🇨',
    'chile':              '🇨🇱',
    'costa rica':         '🇨🇷',
    'peru':               '🇵🇪',
    'venezuela':          '🇻🇪',
    'paraguay':           '🇵🇾',
    'bolivia':            '🇧🇴',
    'honduras':           '🇭🇳',
    'el salvador':        '🇸🇻',
    'jamaica':            '🇯🇲',
    'trinidad':           '🇹🇹',
    'trinidad and tobago':'🇹🇹',
    'belgium':            '🇧🇪',
    'croatia':            '🇭🇷',
    'switzerland':        '🇨🇭',
    'denmark':            '🇩🇰',
    'austria':            '🇦🇹',
    'sweden':             '🇸🇪',
    'norway':             '🇳🇴',
    'scotland':           '🏴',
    'wales':              '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'poland':             '🇵🇱',
    'ukraine':            '🇺🇦',
    'serbia':             '🇷🇸',
    'turkey':             '🇹🇷',
    'greece':             '🇬🇷',
    'iran':               '🇮🇷',
    'saudi arabia':       '🇸🇦',
    'iraq':               '🇮🇶',
    'qatar':              '🇶🇦',
    'egypt':              '🇪🇬',
    'cameroon':           '🇨🇲',
    'ivory coast':        '🇨🇮',
    'mali':               '🇲🇱',
    'south africa':       '🇿🇦',
    'new zealand':        '🇳🇿',
    'indonesia':          '🇮🇩',
    'china':              '🇨🇳',
  };
  function teamFlag(slug) {
    return TEAM_FLAGS[(slug||'').toLowerCase()] || '';
  }

  // Page slug → readable label for Top Pages card
  var PAGE_NAMES = {
    '/':             'Home',
    '/the-club':     'The Club',
    '/my-path':      'My Path',
    '/housing':      'Housing',
    '/tickets':      'Tickets',
    '/tournament':   'Tournament',
    '/simulator':    'Simulator',
    '/intel':        'Intel Feed',
    '/community':    'Community',
    '/onboarding':   'Onboarding',
    '/login':        'Login',
    '/signup':       'Sign Up',
    '/settings':     'Settings',
    '/profile':      'Profile',
    '/events':       'Events',
    '/match':        'Match',
    '/draw':         'Draw',
  };
  function pageName(raw) {
    if (!raw) return 'Unknown';
    // Strip query string, remove trailing slash — no regex with \/ (template literal drops backslash)
    var norm = raw.split('?')[0];
    if (norm.length > 1 && norm.charAt(norm.length - 1) === '/') norm = norm.slice(0, -1);
    if (!norm) norm = '/';
    if (PAGE_NAMES[norm]) return PAGE_NAMES[norm];
    var parts = norm.split('/');            // ['', 'profile', 'shubhoum'] or ['', 'the-club']
    // Profile sub-paths are merged server-side into /profile — just in case any slip through
    if (parts[1] === 'profile') return 'Profile';
    var slug = parts[1] || '';
    if (!slug) return 'Home';
    return slug.split('-').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
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
      } else if (lbl === 'Avg Spend / Fan' || kpi.dataset.kpiId === 'events') {
        // Repurpose slot: show total events (mark with data-kpi-id so refresh doesn't re-mutate)
        kpi.dataset.kpiId = 'events';
        lblEl.textContent = 'Total Events';
        val.textContent   = Number(d.totalEvents||0).toLocaleString();
        if (delt) delt.textContent = 'Across all host cities';
      } else if (lbl === 'Sponsor Impressions' || kpi.dataset.kpiId === 'mypath') {
        // Repurpose slot: show MyPath plans (mark with data-kpi-id)
        kpi.dataset.kpiId = 'mypath';
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

    // ── Signup chart — dynamic bar rebuild ──────────────────────────────────────
    var signupCardTitle = Array.from(document.querySelectorAll('.card-title'))
      .find(function(el) { return el.textContent.includes('Daily Fan Signups'); });
    var signups = d.signupsByDay || [];
    if (signupCardTitle && signups.length) {
      var sigCard = signupCardTitle.closest('.card');
      var barsEl  = sigCard ? sigCard.querySelector('.bars') : null;
      if (barsEl) {
        // Fully rebuild — clears placeholder columns and stale data
        Array.from(barsEl.querySelectorAll('.bar-col')).forEach(function(el) { el.remove(); });
        var maxSig = Math.max.apply(null, signups.map(function(s){return s.count;})) || 1;
        var peakSigIdx = signups.reduce(function(best, s, i) {
          return s.count > signups[best].count ? i : best;
        }, 0);
        signups.forEach(function(day, i) {
          var BAR_MAX_PX = 130; // px — bar cols are auto-height, parent aligns to baseline
          var px = Math.max(3, Math.round((day.count / maxSig) * BAR_MAX_PX));
          var col = document.createElement('div');
          col.className = 'bar-col';
          var barDiv = document.createElement('div');
          barDiv.className = 'bar-g';
          barDiv.style.height = px + 'px';
          barDiv.setAttribute('data-count', day.count + ' signups');
          barDiv.title = day.date + ': ' + day.count + ' signups';
          if (i === peakSigIdx && day.count > 0) {
            var pk = document.createElement('div');
            pk.className = 'bar-peak-label';
            pk.textContent = String(day.count);
            barDiv.appendChild(pk);
          }
          var lbl = document.createElement('span');
          lbl.className = 'bar-lbl';
          lbl.textContent = day.label || day.date.slice(8);
          col.appendChild(barDiv);
          col.appendChild(lbl);
          barsEl.appendChild(col);
        });
      }
      // Update window label in signup chart legend
      var winLblEl = document.getElementById('fp-chart-window-lbl');
      var sigWinLabel = currentWindow === '24h' ? 'Last 24h' : currentWindow === '7d' ? 'Last 7 days' : currentWindow === '30d' ? 'Last 30 days' : 'All time';
      if (winLblEl) winLblEl.textContent = sigWinLabel;
    }

    // Signup card: growth badge
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

    // City rows — scoped to "Fans by Host City" card only (avoids polluting GA4 country rows)
    if (d.topCities && d.topCities.length) {
      var cityCardTitle = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Fans by Host City'); });
      var cityRows = cityCardTitle
        ? cityCardTitle.closest('.card').querySelectorAll('.city-row')
        : document.querySelectorAll('.city-row');
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
        // Remove static placeholder .lb-row elements
        card.querySelectorAll('.lb-row').forEach(function(el) { el.remove(); });
        // Remove any previously injected live rows (on refresh)
        card.querySelectorAll('.nation-row-live').forEach(function(el) { el.remove(); });
        var total = mergedNations.reduce(function(s,n){return s+n.count;}, 0) || 1;
        var colors = ['var(--green)','var(--blue)','var(--amber)','var(--purple)','var(--red)','#06b6d4','#f97316','#a855f7'];
        mergedNations.slice(0,8).forEach(function(n, i) {
          var pct = Math.round((n.count / total) * 100);
          var row = document.createElement('div');
          row.className = 'nation-row-live';
          row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:7px;font-size:12px;';
          row.innerHTML = '<span style="font-size:10px;color:var(--faint);width:14px;text-align:right;">' + (i+1) + '</span>'
            + '<span style="flex:1;font-weight:600;letter-spacing:.5px;">' + fmtNation(n.nation) + '</span>'
            + '<div style="width:90px;height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
            + '<div style="width:' + Math.max(4,pct) + '%;height:100%;background:' + colors[i] + ';border-radius:2px;"></div></div>'
            + '<span style="font-family:monospace;font-size:11px;color:var(--faint);width:28px;text-align:right;">' + n.count.toLocaleString() + '</span>';
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
        var flag = teamFlag(t.team);
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:7px;font-size:12px;">'
          + '<span style="font-size:10px;color:var(--faint);width:14px;text-align:right;">' + (i+1) + '</span>'
          + '<span style="font-size:15px;line-height:1;">' + flag + '</span>'
          + '<span style="flex:1;font-weight:600;">' + titleCase(t.team) + '</span>'
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

      // DAU bar chart — slice GA4's 30-day array to match currentWindow
      var dauAll = (d.ga4 && d.ga4.dauLast14d) ? d.ga4.dauLast14d : [];
      var dauSlice = currentWindow === '24h' ? 1 : currentWindow === '7d' ? 7 : currentWindow === '30d' ? 30 : dauAll.length;
      var dau14 = dauAll.slice(-dauSlice);
      var dauWinLabel = currentWindow === '24h' ? '1-day' : currentWindow === '7d' ? '7-day' : currentWindow === '30d' ? '30-day' : 'All-time';
      var dauMax = Math.max.apply(null, dau14.map(function(x){return x.users;})) || 1;
      var dauPeakIdx = dau14.length ? dau14.reduce(function(best, x, i) {
        return x.users > dau14[best].users ? i : best;
      }, 0) : 0;
      var DAY_CHARS = ['S','M','T','W','T','F','S'];
      var dauHtml = dau14.length
        ? '<div class="bars" style="flex:1;height:auto;min-height:120px;margin-top:4px;">'
          + dau14.map(function(x, i) {
              var h = Math.max(3, Math.round((x.users / dauMax) * 130)); // px, not %
              var parts = x.date.split('-');
              var dayLetter = DAY_CHARS[new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2])).getDay()];
              var isPeak = i === dauPeakIdx;
              return '<div class="bar-col">'
                + '<div class="bar-g" style="height:' + h + 'px;" data-count="' + x.users.toLocaleString() + ' users" title="' + x.date + ': ' + x.users + ' users">'
                + (isPeak ? '<div class="bar-peak-label">' + x.users.toLocaleString() + '</div>' : '')
                + '</div>'
                + '<span class="bar-lbl">' + dayLetter + '</span>'
                + '</div>';
            }).join('')
          + '</div>'
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
          '<div class="card" style="display:flex;flex-direction:column;"><div class="card-head"><span class="card-title">Daily Active Users · ' + dauWinLabel + '</span><span style="font-size:10px;color:var(--faint);">GA4</span></div>' +
          dauHtml +
          (d.ga4 && d.ga4.available
            ? '<div class="chart-legend"><div class="leg-item"><div class="leg-dot" style="background:var(--green)"></div>Active Users (GA4)</div>'
              + '<span style="font-size:10px;color:var(--faint);margin-left:auto;">' + dauWinLabel + ' window</span></div>'
            : '') +
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
              evRow('Account Deleted', ce.account_deleted),
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
              evRow('Parse Failed', ce.mypath_breakdown_parse_failed),
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
              evRow('Size Changed', ce.squad_size_changed),
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

        // Insert before SAFETY INTELLIGENCE — i.e. right after the Intel Feed row
        var safetyHdr = Array.from(document.querySelectorAll('.section-hdr'))
          .find(function(el) { return el.textContent.includes('SAFETY'); });
        if (safetyHdr) {
          safetyHdr.parentNode.insertBefore(evBlock, safetyHdr);
        } else {
          var footer = document.querySelector('footer');
          if (footer) footer.parentNode.insertBefore(evBlock, footer);
        }
      }
    }

    // GA4 block
    if (ga && ga.available) {
      // Engagement ring — update arcs + add hover tooltip
      var ringVal = document.querySelector('.ring-val');
      if (ringVal) ringVal.textContent = ga.engagementRate.toFixed(1) + '%';
      var ringCircleOuter = document.querySelector('.ring svg circle:nth-child(2)');
      if (ringCircleOuter) {
        var circ = 2 * Math.PI * 48;
        ringCircleOuter.setAttribute('stroke-dashoffset', (circ * (1 - ga.engagementRate / 100)).toFixed(1));
      }
      // Add hover tooltip to engagement ring card (only once)
      var engCard = document.querySelector('.ring-wrap');
      if (engCard && !engCard.getAttribute('data-tip-set')) {
        engCard.setAttribute('data-tip-set', '1');
        engCard.style.cursor = 'default';
        var engTip = document.createElement('div');
        engTip.style.cssText = 'display:none;position:absolute;background:#1a1a1a;color:#fff;font-size:11px;font-family:DM Sans,sans-serif;padding:8px 12px;border-radius:8px;z-index:999;white-space:nowrap;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.2);line-height:1.6;';
        engCard.style.position = 'relative';
        engCard.appendChild(engTip);
        engCard.addEventListener('mouseenter', function() {
          engTip.innerHTML =
            'Engagement Rate: <b>' + ga.engagementRate.toFixed(1) + '%</b><br>'
            + 'Bounce Rate: <b>' + ga.bounceRate.toFixed(1) + '%</b><br>'
            + 'Avg Session: <b>' + Math.floor(ga.avgSessionDurationSecs/60) + 'm ' + Math.round(ga.avgSessionDurationSecs%60) + 's</b><br>'
            + 'Active Today: <b>' + Number(ga.activeUsersToday).toLocaleString() + '</b>';
          engTip.style.display = 'block';
        });
        engCard.addEventListener('mouseleave', function() { engTip.style.display = 'none'; });
        engCard.addEventListener('mousemove', function(e) {
          var rect = engCard.getBoundingClientRect();
          engTip.style.left = (e.clientX - rect.left + 12) + 'px';
          engTip.style.top  = (e.clientY - rect.top  - 10) + 'px';
        });
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
              + '<div style="margin-top:14px;"><div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:10px;">TOP PAGES</div>'
              + ga.topPages.map(function(p) {
                  var pgMax = (ga.topPages[0]||{}).views || 1;
                  var pct = Math.max(6, Math.round((p.views / pgMax) * 100));
                  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
                    + '<span style="flex:1;font-size:12px;font-weight:500;">' + pageName(p.page) + '</span>'
                    + '<div style="width:60px;height:4px;background:rgba(0,0,0,0.07);border-radius:2px;">'
                    + '<div style="width:' + pct + '%;height:100%;background:var(--blue);border-radius:2px;"></div></div>'
                    + '<span style="font-size:11px;font-weight:600;color:var(--faint);width:36px;text-align:right;">' + Number(p.views).toLocaleString() + '</span>'
                    + '</div>';
                }).join('')
              + '</div></div></div>';
          sentimentHdr.parentNode.insertBefore(block, sentimentHdr);
        }
      }
    }

    // ── Live Intel & Official Intel Feed — replace static content ───────────────
    var intel = d.recentIntel || [];
    if (intel.length) {
      function timeAgo(iso) {
        var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
        if (diff < 1)   return 'just now';
        if (diff < 60)  return diff + 'm ago';
        if (diff < 1440) return Math.floor(diff/60) + 'h ago';
        return Math.floor(diff/1440) + 'd ago';
      }
      function nationTag(id) {
        if (!id) return 'INTL';
        var k = id.toLowerCase();
        var e = NATION_MAP[k];
        return e ? e[0] + ' ' + e[1] : id.toUpperCase();
      }

      // Live Intel compact card (top 4 articles)
      var liveIntelCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.trim() === 'Live Intel'; });
      if (liveIntelCard) {
        var liveCard = liveIntelCard.closest('.card');
        // Remove old static trend-items
        liveCard.querySelectorAll('.trend-item').forEach(function(el) { el.remove(); });
        intel.slice(0,4).forEach(function(art) {
          var item = document.createElement('div');
          item.className = 'trend-item';
          item.style.cssText = 'cursor:pointer;';
          item.innerHTML =
            '<div class="trend-top">'
            + '<span class="tag tag-brk">' + nationTag(art.nationId) + '</span>'
            + '<span class="trend-meta">' + timeAgo(art.publishedAt) + '</span>'
            + '</div>'
            + '<div class="trend-text" style="font-size:12px;line-height:1.4;">' + art.title + '</div>'
            + (art.sourceName ? '<div style="font-size:10px;color:var(--faint);margin-top:3px;">' + art.sourceName + '</div>' : '');
          item.addEventListener('click', function() { window.open(art.url, '_blank'); });
          liveCard.appendChild(item);
        });
      }

      // Official Intel Feed — append into .intel-scroll wrapper so card stays fixed height
      var intelFeedCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.trim() === 'Official Intel Feed'; });
      if (intelFeedCard) {
        var feedCard = intelFeedCard.closest('.card');
        var feedScroll = feedCard.querySelector('.intel-scroll') || feedCard;
        feedScroll.querySelectorAll('.intel-item').forEach(function(el) { el.remove(); });
        intel.slice(0,12).forEach(function(art) {
          var item = document.createElement('div');
          item.className = 'intel-item';
          item.style.cssText = 'cursor:pointer;';
          item.innerHTML =
            '<div class="intel-icon" style="background:var(--blue-dim);font-size:14px;">&#x1F4F0;</div>'
            + '<div class="intel-body">'
            + '<div class="intel-text" style="font-size:12px;line-height:1.4;">' + art.title
            + (art.sourceName ? '<span class="src src-fed" style="margin-left:6px;">' + art.sourceName + '</span>' : '')
            + '</div>'
            + (art.description ? '<div style="font-size:11px;color:var(--muted);margin-top:2px;line-height:1.3;">' + art.description.slice(0,120) + (art.description.length > 120 ? '…' : '') + '</div>' : '')
            + '<div class="intel-meta">' + timeAgo(art.publishedAt) + ' · ' + nationTag(art.nationId) + '</div>'
            + '</div>';
          item.addEventListener('click', function() { window.open(art.url, '_blank'); });
          feedScroll.appendChild(item);
        });
      }

      // Trending in [Nation] Community — populate into .intel-scroll wrapper
      var trendingTitle = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Trending in'); });
      if (trendingTitle) {
        var trendingCard = trendingTitle.closest('.card');
        var trendScroll = trendingCard.querySelector('.intel-scroll') || trendingCard;
        // Update title to reflect current nation
        var nationInfo = NATION_MAP[currentNation];
        var nationLabel = nationInfo ? nationInfo[0] + ' ' + nationInfo[1] : currentNation.toUpperCase();
        trendingTitle.textContent = 'Trending in ' + nationLabel + ' Community';
        // Rebuild items
        trendScroll.querySelectorAll('.trend-item, .fp-no-data').forEach(function(el) { el.remove(); });
        if (intel.length) {
          intel.slice(0, 12).forEach(function(art) {
            var item = document.createElement('div');
            item.className = 'trend-item';
            item.style.cssText = 'cursor:pointer;';
            item.innerHTML =
              '<div class="trend-top">'
              + (art.sourceName ? '<span class="tag tag-brk" style="font-size:9px;padding:2px 5px;">' + art.sourceName.toUpperCase() + '</span>' : '')
              + '<span class="trend-meta">' + timeAgo(art.publishedAt) + '</span>'
              + '</div>'
              + '<div class="trend-text" style="font-size:12px;line-height:1.4;">' + art.title + '</div>';
            item.addEventListener('click', function() { window.open(art.url, '_blank'); });
            trendScroll.appendChild(item);
          });
        } else {
          var noData = document.createElement('div');
          noData.className = 'fp-no-data';
          noData.style.cssText = 'font-size:12px;color:var(--faint);padding:16px 0;text-align:center;';
          noData.textContent = 'No intel available for this nation yet';
          trendScroll.appendChild(noData);
        }
      }
    }

    // ── Clear fake static placeholder content (run once, guard with data attr) ───
    if (!document.body.dataset.fpCleaned) {
      document.body.dataset.fpCleaned = '1';

      // Safety Intelligence — clear fake live feed items + zero counters
      var safetyFeed = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Live Safety Feed'); });
      if (safetyFeed) {
        var sc = safetyFeed.closest('.card');
        sc.querySelectorAll('.intel-item').forEach(function(el) { el.remove(); });
        sc.querySelectorAll('.inc-val, .inc-cell span').forEach(function(el) {
          var firstSpan = el.parentElement && el.parentElement.querySelector('span:first-child');
          if (el.textContent && (!firstSpan || el.textContent !== firstSpan.textContent)) el.textContent = '0';
        });
      }

      // Fraud Intelligence — zero fake authoritative numbers + clear fake items
      var fraudCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Fraud Intelligence'); });
      if (fraudCard) {
        var fc = fraudCard.closest('.card');
        fc.querySelectorAll('.intel-item').forEach(function(el) { el.remove(); });
        fc.querySelectorAll('.mini-val').forEach(function(el) { el.textContent = '0'; });
        var fraudNote = document.createElement('div');
        fraudNote.style.cssText = 'font-size:11px;color:var(--faint);padding:12px 0 4px;text-align:center;';
        fraudNote.textContent = 'No fraud reports in this window';
        fc.appendChild(fraudNote);
      }

      // Sponsor Engagement — replace fake CTR %s with dashes (non-zero fakes are misleading)
      var sponsorCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Sponsor Engagement'); });
      if (sponsorCard) {
        sponsorCard.closest('.card').querySelectorAll('td:last-child').forEach(function(td) {
          if (/\d+\.\d+%/.test(td.textContent)) td.textContent = '—';
        });
      }

      // Housing Intel — mark unavailable mini-vals with dash rather than 0
      var housingCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Housing Intel'); });
      if (housingCard) {
        housingCard.closest('.card').querySelectorAll('.mini').forEach(function(mini) {
          var lbl = (mini.querySelector('.mini-lbl')||{}).textContent||'';
          var val = mini.querySelector('.mini-val');
          if (!val) return;
          var unavail = ['Occupancy Rate','Total Fan Savings','Avg. Roommates','Affiliate Revenue'];
          if (unavail.indexOf(lbl.trim()) !== -1) val.textContent = '—';
        });
      }

      // Ticket Matching — mark unavailable mini-vals with dash
      var ticketCard = Array.from(document.querySelectorAll('.card-title'))
        .find(function(el) { return el.textContent.includes('Ticket Matching'); });
      if (ticketCard) {
        ticketCard.closest('.card').querySelectorAll('.mini').forEach(function(mini) {
          var lbl = (mini.querySelector('.mini-lbl')||{}).textContent||'';
          var val = mini.querySelector('.mini-val');
          if (!val) return;
          var unavail = ['Successful Swaps','Savings vs StubHub','Scam Reports','Verification Rate'];
          if (unavail.indexOf(lbl.trim()) !== -1) val.textContent = '—';
        });
      }

      // Engagement ring inner arc — zero out (was stuck at fake dashoffset=99)
      var ringInner = document.querySelector('.ring svg circle:nth-child(4)');
      if (ringInner) {
        var circInner = 2 * Math.PI * 35;
        ringInner.setAttribute('stroke-dashoffset', circInner.toFixed(1));
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
    fetch('/api/stats?key=' + encodeURIComponent(KEY) + '&window=' + win + '&nation=' + encodeURIComponent(currentNation))
      .then(function(r) { return r.json(); })
      .then(function(d) { setLoading(false); render(d); })
      .catch(function(e) {
        setLoading(false);
        showToast('Data fetch failed: ' + e.message);
        console.error('[Federation]', e);
      });
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  updateNationLabel(currentNation); // NATION_MAP is defined above — safe to call here
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
