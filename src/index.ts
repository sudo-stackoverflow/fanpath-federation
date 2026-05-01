import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { getGA4Stats } from "./ga4.service";

const app  = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);

const FEDERATION_KEY  = process.env.FEDERATION_KEY ?? "";
const FANPATH_API_URL = process.env.FANPATH_API_URL ?? "https://www.usefanpath.com";

const HTML_PATH = path.resolve(__dirname, "../static/federation.html");

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = (req.query.key as string) || req.headers["x-federation-key"];
  if (!FEDERATION_KEY || key !== FEDERATION_KEY) {
    return res.status(401).send("<h1>401 — Invalid or missing federation key</h1>");
  }
  next();
}

// ── /api/stats — combined Fanpath DB + GA4 ───────────────────────────────────
app.get("/api/stats", requireKey, async (_req, res) => {
  try {
    const [dbRes, ga4] = await Promise.all([
      fetch(`${FANPATH_API_URL}/api/federation/stats?key=${encodeURIComponent(FEDERATION_KEY)}`),
      getGA4Stats(),
    ]);

    const db = (dbRes.ok ? await dbRes.json() : {}) as Record<string, unknown>;
    res.json({ ...db, ga4 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── /api/ga4 — GA4 only ───────────────────────────────────────────────────────
app.get("/api/ga4", requireKey, async (_req, res) => {
  try {
    res.json(await getGA4Stats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── / — serve dashboard with live-data script injected ───────────────────────
app.get("/", requireKey, (req, res) => {
  if (!fs.existsSync(HTML_PATH)) {
    return res.status(404).send("<h2>Dashboard HTML not found at " + HTML_PATH + "</h2>");
  }

  let html = fs.readFileSync(HTML_PATH, "utf-8");
  const key = req.query.key as string;

  const liveScript = `
<script>
(async () => {
  try {
    const KEY = ${JSON.stringify(key)};
    const res = await fetch('/api/stats?key=' + encodeURIComponent(KEY));
    if (!res.ok) return;
    const d = await res.json();

    // ── KPI values ────────────────────────────────────────────────────
    document.querySelectorAll('.kpi').forEach(kpi => {
      const lbl  = kpi.querySelector('.kpi-lbl')?.textContent?.trim();
      const val  = kpi.querySelector('.kpi-val');
      const delt = kpi.querySelector('.kpi-delta');
      if (!val) return;
      if (lbl === 'Verified Fans') {
        val.textContent  = Number(d.totalUsers).toLocaleString();
        if (delt) delt.textContent = '↑ Live from Fanpath';
      } else if (lbl === 'Premium Members') {
        val.textContent  = Number(d.premiumUsers).toLocaleString();
        if (delt) delt.textContent = '↑ ' + d.premiumConversionRate + '% conv. rate';
      } else if (lbl === 'Housing Matches') {
        val.textContent  = Number(d.activeHousingListings).toLocaleString();
        if (delt) delt.textContent = 'Avg $' + d.avgPricePerNight + '/night';
      }
    });

    // ── Signup bars (14-day) ──────────────────────────────────────────
    const bars    = document.querySelectorAll('.bar-col');
    const signups = d.signupsByDay || [];
    const maxSig  = Math.max(...signups.map(s => s.count), 1);
    signups.forEach((day, i) => {
      const col = bars[bars.length - signups.length + i];
      if (!col) return;
      const barG = col.querySelector('.bar-g');
      const lbl  = col.querySelector('.bar-lbl');
      if (barG) barG.style.height = Math.max(4, Math.round((day.count / maxSig) * 100)) + '%';
      if (lbl)  lbl.textContent   = day.label;
      col.title = day.date + ': ' + day.count + ' signups';
    });

    // ── City rows ─────────────────────────────────────────────────────
    if (d.topCities?.length) {
      const cityRows  = document.querySelectorAll('.city-row');
      const totalFans = d.topCities.reduce((s, c) => s + c.count, 0) || 1;
      d.topCities.slice(0, cityRows.length).forEach((city, i) => {
        const row  = cityRows[i];
        if (!row) return;
        const pct  = Math.round((city.count / totalFans) * 100);
        const nm   = row.querySelector('.city-nm');
        const cnt  = row.querySelector('.city-cnt');
        const pctEl= row.querySelector('.city-pct');
        const fill = row.querySelector('.bar-fill');
        if (nm)    nm.textContent    = city.city;
        if (cnt)   cnt.textContent   = city.count.toLocaleString();
        if (pctEl) pctEl.textContent = pct + '%';
        if (fill)  fill.style.width  = Math.max(4, pct) + '%';
      });
    }

    // ── GA4 ───────────────────────────────────────────────────────────
    const ga = d.ga4;
    if (ga?.available) {
      // Engagement ring
      const ringVal = document.querySelector('.ring-val');
      if (ringVal) ringVal.textContent = ga.engagementRate.toFixed(1) + '%';
      const ringCircle = document.querySelector('.ring svg circle:nth-child(2)');
      if (ringCircle) {
        const circ   = 2 * Math.PI * 48;
        const offset = circ * (1 - ga.engagementRate / 100);
        ringCircle.setAttribute('stroke-dashoffset', offset.toFixed(1));
      }

      // Inject GA4 block before FAN SENTIMENT section
      const sentimentHdr = Array.from(document.querySelectorAll('.section-hdr'))
        .find(el => el.textContent?.includes('SENTIMENT'));
      if (sentimentHdr) {
        const block = document.createElement('div');
        block.innerHTML = \`
          <div class="section-hdr">GOOGLE ANALYTICS 4 · LIVE</div>
          <div class="g3" style="margin-bottom:14px;">
            <div class="card">
              <div class="card-head">
                <span class="card-title">28-Day Overview</span>
                <span class="card-act" style="color:var(--green);font-size:10px;">● LIVE</span>
              </div>
              <div class="mini"><span class="mini-lbl">Active Users</span><span class="mini-val" style="color:var(--green)">\${Number(ga.activeUsers28d).toLocaleString()}</span></div>
              <div class="mini"><span class="mini-lbl">New Users</span><span class="mini-val">\${Number(ga.newUsers28d).toLocaleString()}</span></div>
              <div class="mini"><span class="mini-lbl">Sessions</span><span class="mini-val">\${Number(ga.sessions28d).toLocaleString()}</span></div>
              <div class="mini"><span class="mini-lbl">Avg Session</span><span class="mini-val">\${Math.floor(ga.avgSessionDurationSecs/60)}m \${Math.round(ga.avgSessionDurationSecs%60)}s</span></div>
              <div class="mini"><span class="mini-lbl">Bounce Rate</span><span class="mini-val" style="color:var(--amber)">\${ga.bounceRate.toFixed(1)}%</span></div>
              <div class="mini"><span class="mini-lbl">Engagement Rate</span><span class="mini-val" style="color:var(--green)">\${ga.engagementRate.toFixed(1)}%</span></div>
            </div>
            <div class="card">
              <div class="card-head"><span class="card-title">7-Day Snapshot</span></div>
              <div class="mini"><span class="mini-lbl">Active Users</span><span class="mini-val" style="color:var(--blue)">\${Number(ga.activeUsers7d).toLocaleString()}</span></div>
              <div class="mini"><span class="mini-lbl">New Users</span><span class="mini-val">\${Number(ga.newUsers7d).toLocaleString()}</span></div>
              <div class="mini"><span class="mini-lbl">Sessions</span><span class="mini-val">\${Number(ga.sessions7d).toLocaleString()}</span></div>
              <div class="mini"><span class="mini-lbl">Active Today</span><span class="mini-val" style="color:var(--green)">\${Number(ga.activeUsersToday).toLocaleString()}</span></div>
              <div style="margin-top:14px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:8px;">DEVICE BREAKDOWN</div>
                \${ga.deviceBreakdown.map(dev => {
                  const total = ga.deviceBreakdown.reduce((s, x) => s + x.sessions, 0) || 1;
                  return '<div class="mini"><span class="mini-lbl" style="text-transform:capitalize;">' + dev.device + '</span><span class="mini-val">' + Math.round((dev.sessions/total)*100) + '%</span></div>';
                }).join('')}
              </div>
            </div>
            <div class="card">
              <div class="card-head"><span class="card-title">Top Countries</span></div>
              \${ga.topCountries.slice(0,6).map(c => {
                const max = ga.topCountries[0]?.users || 1;
                const pct = Math.round((c.users/max)*100);
                return '<div class="city-row" style="margin-bottom:8px;"><div class="city-info"><div class="city-nm">' + c.country + '</div></div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><div class="city-cnt">' + Number(c.users).toLocaleString() + '</div></div>';
              }).join('')}
              <div style="margin-top:14px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint);margin-bottom:8px;">TOP PAGES</div>
                \${ga.topPages.map(p => '<div class="mini"><span class="mini-lbl" style="font-family:monospace;font-size:10px;">' + (p.page.length > 28 ? p.page.slice(0,28)+'…' : p.page) + '</span><span class="mini-val">' + Number(p.views).toLocaleString() + '</span></div>').join('')}
              </div>
            </div>
          </div>
        \`;
        sentimentHdr.parentNode?.insertBefore(block, sentimentHdr);
      }
    }

    // ── Footer timestamp ──────────────────────────────────────────────
    const footer = document.querySelector('footer');
    if (footer) {
      const ts = document.createElement('div');
      ts.style.cssText = 'font-size:10px;margin-top:6px;opacity:0.5;';
      ts.textContent = 'Live data: ' + new Date(d.capturedAt || Date.now()).toLocaleString()
        + (ga?.available ? ' · GA4 ✓' : ' · GA4 not configured');
      footer.appendChild(ts);
    }

  } catch(e) {
    console.warn('[Federation] live data failed:', e);
  }
})();
</script>`;

  html = html.replace("</body>", liveScript + "\n</body>");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`[Federation] Dashboard running on http://localhost:${PORT}/?key=YOUR_KEY`);
});
