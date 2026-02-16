// api/wallpaper.js
// ZERO DEPENDENCIES — pure SVG output. No npm packages needed at all.
// Drop this file into your repo. Works with whatever package.json exists.
// iOS Shortcuts fetches this URL daily and sets it as wallpaper.

async function getPrayerTimes(city, country) {
  const now = new Date();
  const d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country || '')}&method=4`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  const data = await res.json();
  if (data.code !== 200) throw new Error('City not found: ' + city);
  return data.data;
}

function parseHHMM(str) {
  const [h, m] = str.split(' ')[0].split(':').map(Number);
  return { h, m };
}

function fmt12(h, m) {
  const ap = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}

function getNowMins() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function countdown(th, tm, nowM) {
  let diff = th * 60 + tm - nowM;
  if (diff < 0) diff += 1440;
  const h = Math.floor(diff / 60), m = diff % 60;
  return { str: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, total: diff,
           short: h > 0 ? `${h}h ${m}m left` : `${m}m left` };
}

function toAr(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function xe(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function skyColors(nm, fajr, maghrib) {
  if (nm < fajr - 90 || nm > maghrib + 90) return ['#010510','#030C22','#050918'];
  if (nm < fajr)                            return ['#04091E','#0C1840','#111E4A'];
  if (nm < fajr + 45)                       return ['#1A1038','#5A2255','#C04030'];
  if (nm < maghrib - 60)                    return ['#0A1845','#1A3565','#1E4878'];
  if (nm < maghrib)                         return ['#1A0820','#6A2A18','#D06030'];
  return                                           ['#080620','#10082A','#0C0820'];
}

function isNight(nm, fajr, maghrib) { return nm < fajr - 30 || nm > maghrib + 30; }

function getPhase(day) {
  if (day <= 10) return { en: 'Days of Mercy',       ar: 'ايام الرحمة',    col: '#A8C4FF' };
  if (day <= 20) return { en: 'Days of Forgiveness', ar: 'ايام المغفرة',   col: '#90D4A0' };
  return              { en: 'Seeking Freedom',      ar: 'العتق من النار', col: '#FFD080' };
}

function makeStars(W, H) {
  let s = 99991;
  const rn = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({length: 65}, () => ({ x: rn()*W, y: rn()*H*0.46, r: rn()*1.6+0.5, op: rn()*0.5+0.2 }));
}

function arcPath(cx, cy, r, progress) {
  if (progress <= 0.001) return '';
  if (progress >= 0.999) progress = 0.999;
  const a0 = -Math.PI/2, a1 = a0 + progress * 2 * Math.PI;
  const x1 = cx + r*Math.cos(a0), y1 = cy + r*Math.sin(a0);
  const x2 = cx + r*Math.cos(a1), y2 = cy + r*Math.sin(a1);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${progress>0.5?1:0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const SIZES = {
  iphone16pro:[1206,2622], iphone16:[1179,2556], iphone15:[1179,2556],
  iphone14:[1170,2532], iphone13:[1170,2532], iphone12:[1170,2532],
  s24ultra:[1440,3088], s24:[1080,2340], pixel8:[1080,2400], default:[1179,2556],
};

function buildSVG({ W, H, suhoor, iftar, hijriDate, ramadanDay, city, nowM }) {
  const fajrM = suhoor.h*60+suhoor.m, maghM = iftar.h*60+iftar.m;
  const sky   = skyColors(nowM, fajrM, maghM);
  const night = isNight(nowM, fajrM, maghM);
  const phase = getPhase(ramadanDay);
  const stars = makeStars(W, H);

  // Clock
  const now = new Date();
  const dispH = now.getHours()%12||12, dispM = String(now.getMinutes()).padStart(2,'0');
  const DAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const timeStr = `${dispH}:${dispM}`;
  const dateStr = `${DAYS[now.getDay()]}  ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  // Countdown
  let arcLabel, arcColor, cdStr, cdProg, arcSub;
  if (nowM < fajrM) {
    const cd = countdown(suhoor.h, suhoor.m, nowM);
    cdStr=cd.str; arcLabel='SUHOOR ENDS IN'; arcColor='#A8C4FF'; arcSub='eat before fajr';
    cdProg = Math.max(0, 1 - cd.total / Math.max(1, fajrM));
  } else if (nowM < maghM) {
    const cd = countdown(iftar.h, iftar.m, nowM);
    cdStr=cd.str; arcLabel='UNTIL IFTAR'; arcColor='#D4A847'; arcSub='hold strong';
    cdProg = Math.max(0, 1 - cd.total / Math.max(1, maghM - fajrM));
  } else {
    const cd = countdown(suhoor.h, suhoor.m, nowM);
    cdStr=cd.str; arcLabel='UNTIL SUHOOR'; arcColor='#A8C4FF'; arcSub='rest tonight';
    cdProg = Math.max(0, 1 - cd.total / Math.max(1, 1440 - maghM + fajrM));
  }

  const suhoorCd = countdown(suhoor.h, suhoor.m, nowM);
  const iftarCd  = countdown(iftar.h, iftar.m, nowM);
  const suhoorSub = nowM < fajrM ? suhoorCd.short : 'tomorrow';
  const iftarSub  = nowM >= maghM ? 'completed' : iftarCd.short;
  const suhoorActive = nowM < fajrM || nowM >= maghM;
  const iftarActive  = nowM >= fajrM && nowM < maghM;

  // Layout
  const PAD=W*0.05, CW=W-PAD*2;
  const CARD_X=PAD, CARD_Y=H*0.375, CARD_H=H*0.585;
  const ARC_CX=W/2, ARC_CY=CARD_Y+CARD_H*0.305, ARC_R=CW*0.30;
  const PANEL_Y=CARD_Y+CARD_H*0.565, PANEL_H=CARD_H*0.205;
  const PANEL_W=CW*0.476;
  const PANEL_L=CARD_X, PANEL_R=CARD_X+CW-PANEL_W;
  const DOT_Y=CARD_Y+CARD_H*0.8, DOT_R=Math.max(5,W*0.011);
  const DOT_COLS=15, DOT_GAP=(CW-DOT_R*2)/(DOT_COLS-1);
  const PHASE_Y=CARD_Y+CARD_H*0.895, CITY_Y=CARD_Y+CARD_H*0.953;

  const FS = {
    clock: W*0.183, date: W*0.033, hijri: W*0.037,
    arcL: W*0.027, arcT: W*0.112, arcS: W*0.025,
    panL: W*0.029, panT: W*0.059, panS: W*0.024,
    phase: W*0.026, city: W*0.022,
  };

  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<style>text{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif}</style>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="${sky[0]}"/>
  <stop offset="45%" stop-color="${sky[1]}"/>
  <stop offset="100%" stop-color="${sky[2]}"/>
</linearGradient>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="mglow" x="-80%" y="-80%" width="260%" height="260%">
  <feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
`;

  // Stars
  if (night) {
    o += `<g>`;
    for (const s of stars)
      o += `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(1)}" fill="rgba(255,248,220,${s.op.toFixed(2)})"/>`;
    o += `</g>`;
  }

  // Islamic pattern
  o += `<g opacity="0.032" stroke="#D4A847" stroke-width="0.7" fill="none">`;
  const PS=W*0.13;
  for (let gx=PS/2; gx<W; gx+=PS) for (let gy=PS/2; gy<H; gy+=PS) {
    let pts='';
    for (let i=0;i<16;i++) {
      const r=i%2===0?PS*0.36:PS*0.20, a=(i*Math.PI/8)-Math.PI/2;
      pts+=`${(gx+r*Math.cos(a)).toFixed(1)},${(gy+r*Math.sin(a)).toFixed(1)} `;
    }
    o+=`<polygon points="${pts.trim()}"/>`;
  }
  o+=`</g>`;

  // Moon
  if (night) {
    const MX=W*0.73, MY=H*0.082, MR=W*0.054;
    o+=`<g filter="url(#mglow)">
  <circle cx="${MX}" cy="${MY}" r="${MR*1.5}" fill="rgba(245,220,130,0.07)"/>
  <circle cx="${MX}" cy="${MY}" r="${MR}" fill="#F0D870"/>
  <circle cx="${MX+MR*0.56}" cy="${MY-MR*0.20}" r="${MR*0.82}" fill="${sky[0]}"/>
</g>`;
  }

  // Horizon glow
  o+=`<ellipse cx="${W/2}" cy="${H}" rx="${W*0.7}" ry="${H*0.25}" fill="rgba(200,140,30,0.05)"/>`;

  // CLOCK
  const CLK_Y=H*0.135;
  o+=`
<text x="${W/2}" y="${CLK_Y}" text-anchor="middle" font-size="${FS.clock.toFixed(0)}" font-weight="200" fill="rgba(255,255,255,0.93)">${xe(timeStr)}</text>
<text x="${W/2}" y="${(CLK_Y+FS.clock*0.45).toFixed(0)}" text-anchor="middle" font-size="${FS.date.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.40)" letter-spacing="4">${xe(dateStr)}</text>
<text x="${W/2}" y="${(CLK_Y+FS.clock*0.45+FS.hijri*1.6).toFixed(0)}" text-anchor="middle" font-size="${FS.hijri.toFixed(0)}" font-weight="400" fill="rgba(212,168,71,0.85)">${xe(hijriDate)}</text>
`;

  // CARD
  o+=`<rect x="${CARD_X.toFixed(0)}" y="${CARD_Y.toFixed(0)}" width="${CW.toFixed(0)}" height="${CARD_H.toFixed(0)}" rx="26" fill="rgba(3,7,22,0.77)" stroke="rgba(212,168,71,0.18)" stroke-width="1.5"/>`;

  // ARC
  o+=`<circle cx="${ARC_CX.toFixed(0)}" cy="${ARC_CY.toFixed(0)}" r="${ARC_R.toFixed(0)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${(W*0.009).toFixed(1)}"/>`;
  const ap = arcPath(ARC_CX, ARC_CY, ARC_R, cdProg);
  if (ap) o+=`<path d="${ap}" fill="none" stroke="${arcColor}" stroke-width="${(W*0.009).toFixed(1)}" stroke-linecap="round" filter="url(#glow)"/>`;

  o+=`
<text x="${ARC_CX}" y="${(ARC_CY-ARC_R*0.33).toFixed(0)}" text-anchor="middle" font-size="${FS.arcL.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.36)" letter-spacing="3">${xe(arcLabel)}</text>
<text x="${ARC_CX}" y="${(ARC_CY+ARC_R*0.17).toFixed(0)}" text-anchor="middle" font-size="${FS.arcT.toFixed(0)}" font-weight="200" fill="rgba(255,255,255,0.95)">${xe(cdStr)}</text>
<text x="${ARC_CX}" y="${(ARC_CY+ARC_R*0.42).toFixed(0)}" text-anchor="middle" font-size="${FS.arcS.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.28)" letter-spacing="1">${xe(arcSub)}</text>
`;

  // SUHOOR PANEL
  o+=`<rect x="${PANEL_L.toFixed(0)}" y="${PANEL_Y.toFixed(0)}" width="${PANEL_W.toFixed(0)}" height="${PANEL_H.toFixed(0)}" rx="14"
  fill="${suhoorActive?'rgba(70,100,180,0.18)':'rgba(50,70,130,0.07)'}"
  stroke="${suhoorActive?'rgba(168,196,255,0.50)':'rgba(100,130,200,0.14)'}" stroke-width="1.2"/>
<text x="${(PANEL_L+PANEL_W/2).toFixed(0)}" y="${(PANEL_Y+PANEL_H*0.27).toFixed(0)}" text-anchor="middle" font-size="${FS.panL.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.36)" letter-spacing="3">SUHOOR</text>
<text x="${(PANEL_L+PANEL_W/2).toFixed(0)}" y="${(PANEL_Y+PANEL_H*0.57).toFixed(0)}" text-anchor="middle" font-size="${FS.panT.toFixed(0)}" font-weight="600" fill="#A8C4FF">${xe(fmt12(suhoor.h,suhoor.m))}</text>
<text x="${(PANEL_L+PANEL_W/2).toFixed(0)}" y="${(PANEL_Y+PANEL_H*0.85).toFixed(0)}" text-anchor="middle" font-size="${FS.panS.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.28)">${xe(suhoorSub)}</text>
`;

  // IFTAR PANEL
  o+=`<rect x="${PANEL_R.toFixed(0)}" y="${PANEL_Y.toFixed(0)}" width="${PANEL_W.toFixed(0)}" height="${PANEL_H.toFixed(0)}" rx="14"
  fill="${iftarActive?'rgba(180,120,30,0.18)':'rgba(120,80,20,0.07)'}"
  stroke="${iftarActive?'rgba(212,168,71,0.55)':'rgba(160,120,40,0.14)'}" stroke-width="1.2"/>
<text x="${(PANEL_R+PANEL_W/2).toFixed(0)}" y="${(PANEL_Y+PANEL_H*0.27).toFixed(0)}" text-anchor="middle" font-size="${FS.panL.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.36)" letter-spacing="3">IFTAR</text>
<text x="${(PANEL_R+PANEL_W/2).toFixed(0)}" y="${(PANEL_Y+PANEL_H*0.57).toFixed(0)}" text-anchor="middle" font-size="${FS.panT.toFixed(0)}" font-weight="600" fill="#D4A847">${xe(fmt12(iftar.h,iftar.m))}</text>
<text x="${(PANEL_R+PANEL_W/2).toFixed(0)}" y="${(PANEL_Y+PANEL_H*0.85).toFixed(0)}" text-anchor="middle" font-size="${FS.panS.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.28)">${xe(iftarSub)}</text>
`;

  // DOTS (2 rows of 15)
  for (let i=0;i<30;i++) {
    const col=i%DOT_COLS, row=Math.floor(i/DOT_COLS);
    const dx=(CARD_X+DOT_R+col*DOT_GAP).toFixed(1);
    const dy=(DOT_Y+row*DOT_R*2.8).toFixed(1);
    const dn=i+1;
    if (dn===ramadanDay) {
      o+=`<circle cx="${dx}" cy="${dy}" r="${(DOT_R*2.3).toFixed(1)}" fill="rgba(212,168,71,0.15)"/>`;
      o+=`<circle cx="${dx}" cy="${dy}" r="${DOT_R}" fill="#D4A847"/>`;
    } else if (dn<ramadanDay) {
      o+=`<circle cx="${dx}" cy="${dy}" r="${DOT_R}" fill="rgba(180,140,50,0.75)"/>`;
    } else {
      o+=`<circle cx="${dx}" cy="${dy}" r="${DOT_R}" fill="rgba(255,255,255,0.06)" stroke="rgba(212,168,71,0.18)" stroke-width="0.8"/>`;
    }
  }

  // PHASE + CITY
  o+=`
<text x="${W/2}" y="${PHASE_Y.toFixed(0)}" text-anchor="middle" font-size="${FS.phase.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.26)" letter-spacing="1">Day ${ramadanDay}  ·  ${xe(phase.en)}</text>
<text x="${W/2}" y="${CITY_Y.toFixed(0)}" text-anchor="middle" font-size="${FS.city.toFixed(0)}" font-weight="300" fill="rgba(255,255,255,0.15)" letter-spacing="2">${xe(city.toUpperCase())}</text>
</svg>`;

  return o;
}

module.exports = async function handler(req, res) {
  const city    = (req.query.city    || 'Dubai').trim();
  const country = (req.query.country || '').trim();
  const model   = (req.query.model   || 'iphone15').toLowerCase();
  const [W, H]  = SIZES[model] || SIZES.default;

  try {
    let prayerData;
    try { prayerData = await getPrayerTimes(city, country); }
    catch { prayerData = await getPrayerTimes('Dubai', 'AE'); }

    const { timings, date } = prayerData;
    const suhoor = parseHHMM(timings.Fajr);
    const iftar  = parseHHMM(timings.Maghrib);
    const h = date.hijri;
    const ramadanDay = parseInt(h.day) || 1;
    const hijriDate  = `${toAr(h.day)} ${h.month.ar} ${toAr(h.year)}`;
    const nowM = getNowMins();

    const svg = buildSVG({ W, H, suhoor, iftar, hijriDate, ramadanDay, city, nowM });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.status(200).send(svg);
  } catch (err) {
    const errSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="150">
      <rect width="400" height="150" fill="#0a0a1a"/>
      <text x="200" y="60" text-anchor="middle" fill="#D4A847" font-size="15" font-family="Arial">Error</text>
      <text x="200" y="90" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="12" font-family="Arial">${xe(err.message)}</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(errSvg);
  }
};
