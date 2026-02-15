// api/wallpaper.js
// Vercel serverless function — returns a fresh PNG wallpaper on every GET request.
// iOS Shortcut fetches this URL daily at Fajr time and sets it as lock screen.

const { createCanvas, registerFont, GlobalFonts } = require('@napi-rs/canvas');

// ─── Aladhan prayer time API (free, no key) ─────────────────────────────────
async function getPrayerTimes(city, country = '') {
  const now = new Date();
  const d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=4`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Prayer time fetch failed');
  const data = await res.json();
  if (data.code !== 200) throw new Error('City not found');
  return data.data;
}

// ─── Hijri date helpers ──────────────────────────────────────────────────────
function toArabicNumerals(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function getRamadanDay(hijriDay) {
  return parseInt(hijriDay) || 1;
}

// ─── Time parsing ────────────────────────────────────────────────────────────
function parseTime(timeStr) {
  // timeStr like "04:28" or "04:28 (EEST)"
  const clean = timeStr.split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  return { h, m, label: formatTime(h, m) };
}

function formatTime(h, m) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function minutesSinceMidnight(h, m) { return h * 60 + m; }

function countdownStr(targetH, targetM) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = targetH * 60 + targetM;
  let diff = targetMins - nowMins;
  if (diff < 0) diff += 1440;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs === 0) return `${mins}m remaining`;
  return `${hrs}h ${mins}m remaining`;
}

// ─── Sky gradient (same logic as frontend preview) ───────────────────────────
function getSkyColors(nowMins, fajrMins, maghribMins) {
  const sunrise = fajrMins + 40;
  const sunset  = maghribMins - 30;

  if (nowMins < fajrMins - 90 || nowMins > maghribMins + 90) {
    return { top: '#02040E', mid: '#04061A', bot: '#060818' }; // deep night
  } else if (nowMins < fajrMins) {
    return { top: '#050820', mid: '#0A1540', bot: '#102038' }; // pre-fajr
  } else if (nowMins < sunrise) {
    return { top: '#1A1035', mid: '#5A2550', bot: '#C04030' }; // dawn
  } else if (nowMins < sunset) {
    return { top: '#0A1845', mid: '#1A3060', bot: '#2A5080' }; // day
  } else if (nowMins < maghribMins) {
    return { top: '#1A0A20', mid: '#3A1530', bot: '#D06030' }; // sunset
  } else {
    return { top: '#08061A', mid: '#100820', bot: '#0A0818' }; // after iftar
  }
}

// ─── Phase (Ashr) ─────────────────────────────────────────────────────────── 
function getPhase(day) {
  if (day <= 10)  return { en: 'Days of Mercy',       ar: 'أيام الرحمة',    color: '#A8C4FF' };
  if (day <= 20)  return { en: 'Days of Forgiveness', ar: 'أيام المغفرة',   color: '#A8D4A8' };
  return             { en: 'Freedom from Hellfire', ar: 'العتق من النار', color: '#FFD480' };
}

// ─── Main draw function ───────────────────────────────────────────────────────
function drawWallpaper({ width, height, suhoor, iftar, hijriDate, ramadanDay, theme }) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const fajrMins = minutesSinceMidnight(suhoor.h, suhoor.m);
  const maghribMins = minutesSinceMidnight(iftar.h, iftar.m);

  // ── Sky background ──
  const sky = getSkyColors(nowMins, fajrMins, maghribMins);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0,   sky.top);
  grad.addColorStop(0.4, sky.mid);
  grad.addColorStop(1,   sky.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // ── Stars (night only) ──
  const isNight = nowMins < fajrMins - 60 || nowMins > maghribMins + 60;
  if (isNight) {
    ctx.save();
    const rng = mulberry32(42); // deterministic seed for consistent positions
    for (let i = 0; i < 80; i++) {
      const x = rng() * width;
      const y = rng() * height * 0.55;
      const r = rng() * 1.2 + 0.3;
      const a = rng() * 0.6 + 0.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 248, 220, ${a})`;
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Crescent moon ──
  if (isNight || nowMins < fajrMins) {
    const mx = width * 0.72, my = height * 0.12;
    ctx.save();
    // Outer glow
    const moonGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
    moonGlow.addColorStop(0, 'rgba(245,220,130,0.15)');
    moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath(); ctx.arc(mx, my, 60, 0, Math.PI * 2); ctx.fill();
    // Moon body
    ctx.fillStyle = '#F5DC82';
    ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.fill();
    // Crescent cut
    ctx.fillStyle = sky.top;
    ctx.beginPath(); ctx.arc(mx + 14, my - 8, 18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Islamic geometric pattern overlay ──
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#D4A847';
  ctx.lineWidth = 0.6;
  const ps = 72;
  for (let gx = 0; gx <= width; gx += ps) {
    for (let gy = 0; gy <= height; gy += ps) {
      drawStar8(ctx, gx + ps/2, gy + ps/2, 20, 10);
    }
  }
  ctx.restore();

  // ── Horizon glow ──
  const hGlow = ctx.createRadialGradient(width/2, height, 0, width/2, height, height * 0.5);
  hGlow.addColorStop(0, 'rgba(212,150,40,0.08)');
  hGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, 0, width, height);

  // ═══════════════════════════════════════════════════
  // ── LOCK SCREEN CLOCK ──
  // ═══════════════════════════════════════════════════
  const clockH = now.getHours() % 12 || 12;
  const clockM = String(now.getMinutes()).padStart(2, '0');
  const clockTime = `${clockH}:${clockM}`;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `300 ${Math.round(width * 0.22)}px serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 20;
  ctx.fillText(clockTime, width / 2, height * 0.18);
  ctx.restore();

  // Date line
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `300 ${Math.round(width * 0.04)}px serif`;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0.2em';
  ctx.fillText(dateStr.toUpperCase(), width / 2, height * 0.235);
  ctx.restore();

  // Hijri date
  ctx.save();
  ctx.fillStyle = 'rgba(212,168,71,0.85)';
  ctx.font = `400 ${Math.round(width * 0.042)}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText(hijriDate, width / 2, height * 0.275);
  ctx.restore();

  // ═══════════════════════════════════════════════════
  // ── MAIN CARD AREA (bottom ~60%) ──
  // ═══════════════════════════════════════════════════
  const cardY = height * 0.38;
  const cardH = height * 0.58;
  const cardX = width * 0.05;
  const cardW = width * 0.9;

  // Card background
  const cardGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
  cardGrad.addColorStop(0, 'rgba(4,6,20,0.72)');
  cardGrad.addColorStop(1, 'rgba(2,4,14,0.88)');
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(212,168,71,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // ── ARC COUNTDOWN ──
  const arcCX = width / 2;
  const arcCY = cardY + cardH * 0.32;
  const arcR  = width * 0.28;
  const circumference = 2 * Math.PI * arcR;

  // Determine countdown
  let targetMins, arcLabel, arcColor, countdownMins;
  if (nowMins < fajrMins) {
    countdownMins = fajrMins - nowMins;
    arcLabel = 'SUHOOR ENDS IN';
    arcColor = '#A8C4FF';
    const total = fajrMins;
    const progress = 1 - countdownMins / total;
    drawArc(ctx, arcCX, arcCY, arcR, circumference, progress, '#A8C4FF');
  } else if (nowMins < maghribMins) {
    countdownMins = maghribMins - nowMins;
    arcLabel = 'UNTIL IFTAR';
    arcColor = '#D4A847';
    const total = maghribMins - fajrMins;
    const progress = 1 - countdownMins / total;
    drawArc(ctx, arcCX, arcCY, arcR, circumference, progress, '#D4A847');
  } else {
    countdownMins = 1440 - nowMins + fajrMins;
    arcLabel = 'UNTIL SUHOOR';
    arcColor = '#A8C4FF';
    const total = 1440 - maghribMins + fajrMins;
    const progress = 1 - countdownMins / total;
    drawArc(ctx, arcCX, arcCY, arcR, circumference, progress, '#A8C4FF');
  }

  const cHrs  = Math.floor(countdownMins / 60);
  const cMins = countdownMins % 60;
  const countdownDisplay = `${String(cHrs).padStart(2,'0')}:${String(cMins).padStart(2,'0')}`;

  // Arc label
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `300 ${Math.round(width * 0.03)}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText(arcLabel, arcCX, arcCY - arcR * 0.35);
  ctx.restore();

  // Arc countdown time
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `300 ${Math.round(width * 0.13)}px serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = arcColor;
  ctx.shadowBlur = 12;
  ctx.fillText(countdownDisplay, arcCX, arcCY + arcR * 0.14);
  ctx.restore();

  // Arc sub label
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `300 ${Math.round(width * 0.028)}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText('hours remaining', arcCX, arcCY + arcR * 0.38);
  ctx.restore();

  // ── TWO TIME PANELS ──
  const panelY    = cardY + cardH * 0.60;
  const panelH    = cardH * 0.22;
  const panelGap  = width * 0.02;
  const panelW    = (cardW - panelGap) / 2;

  // Suhoor panel
  drawTimePanel(ctx, {
    x: cardX, y: panelY, w: panelW, h: panelH,
    label: 'SUHOOR', arabic: 'السحور',
    time: suhoor.label,
    countdown: nowMins < fajrMins ? countdownStr(suhoor.h, suhoor.m) : 'tomorrow',
    color: '#A8C4FF',
    bgColor: 'rgba(70,100,180,0.14)',
    borderColor: nowMins < fajrMins ? 'rgba(168,196,255,0.5)' : 'rgba(100,140,255,0.15)',
    icon: '🌙',
  });

  // Iftar panel
  drawTimePanel(ctx, {
    x: cardX + panelW + panelGap, y: panelY, w: panelW, h: panelH,
    label: 'IFTAR',   arabic: 'الإفطار',
    time: iftar.label,
    countdown: nowMins < maghribMins ? countdownStr(iftar.h, iftar.m) : 'completed ✓',
    color: '#D4A847',
    bgColor: 'rgba(180,120,30,0.14)',
    borderColor: (nowMins >= fajrMins && nowMins < maghribMins) ? 'rgba(212,168,71,0.6)' : 'rgba(212,168,71,0.15)',
    icon: '☀️',
  });

  // ── DAY DOTS STRIP ──
  const dotStripY = panelY + panelH + height * 0.025;
  const dotR      = Math.max(3, width * 0.012);
  const dotSpacing = (cardW - dotR * 2) / 29;
  const dotStartX = cardX + dotR;

  for (let i = 0; i < 30; i++) {
    const dx = dotStartX + i * dotSpacing;
    const dy = dotStripY;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);

    if (i + 1 < ramadanDay) {
      ctx.fillStyle = 'rgba(180,140,50,0.7)';
      ctx.fill();
    } else if (i + 1 === ramadanDay) {
      ctx.fillStyle = '#D4A847';
      ctx.shadowColor = '#D4A847';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(212,168,71,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // Phase label
  const phase = getPhase(ramadanDay);
  ctx.save();
  ctx.fillStyle = phase.color;
  ctx.font = `300 ${Math.round(width * 0.028)}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${phase.en}  ·  ${phase.ar}`, width / 2, dotStripY + height * 0.038);
  ctx.restore();

  return canvas;
}

// ─── Helper: draw 8-pointed star ─────────────────────────────────────────────
function drawStar8(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r     = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const x     = cx + r * Math.cos(angle);
    const y     = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

// ─── Helper: draw arc progress ring ──────────────────────────────────────────
function drawArc(ctx, cx, cy, r, circ, progress, color) {
  // Track
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Progress
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();
}

// ─── Helper: draw time panel ──────────────────────────────────────────────────
function drawTimePanel(ctx, { x, y, w, h, label, arabic, time, countdown, color, bgColor, borderColor, icon }) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  const cx = x + w / 2;
  const textScale = w / 140;

  // Arabic label
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `400 ${Math.round(14 * textScale)}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText(arabic, cx, y + h * 0.3);

  // English label
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `300 ${Math.round(9 * textScale)}px serif`;
  ctx.fillText(label, cx, y + h * 0.48);

  // Time (big)
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(20 * textScale)}px serif`;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(time, cx, y + h * 0.72);
  ctx.shadowBlur = 0;

  // Countdown sub
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = `300 ${Math.round(8 * textScale)}px serif`;
  ctx.fillText(countdown, cx, y + h * 0.9);

  ctx.restore();
}

// ─── Helper: rounded rect ────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Seeded RNG for deterministic stars ──────────────────────────────────────
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Phone dimensions lookup ──────────────────────────────────────────────────
const PHONE_SIZES = {
  'iphone16pro': { w: 1206, h: 2622 },
  'iphone16':    { w: 1179, h: 2556 },
  'iphone15':    { w: 1179, h: 2556 },
  'iphone14':    { w: 1170, h: 2532 },
  'iphone13':    { w: 1170, h: 2532 },
  'iphone12':    { w: 1170, h: 2532 },
  's24ultra':    { w: 1440, h: 3088 },
  's24':         { w: 1080, h: 2340 },
  'pixel8':      { w: 1080, h: 2400 },
  'default':     { w: 1170, h: 2532 },
};

// ─── Vercel handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  try {
    const { city = 'Dubai', country = '', model = 'iphone15', theme = 'midnight' } = req.query;

    // Fetch prayer times
    let prayerData;
    try {
      prayerData = await getPrayerTimes(city, country);
    } catch {
      // Fallback to Dubai
      prayerData = await getPrayerTimes('Dubai', 'AE');
    }

    const { timings, date } = prayerData;
    const suhoor = parseTime(timings.Fajr);     // Suhoor ends at Fajr
    const iftar  = parseTime(timings.Maghrib);  // Iftar at Maghrib

    // Hijri date
    const h = date.hijri;
    const ramadanDay = getRamadanDay(h.day);
    const hijriDate = `${toArabicNumerals(h.day)} ${h.month.ar} ${toArabicNumerals(h.year)}`;

    // Canvas size
    const size = PHONE_SIZES[model.toLowerCase()] || PHONE_SIZES.default;

    // Draw
    const canvas = drawWallpaper({
      width: size.w,
      height: size.h,
      suhoor,
      iftar,
      hijriDate,
      ramadanDay,
      theme,
    });

    const buffer = canvas.toBuffer('image/png');

    // Never cache — always fresh for today's times
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);

  } catch (err) {
    console.error('Wallpaper generation error:', err);
    res.status(500).json({ error: err.message });
  }
};
