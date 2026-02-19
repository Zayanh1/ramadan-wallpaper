// api/wallpaper.js — Canvas-based PNG generation with proper Arabic rendering
const { createCanvas } = require('@napi-rs/canvas');

async function getPrayerTimes(city, country, date, state = '') {
  const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear();
  const cityQuery = (country === 'US' || country === 'USA') && state ? `${city}, ${state}` : city;
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
function skyColors(hour) {
  if (hour < 4 || hour >= 21) return ['#010510','#020C1E','#030A16'];
  if (hour < 6)               return ['#030818','#0A1438','#0E1A42'];
  if (hour < 8)               return ['#180E30','#4A1E4A','#AA3828'];
  if (hour < 18)              return ['#0A1640','#163060','#1A3A70'];
  if (hour < 20)              return ['#180818','#5A2010','#C05028'];
  return ['#060416','#0C0820','#080618'];
}
function isNight(hour) { return hour < 6 || hour >= 20; }
function makeStars(W, H) {
  let s = 54321;
  const rn = () => { s=(s*1664525+1013904223)&0x7fffffff; return s/0x7fffffff; };
  return Array.from({length:65}, () => ({x:rn()*W, y:rn()*H*0.52, r:rn()*1.6+0.4, op:rn()*0.5+0.15}));
}

const SIZES = {
  iphone16pro:[1206,2622], iphone16:[1179,2556], iphone15:[1179,2556],
  iphone14:[1170,2532], iphone13:[1170,2532], iphone12:[1170,2532],
  s24ultra:[1440,3088], s24:[1080,2340], pixel8:[1080,2400],
  default:[1179,2556],
};

function drawWallpaper({ W, H, todayIftar, tomorrowSuhoor, hijriDate, ramadanDay, city, hour }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const sky = skyColors(hour);
  const night = isNight(hour);
  const stars = makeStars(W, H);

  // Layout
  const PAD = W * 0.068, CW = W - PAD*2, BOTTOM_ANCHOR = H * 0.968, GAP = H * 0.020;
  const TIME_H = H * 0.130, DOT_ARC_H = H * 0.240;
  const SUHOOR_Y = BOTTOM_ANCHOR - TIME_H, IFTAR_Y = SUHOOR_Y - GAP - TIME_H;
  const DIVIDER_Y = IFTAR_Y - GAP*0.8, DOT_ARC_Y = DIVIDER_Y - GAP*0.5 - DOT_ARC_H;
  const HIJRI_Y = DOT_ARC_Y - GAP*0.9;
  const FS = {
    hijri: W*0.040, rowLabel: W*0.030, rowAr: W*0.046, rowTime: W*0.092,
    city: W*0.022, ramadan: W*0.140, dayLabel: W*0.024,
  };

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, sky[0]); skyGrad.addColorStop(0.48, sky[1]); skyGrad.addColorStop(1, sky[2]);
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

  // Stars
  if (night) {
    for (const s of stars) {
      ctx.fillStyle = `rgba(255,248,220,${s.op})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    }
  }

  // Pattern
  ctx.strokeStyle = 'rgba(212,168,71,0.025)'; ctx.lineWidth = 0.8;
  const PS = W*0.16;
  for (let gx=PS/2; gx<W; gx+=PS) {
    for (let gy=PS/2; gy<H*0.55; gy+=PS) {
      ctx.beginPath();
      for(let i=0; i<16; i++) {
        const r = i%2===0 ? PS*0.40 : PS*0.18, a = (i*Math.PI/8)-Math.PI/2;
        const px = gx+r*Math.cos(a), py = gy+r*Math.sin(a);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.stroke();
    }
  }

  // Moon
  if (night) {
    const MX=W*0.74, MY=H*0.078, MR=W*0.055;
    const moonGlow = ctx.createRadialGradient(MX,MY,0,MX,MY,MR*1.9);
    moonGlow.addColorStop(0,'rgba(240,210,90,0.08)'); moonGlow.addColorStop(1,'rgba(240,210,90,0)');
    ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(MX,MY,MR*1.9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#EDD060'; ctx.beginPath(); ctx.arc(MX,MY,MR,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = sky[0]; ctx.beginPath(); ctx.arc(MX+MR*0.54,MY-MR*0.20,MR*0.79,0,Math.PI*2); ctx.fill();
  }

  // Horizon
  ctx.fillStyle = 'rgba(160,110,20,0.04)'; ctx.beginPath();
  ctx.ellipse(W/2, H, W*0.8, H*0.18, 0, 0, Math.PI*2); ctx.fill();

  // HIJRI
  ctx.fillStyle = 'rgba(212,168,71,0.70)'; ctx.font = `400 ${FS.hijri}px -apple-system, Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hijriDate, W/2, HIJRI_Y+FS.hijri*0.75);

  // Dots
  const ARC_X_START = PAD + CW * 0.06, ARC_X_END = PAD + CW * 0.94, ARC_X_SPAN = ARC_X_END - ARC_X_START;
  const DOT_X_STEP = ARC_X_SPAN / 29, ARC_Y_TOP = DOT_ARC_Y + DOT_ARC_H * 0.28;
  const ARC_Y_BOT = DOT_ARC_Y + DOT_ARC_H * 0.88, ARC_DEPTH = (ARC_Y_BOT - ARC_Y_TOP) * 0.42;
  const dots = [];
  for (let i = 0; i < 30; i++) {
    const x = ARC_X_START + i * DOT_X_STEP, normX = (i - 14.5) / 14.5;
    const y = ARC_Y_TOP - ARC_DEPTH * (1 - normX * normX);
    dots.push({ x, y, day: i + 1 });
  }

  // رمضان
  ctx.fillStyle = 'rgba(212,168,71,0.12)'; ctx.font = `200 ${FS.ramadan}px -apple-system, Arial`;
  ctx.fillText('رمضان', W/2, DOT_ARC_Y + DOT_ARC_H*0.35);

  // Arc line
  ctx.strokeStyle = 'rgba(212,168,71,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(dots[0].x, dots[0].y); ctx.quadraticCurveTo(dots[14].x, dots[14].y-DOT_ARC_H*0.05, dots[29].x, dots[29].y);
  ctx.stroke();

  // Dot rendering
  for (const d of dots) {
    if (d.day < ramadanDay) {
      ctx.fillStyle = 'rgba(212,168,71,0.80)';
      ctx.beginPath(); ctx.arc(d.x, d.y, W*0.012, 0, Math.PI*2); ctx.fill();
    } else if (d.day === ramadanDay) {
      const dotGlow = ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,W*0.032);
      dotGlow.addColorStop(0,'#F0D060'); dotGlow.addColorStop(1,'rgba(240,208,96,0)');
      ctx.fillStyle = dotGlow; ctx.beginPath(); ctx.arc(d.x, d.y, W*0.032, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#F0D060'; ctx.beginPath(); ctx.arc(d.x, d.y, W*0.016, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.strokeStyle = 'rgba(212,168,71,0.20)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(d.x, d.y, W*0.010, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
  }

  // Day label
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = `300 ${FS.dayLabel}px -apple-system, Arial`;
  ctx.fillText(`DAY ${ramadanDay} OF 30`, W/2, DOT_ARC_Y + DOT_ARC_H*0.98);

  // Divider
  const DY = DIVIDER_Y+GAP*0.4, DW = CW*0.38;
  ctx.strokeStyle = 'rgba(212,168,71,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(W/2-DW/2, DY); ctx.lineTo(W/2+DW/2, DY); ctx.stroke();

  // IFTAR
  const IFTAR_MID = IFTAR_Y + TIME_H/2;
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.font = `300 ${FS.rowLabel}px -apple-system, Arial`;
  ctx.fillText('IFTAR  TODAY', PAD, IFTAR_MID-FS.rowAr*0.55);
  ctx.fillStyle = 'rgba(212,168,71,0.55)'; ctx.font = `400 ${FS.rowAr}px -apple-system, Arial`;
  ctx.fillText('الإفطار', PAD, IFTAR_MID+FS.rowAr*0.75);
  ctx.textAlign = 'right'; ctx.fillStyle = '#E8C050'; ctx.font = `200 ${FS.rowTime}px -apple-system, Arial`;
  ctx.fillText(fmt12(todayIftar.h,todayIftar.m), W-PAD, IFTAR_MID+FS.rowTime*0.35);

  // SUHOOR
  const SUHOOR_MID = SUHOOR_Y + TIME_H/2;
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.font = `300 ${FS.rowLabel}px -apple-system, Arial`;
  ctx.fillText('SUHOOR  TOMORROW', PAD, SUHOOR_MID-FS.rowAr*0.55);
  ctx.fillStyle = 'rgba(140,180,255,0.50)'; ctx.font = `400 ${FS.rowAr}px -apple-system, Arial`;
  ctx.fillText('السحور', PAD, SUHOOR_MID+FS.rowAr*0.75);
  ctx.textAlign = 'right'; ctx.fillStyle = '#A0C8F0'; ctx.font = `200 ${FS.rowTime}px -apple-system, Arial`;
  ctx.fillText(fmt12(tomorrowSuhoor.h,tomorrowSuhoor.m), W-PAD, SUHOOR_MID+FS.rowTime*0.35);

  // City
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.font = `300 ${FS.city}px -apple-system, Arial`;
  ctx.fillText(city.toUpperCase(), W/2, BOTTOM_ANCHOR+FS.city*0.1);

  return canvas.toBuffer('image/png');
}

module.exports = async function handler(req, res) {
  const city = (req.query.city || 'Dubai').trim();
  const country = (req.query.country || '').trim();
  const state = (req.query.state || '').trim();
  const model = (req.query.model || 'iphone15').toLowerCase();
  const [W, H] = SIZES[model] || SIZES.default;

  try {
    const today = new Date();
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

    const todayIftar = parseHHMM(todayData.timings.Maghrib);
    const tomorrowSuhoor = parseHHMM(tomorrowData.timings.Fajr);
    const h = todayData.date.hijri;
    const ramadanDay = parseInt(h.day) || 1;
    const hijriDate = `${toAr(h.day)} ${h.month.ar} ${toAr(h.year)}`;
    const hour = today.getHours();

    const pngBuffer = drawWallpaper({ W, H, todayIftar, tomorrowSuhoor, hijriDate, ramadanDay, city, hour });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.status(200).send(pngBuffer);

  } catch (err) {
    console.error('Wallpaper error:', err);
    const errCanvas = createCanvas(400, 120);
    const ctx = errCanvas.getContext('2d');
    ctx.fillStyle = '#060818'; ctx.fillRect(0,0,400,120);
    ctx.fillStyle = '#D4A847'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('Error generating wallpaper', 200, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px Arial';
    ctx.fillText(err.message || 'Unknown error', 200, 80);
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(errCanvas.toBuffer('image/png'));
  }
};
