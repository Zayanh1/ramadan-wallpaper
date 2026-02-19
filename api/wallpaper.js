// api/wallpaper.js — ZERO DEPENDENCIES
// THE DOT ARC: 30 dots in a clean geometric arc with state parameter support

async function getPrayerTimes(city, country, date, state = '') {
  const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear();
  // For US cities, append state to city name for better matching
  const cityQuery = (country === 'US' || country === 'USA') && state 
    ? `${city}, ${state}` 
    : city;
  const url = `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(cityQuery)}&country=${encodeURIComponent(country||'')}&method=4`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  const data = await res.json();
  if (data.code !== 200) throw new Error('City not found: ' + cityQuery);
  return data.data;
}

function parseHHMM(str) {
  const [h, m] = str.split(' ')[0].split(':').map(Number);
  return { h, m };
}
function fmt12(h, m) {
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function toAr(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}
function xe(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function skyColors(hour) {
  if (hour < 4 || hour >= 21) return ['#010510','#020C1E','#030A16'];
  if (hour < 6)               return ['#030818','#0A1438','#0E1A42'];
  if (hour < 8)               return ['#180E30','#4A1E4A','#AA3828'];
  if (hour < 18)              return ['#0A1640','#163060','#1A3A70'];
  if (hour < 20)              return ['#180818','#5A2010','#C05028'];
  return                             ['#060416','#0C0820','#080618'];
}
function isNight(hour) { return hour < 6 || hour >= 20; }
function makeStars(W, H) {
  let s = 54321;
  const rn = () => { s=(s*1664525+1013904223)&0x7fffffff; return s/0x7fffffff; };
  return Array.from({length:65}, () => ({x:rn()*W, y:rn()*H*0.52, r:rn()*1.6+0.4, op:rn()*0.5+0.15}));
}

const SIZES = {
  iphone16pro:[1206,2622], iphone16:[1179,2556], iphone15:[1179,2556],
  iphone14:[1170,2532],    iphone13:[1170,2532],  iphone12:[1170,2532],
  s24ultra:[1440,3088],    s24:[1080,2340],        pixel8:[1080,2400],
  default:[1179,2556],
};

function buildSVG({ W, H, todayIftar, tomorrowSuhoor, hijriDate, ramadanDay, city, hour }) {
  const sky   = skyColors(hour);
  const night = isNight(hour);
  const stars = makeStars(W, H);

  // Layout — FIXED positioning (removed your +200 hack)
  const PAD    = W * 0.068;
  const CW     = W - PAD*2;
  const BOTTOM_ANCHOR = H * 0.968;
  const GAP           = H * 0.020;
  const TIME_H        = H * 0.130;
  const DOT_ARC_H     = H * 0.240;
  const HIJRI_H       = H * 0.048;

  const SUHOOR_Y  = BOTTOM_ANCHOR - TIME_H;
  const IFTAR_Y   = SUHOOR_Y - GAP - TIME_H;
  const DIVIDER_Y = IFTAR_Y - GAP*0.8;
  const DOT_ARC_Y = DIVIDER_Y - GAP*0.5 - DOT_ARC_H;  // No +200, proper calculation
  const HIJRI_Y   = DOT_ARC_Y - GAP*0.9;

  const FS = {
    hijri:    W*0.040,
    rowLabel: W*0.030,
    rowAr:    W*0.046,
    rowTime:  W*0.092,
    city:     W*0.022,
    ramadan:  W*0.140,
    dayLabel: W*0.024,
  };

  // ── DOT ARC: YOUR parabolic curve formula ─────────────────────────────────
  const ARC_X_START = PAD + CW * 0.06;
  const ARC_X_END   = PAD + CW * 0.94;
  const ARC_X_SPAN  = ARC_X_END - ARC_X_START;
  const DOT_X_STEP  = ARC_X_SPAN / 29;

  // Your exact Y formula
  const ARC_Y_TOP = DOT_ARC_Y + DOT_ARC_H * 0.28;
  const ARC_Y_BOT = DOT_ARC_Y + DOT_ARC_H * 0.88;
  const ARC_DEPTH = (ARC_Y_BOT - ARC_Y_TOP) * 0.42;

  const dots = [];
  for (let i = 0; i < 30; i++) {
    const x = ARC_X_START + i * DOT_X_STEP;
    const normX = (i - 14.5) / 14.5;
    const y = ARC_Y_TOP - ARC_DEPTH * (1 - normX * normX);
    dots.push({ x, y, day: i + 1 });
  }

  // ── SVG START ──────────────────────────────────────────────────────────────
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<style>text{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif}</style>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%"   stop-color="${sky[0]}"/>
  <stop offset="48%"  stop-color="${sky[1]}"/>
  <stop offset="100%" stop-color="${sky[2]}"/>
</linearGradient>
<linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#F0D878"/><stop offset="100%" stop-color="#C8941E"/>
</linearGradient>
<linearGradient id="bT" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#C0D8FF"/><stop offset="100%" stop-color="#7AA0E0"/>
</linearGradient>
<filter id="tGlow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="8" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="mF" x="-80%" y="-80%" width="260%" height="260%">
  <feGaussianBlur stdDeviation="20" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="tG" x="-20%" y="-30%" width="140%" height="160%">
  <feGaussianBlur stdDeviation="5" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
`;

  // Stars
  if (night)
    for (const s of stars)
      o += `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(1)}" fill="rgba(255,248,220,${s.op.toFixed(2)})"/>`;

  // Background geometric tile
  {
    const PS = W*0.16;
    o += `<g opacity="0.025" stroke="#D4A847" stroke-width="0.8" fill="none">`;
    const star8 = (cx,cy,r1,r2) => {
      let p='';
      for(let i=0;i<16;i++){const r=i%2===0?r1:r2,a=(i*Math.PI/8)-Math.PI/2;p+=`${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)} `;}
      return p.trim();
    };
    for (let gx=PS/2; gx<W+PS; gx+=PS)
      for (let gy=PS/2; gy<H*0.55; gy+=PS)
        o += `<polygon points="${star8(gx,gy,PS*0.40,PS*0.18)}"/>`;
    o += `</g>`;
  }

  // Crescent moon
  if (night) {
    const MX=W*0.74, MY=H*0.078, MR=W*0.055;
    o += `<g filter="url(#mF)">
  <circle cx="${MX.toFixed(0)}" cy="${MY.toFixed(0)}" r="${(MR*1.9).toFixed(1)}" fill="rgba(240,210,90,0.05)"/>
  <circle cx="${MX.toFixed(0)}" cy="${MY.toFixed(0)}" r="${MR.toFixed(1)}" fill="#EDD060"/>
  <circle cx="${(MX+MR*0.54).toFixed(1)}" cy="${(MY-MR*0.20).toFixed(1)}" r="${(MR*0.79).toFixed(1)}" fill="${sky[0]}"/>
</g>`;
    const decorStars = [[W*0.84,H*0.048,W*0.009,0.55],[W*0.62,H*0.040,W*0.007,0.45],[W*0.80,H*0.028,W*0.006,0.38]];
    for (const [sx,sy,sr,so] of decorStars) {
      let p='';
      for(let i=0;i<16;i++){const r=i%2===0?sr:sr*0.42,a=(i*Math.PI/8)-Math.PI/2;p+=`${(sx+r*Math.cos(a)).toFixed(1)},${(sy+r*Math.sin(a)).toFixed(1)} `;}
      o += `<polygon points="${p.trim()}" fill="rgba(240,220,120,${so})"/>`;
    }
  }

  o += `<ellipse cx="${W/2}" cy="${H}" rx="${W*0.8}" ry="${H*0.18}" fill="rgba(160,110,20,0.04)"/>`;

  // HIJRI DATE
  o += `<text x="${W/2}" y="${(HIJRI_Y+FS.hijri*0.75).toFixed(0)}" text-anchor="middle"
  font-size="${FS.hijri.toFixed(0)}" font-weight="400" fill="rgba(212,168,71,0.70)" letter-spacing="1">${xe(hijriDate)}</text>`;

  // ═══ DOT ARC ═══════════════════════════════════════════════════════════════

  // رمضان word — FIXED Arabic encoding
  o += `<text x="${W/2}" y="${(DOT_ARC_Y + DOT_ARC_H*0.35).toFixed(0)}" text-anchor="middle"
  font-size="${FS.ramadan.toFixed(0)}" font-weight="200" fill="rgba(212,168,71,0.12)" letter-spacing="4">رمضان</text>`;

  // Connecting arc path
  const first = dots[0], last = dots[29], mid = dots[14];
  o += `<path d="M ${first.x.toFixed(1)},${first.y.toFixed(1)} Q ${mid.x.toFixed(1)},${mid.y.toFixed(1)} ${last.x.toFixed(1)},${last.y.toFixed(1)}" fill="none" stroke="rgba(212,168,71,0.10)" stroke-width="1"/>`;

  // The 30 dots
  for (const d of dots) {
    if (d.day < ramadanDay) {
      o += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(W*0.012).toFixed(1)}" fill="rgba(212,168,71,0.80)"/>`;
    } else if (d.day === ramadanDay) {
      o += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(W*0.016).toFixed(1)}" fill="#F0D060" filter="url(#tGlow)"/>`;
    } else {
      o += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(W*0.010).toFixed(1)}" fill="rgba(255,255,255,0.03)" stroke="rgba(212,168,71,0.20)" stroke-width="1"/>`;
    }
  }

  // Day label — ENGLISH
  o += `<text x="${W/2}" y="${(DOT_ARC_Y + DOT_ARC_H*0.98).toFixed(0)}" text-anchor="middle"
  font-size="${FS.dayLabel.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.18)" letter-spacing="4">DAY ${ramadanDay} OF 30</text>`;

  // DIVIDER
  {
    const DY = (DIVIDER_Y+GAP*0.4).toFixed(0);
    const DW = CW*0.38;
    o += `<line x1="${(W/2-DW/2).toFixed(0)}" y1="${DY}" x2="${(W/2+DW/2).toFixed(0)}" y2="${DY}" stroke="rgba(212,168,71,0.18)" stroke-width="1"/>`;
    let sp='';
    const sr1=W*0.006, sr2=sr1*0.42;
    for(let i=0;i<16;i++){const r=i%2===0?sr1:sr2,a=(i*Math.PI/8)-Math.PI/2;sp+=`${(W/2+r*Math.cos(a)).toFixed(1)},${(parseFloat(DY)+r*Math.sin(a)).toFixed(1)} `;}
    o += `<polygon points="${sp.trim()}" fill="rgba(212,168,71,0.35)"/>`;
  }

  // IFTAR ROW
  {
    const MID = IFTAR_Y + TIME_H/2;
    o += `
<text x="${PAD}" y="${(MID-FS.rowAr*0.55).toFixed(0)}"
  font-size="${FS.rowLabel.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.32)" letter-spacing="4">IFTAR  TODAY</text>
<text x="${PAD}" y="${(MID+FS.rowAr*0.75).toFixed(0)}"
  font-size="${FS.rowAr.toFixed(0)}" font-weight="400" fill="rgba(212,168,71,0.55)">الإفطار</text>
<text x="${W-PAD}" y="${(MID+FS.rowTime*0.35).toFixed(0)}" text-anchor="end"
  font-size="${FS.rowTime.toFixed(0)}" font-weight="200" fill="url(#gT)" filter="url(#tG)" letter-spacing="-0.5">${xe(fmt12(todayIftar.h,todayIftar.m))}</text>`;
  }

  // SUHOOR ROW
  {
    const MID = SUHOOR_Y + TIME_H/2;
    o += `
<text x="${PAD}" y="${(MID-FS.rowAr*0.55).toFixed(0)}"
  font-size="${FS.rowLabel.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.32)" letter-spacing="4">SUHOOR  TOMORROW</text>
<text x="${PAD}" y="${(MID+FS.rowAr*0.75).toFixed(0)}"
  font-size="${FS.rowAr.toFixed(0)}" font-weight="400" fill="rgba(140,180,255,0.50)">السحور</text>
<text x="${W-PAD}" y="${(MID+FS.rowTime*0.35).toFixed(0)}" text-anchor="end"
  font-size="${FS.rowTime.toFixed(0)}" font-weight="200" fill="url(#bT)" filter="url(#tG)" letter-spacing="-0.5">${xe(fmt12(tomorrowSuhoor.h,tomorrowSuhoor.m))}</text>`;
  }

  // City
  o += `<text x="${W/2}" y="${(BOTTOM_ANCHOR+FS.city*0.1).toFixed(0)}" text-anchor="middle"
  font-size="${FS.city.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.13)" letter-spacing="4">${xe(city.toUpperCase())}</text>`;

  o += `</svg>`;
  return o;
}

module.exports = async function handler(req, res) {
  const city    = (req.query.city    || 'Dubai').trim();
  const country = (req.query.country || '').trim();
  const state   = (req.query.state   || '').trim();
  const model   = (req.query.model   || 'iphone15').toLowerCase();
  const [W, H]  = SIZES[model] || SIZES.default;

  try {
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
    
    let todayData, tomorrowData;
    try {
      [todayData, tomorrowData] = await Promise.all([
        getPrayerTimes(city, country, today, state),
        getPrayerTimes(city, country, tomorrow, state),
      ]);
    } catch {
      [todayData, tomorrowData] = await Promise.all([
        getPrayerTimes('Dubai','AE',today),
        getPrayerTimes('Dubai','AE',tomorrow),
      ]);
    }

    const todayIftar     = parseHHMM(todayData.timings.Maghrib);
    const tomorrowSuhoor = parseHHMM(tomorrowData.timings.Fajr);
    const h              = todayData.date.hijri;
    const ramadanDay     = parseInt(h.day) || 1;
    const hijriDate      = `${toAr(h.day)} ${h.month.ar} ${toAr(h.year)}`;
    const hour           = today.getHours();

    const svg = buildSVG({ W, H, todayIftar, tomorrowSuhoor, hijriDate, ramadanDay, city, hour });

    // Convert SVG to PNG using resvg (handles fonts properly)
    const { Resvg } = require('@resvg/resvg-js');
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: W }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.status(200).send(pngBuffer);

  } catch (err) {
    // Return error as PNG
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
      <rect width="400" height="120" fill="#060818"/>
      <text x="200" y="52" text-anchor="middle" fill="#D4A847" font-size="14" font-family="Arial">Error</text>
      <text x="200" y="80" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="11" font-family="Arial">${xe(err.message || 'Unknown error')}</text>
    </svg>`;
    
    try {
      const { Resvg } = require('@resvg/resvg-js');
      const resvg = new Resvg(errorSvg, { fitTo: { mode: 'width', value: 400 }});
      const errPng = resvg.render().asPng();
      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(errPng);
    } catch {
      res.setHeader('Content-Type', 'text/plain');
      res.status(500).send('Error generating wallpaper');
    }
  }
};
