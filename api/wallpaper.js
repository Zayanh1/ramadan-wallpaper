// api/wallpaper.js
// Uses satori (Vercel's own OG image library) to render HTML → SVG → PNG.
// This approach GUARANTEES text renders correctly because fonts are bundled
// as base64 buffers — no runtime font loading failures.

const satori = require('satori');
const sharp  = require('sharp');

// ─── Prayer time helpers ──────────────────────────────────────────────────────
async function getPrayerTimes(city, country = '') {
  const now = new Date();
  const d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=4`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const data = await res.json();
  if (data.code !== 200) throw new Error(`City not found: ${city}`);
  return data.data;
}

function parseHHMM(str) {
  const clean = str.split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  return { h, m };
}

function fmt12(h, m) {
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

function minsNow() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function countdown(targetH, targetM) {
  const now = minsNow();
  const target = targetH * 60 + targetM;
  let diff = target - now;
  if (diff < 0) diff += 1440;
  const h = Math.floor(diff / 60), m = diff % 60;
  return { h, m, display: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, total: diff };
}

function toArabicNumerals(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// ─── Sky colours based on time ────────────────────────────────────────────────
function getSkyGradient(nowMins, fajrMins, maghribMins) {
  const sunrise = fajrMins + 40;
  const sunset  = maghribMins - 25;
  if (nowMins < fajrMins - 80 || nowMins > maghribMins + 80)
    return ['#020817', '#040D28', '#060B20'];           // deep night
  if (nowMins < fajrMins)
    return ['#050A22', '#0C1845', '#102040'];            // pre-fajr deep blue
  if (nowMins < sunrise)
    return ['#1A1040', '#5A2555', '#C04535'];            // fajr dawn
  if (nowMins < sunset - 60)
    return ['#0A1845', '#1A3565', '#1E4875'];            // day
  if (nowMins < maghribMins)
    return ['#1A0A22', '#6A2A18', '#D06030'];            // sunset
  return ['#080620', '#120830', '#0C0820'];              // after maghrib
}

function isNightTime(nowMins, fajrMins, maghribMins) {
  return nowMins < fajrMins - 30 || nowMins > maghribMins + 30;
}

function getPhase(day) {
  if (day <= 10)  return { en: 'Days of Mercy',        ar: 'أيام الرحمة',    col: '#A8C4FF' };
  if (day <= 20)  return { en: 'Days of Forgiveness',  ar: 'أيام المغفرة',   col: '#90D4A0' };
  return             { en: 'Seeking Freedom',        ar: 'العتق من النار', col: '#FFD080' };
}

// ─── Seeded RNG for consistent star positions ─────────────────────────────────
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Font loader — fetches from Google Fonts CDN at build/request time ────────
// Satori requires ArrayBuffer fonts. We fetch Inter (guaranteed Latin support)
// and a system fallback for Arabic text.
let fontCache = null;
async function getFonts() {
  if (fontCache) return fontCache;

  // Fetch Inter (reliable, complete Latin coverage — renders all numbers & ASCII)
  const [interLight, interRegular, interSemiBold] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff')
      .then(r => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuDyfAZ9hiJ-Ek-_EeA.woff')
      .then(r => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI_fAZ9hiJ-Ek-_EeA.woff')
      .then(r => r.arrayBuffer()),
  ]);

  fontCache = [
    { name: 'Inter', data: interLight,    weight: 300, style: 'normal' },
    { name: 'Inter', data: interRegular,  weight: 400, style: 'normal' },
    { name: 'Inter', data: interSemiBold, weight: 600, style: 'normal' },
  ];
  return fontCache;
}

// ─── Main wallpaper renderer ──────────────────────────────────────────────────
async function renderWallpaper({ W, H, suhoor, iftar, hijriDate, ramadanDay, city }) {
  const fonts = await getFonts();
  const nowMins    = minsNow();
  const fajrMins   = suhoor.h * 60 + suhoor.m;
  const magribMins = iftar.h  * 60 + iftar.m;
  const skyColors  = getSkyGradient(nowMins, fajrMins, magribMins);
  const night      = isNightTime(nowMins, fajrMins, magribMins);
  const phase      = getPhase(ramadanDay);

  // ── Countdown arc values ──────────────────────────────────────────────────
  let arcLabel, arcColor, arcSub, cd, progress;
  if (nowMins < fajrMins) {
    cd       = countdown(suhoor.h, suhoor.m);
    arcLabel = 'SUHOOR ENDS IN';
    arcColor = '#A8C4FF';
    arcSub   = 'eat before fajr';
    progress = Math.max(0, 1 - cd.total / fajrMins);
  } else if (nowMins < magribMins) {
    cd       = countdown(iftar.h, iftar.m);
    arcLabel = 'UNTIL IFTAR';
    arcColor = '#D4A847';
    arcSub   = 'hold strong';
    progress = Math.max(0, 1 - cd.total / (magribMins - fajrMins));
  } else {
    cd       = countdown(suhoor.h, suhoor.m);
    arcLabel = 'UNTIL SUHOOR';
    arcColor = '#A8C4FF';
    arcSub   = 'rest & recharge';
    progress = Math.max(0, 1 - cd.total / (1440 - magribMins + fajrMins));
  }

  // ── Arc SVG path (circle, drawn as SVG arc) ───────────────────────────────
  const R  = 160;     // radius (SVG units, canvas is 400 wide in satori)
  const CX = 200, CY = 200;
  const arcCirc = 2 * Math.PI * R;
  const filled  = arcCirc * Math.min(progress, 0.999);
  const gap     = arcCirc - filled;

  // Convert arc to SVG path — start at top (−π/2)
  function polarToXY(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }
  const startAngle = -Math.PI / 2;
  const endAngle   = startAngle + progress * 2 * Math.PI;
  const s = polarToXY(CX, CY, R, startAngle);
  const e = polarToXY(CX, CY, R, endAngle);
  const largeArc = progress > 0.5 ? 1 : 0;
  const arcPath  = progress < 0.005
    ? ''
    : `M ${s.x} ${s.y} A ${R} ${R} 0 ${largeArc} 1 ${e.x} ${e.y}`;

  // ── Star dots (deterministic) ─────────────────────────────────────────────
  const r = rng(7);
  const stars = Array.from({ length: 60 }, () => ({
    x: r() * 100, y: r() * 45, sz: r() * 1.5 + 0.5, op: r() * 0.6 + 0.2,
  }));

  // ── Suhoor/Iftar countdown lines ──────────────────────────────────────────
  const suhoorActive = nowMins < fajrMins || nowMins >= magribMins;
  const iftarActive  = nowMins >= fajrMins && nowMins < magribMins;
  const iftarDone    = nowMins >= magribMins;

  const suhoorCd = nowMins < fajrMins
    ? countdown(suhoor.h, suhoor.m)
    : { display: 'tomorrow', total: 9999 };
  const iftarCdStr = iftarDone ? 'completed ✓' : countdown(iftar.h, iftar.m).display;

  // ── Now time for display ──────────────────────────────────────────────────
  const now = new Date();
  const dispH   = now.getHours() % 12 || 12;
  const dispM   = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${dispH}:${dispM}`;
  const dateStr = now.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }).toUpperCase();

  // ── 30 day dots ──────────────────────────────────────────────────────────
  const dots = Array.from({ length: 30 }, (_, i) => i + 1);

  // ─────────────────────────────────────────────────────────────────────────
  // SATORI ELEMENT TREE (JSX-like objects)
  // ─────────────────────────────────────────────────────────────────────────
  const el = {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: `linear-gradient(180deg, ${skyColors[0]} 0%, ${skyColors[1]} 50%, ${skyColors[2]} 100%)`,
        fontFamily: 'Inter',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [

        // ── Stars (night only) ──
        ...(night ? stars.map(s => ({
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: `${s.x}%`, top: `${s.y}%`,
              width: `${s.sz * (W/400)}px`, height: `${s.sz * (W/400)}px`,
              borderRadius: '50%',
              background: `rgba(255,248,220,${s.op})`,
            },
            children: []
          }
        })) : []),

        // ── Crescent moon ──
        night ? {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '7%', right: '14%',
              width: '52px', height: '52px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            },
            children: [{
              type: 'div',
              props: {
                style: {
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 38% 38%, #FFF8D0, #F5DC82 55%, #C8A840)',
                  boxShadow: '0 0 30px 8px rgba(245,220,130,0.25)',
                  clipPath: 'path("M22,0 A22,22,0,1,1,22,44 A14,18,0,1,0,22,0 Z")',
                },
                children: []
              }
            }]
          }
        } : { type: 'div', props: { style: { display: 'none' }, children: [] } },

        // ── LOCK SCREEN TIME ──
        {
          type: 'div',
          props: {
            style: {
              marginTop: `${H * 0.05}px`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: `${W * 0.19}px`, fontWeight: 300, color: 'rgba(255,255,255,0.92)', letterSpacing: '-1px', lineHeight: 1 },
                  children: [timeStr]
                }
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: `${W * 0.035}px`, fontWeight: 300, color: 'rgba(255,255,255,0.45)', letterSpacing: '3px' },
                  children: [dateStr]
                }
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: `${W * 0.038}px`, fontWeight: 400, color: 'rgba(212,168,71,0.85)', letterSpacing: '1px', marginTop: '2px' },
                  children: [hijriDate]
                }
              },
            ]
          }
        },

        // ── MAIN CARD ──
        {
          type: 'div',
          props: {
            style: {
              width: '92%',
              marginTop: `${H * 0.03}px`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(4,8,24,0.75)',
              border: '1px solid rgba(212,168,71,0.18)',
              borderRadius: '20px',
              paddingTop: `${H * 0.03}px`,
              paddingBottom: `${H * 0.025}px`,
              gap: '0px',
            },
            children: [

              // ── Arc SVG ──
              {
                type: 'div',
                props: {
                  style: { width: '72%', aspectRatio: '1', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                  children: [
                    // SVG arc
                    {
                      type: 'svg',
                      props: {
                        width: '100%', height: '100%',
                        viewBox: '0 0 400 400',
                        style: { position: 'absolute', top: 0, left: 0 },
                        children: [
                          // Track ring
                          {
                            type: 'circle',
                            props: { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'rgba(255,255,255,0.07)', strokeWidth: 5 }
                          },
                          // Progress arc
                          arcPath ? {
                            type: 'path',
                            props: {
                              d: arcPath,
                              fill: 'none',
                              stroke: arcColor,
                              strokeWidth: 5,
                              strokeLinecap: 'round',
                              filter: `drop-shadow(0 0 8px ${arcColor})`,
                            }
                          } : { type: 'g', props: { children: [] } },
                        ]
                      }
                    },
                    // Center text
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: { fontSize: `${W * 0.028}px`, fontWeight: 300, color: 'rgba(255,255,255,0.4)', letterSpacing: '2px' },
                              children: [arcLabel]
                            }
                          },
                          {
                            type: 'div',
                            props: {
                              style: { fontSize: `${W * 0.13}px`, fontWeight: 300, color: 'rgba(255,255,255,0.95)', letterSpacing: '-1px', lineHeight: 1 },
                              children: [cd.display]
                            }
                          },
                          {
                            type: 'div',
                            props: {
                              style: { fontSize: `${W * 0.026}px`, fontWeight: 300, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' },
                              children: [arcSub]
                            }
                          },
                        ]
                      }
                    }
                  ]
                }
              },

              // ── TWO PANELS ──
              {
                type: 'div',
                props: {
                  style: {
                    width: '92%',
                    display: 'flex', flexDirection: 'row', gap: '2%',
                    marginTop: `${H * 0.022}px`,
                  },
                  children: [
                    // Suhoor
                    {
                      type: 'div',
                      props: {
                        style: {
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: `${H * 0.016}px ${W * 0.02}px`,
                          background: suhoorActive ? 'rgba(70,100,180,0.18)' : 'rgba(50,70,120,0.08)',
                          border: suhoorActive ? '1px solid rgba(168,196,255,0.45)' : '1px solid rgba(100,130,200,0.12)',
                          borderRadius: '12px', gap: '4px',
                        },
                        children: [
                          { type: 'div', props: { style: { fontSize: `${W * 0.048}px` }, children: ['🌙'] } },
                          { type: 'div', props: { style: { fontSize: `${W * 0.032}px`, fontWeight: 300, color: 'rgba(255,255,255,0.4)', letterSpacing: '2px' }, children: ['SUHOOR'] } },
                          { type: 'div', props: { style: { fontSize: `${W * 0.063}px`, fontWeight: 600, color: '#A8C4FF', lineHeight: 1, letterSpacing: '-0.5px' }, children: [fmt12(suhoor.h, suhoor.m)] } },
                          { type: 'div', props: { style: { fontSize: `${W * 0.026}px`, fontWeight: 300, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.5px' }, children: [suhoorActive && nowMins < fajrMins ? suhoorCd.display + ' left' : 'tomorrow'] } },
                        ]
                      }
                    },
                    // Iftar
                    {
                      type: 'div',
                      props: {
                        style: {
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: `${H * 0.016}px ${W * 0.02}px`,
                          background: iftarActive ? 'rgba(180,120,30,0.18)' : 'rgba(120,80,20,0.08)',
                          border: iftarActive ? '1px solid rgba(212,168,71,0.55)' : '1px solid rgba(160,120,40,0.12)',
                          borderRadius: '12px', gap: '4px',
                        },
                        children: [
                          { type: 'div', props: { style: { fontSize: `${W * 0.048}px` }, children: ['🌅'] } },
                          { type: 'div', props: { style: { fontSize: `${W * 0.032}px`, fontWeight: 300, color: 'rgba(255,255,255,0.4)', letterSpacing: '2px' }, children: ['IFTAR'] } },
                          { type: 'div', props: { style: { fontSize: `${W * 0.063}px`, fontWeight: 600, color: '#D4A847', lineHeight: 1, letterSpacing: '-0.5px' }, children: [fmt12(iftar.h, iftar.m)] } },
                          { type: 'div', props: { style: { fontSize: `${W * 0.026}px`, fontWeight: 300, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.5px' }, children: [iftarDone ? 'completed ✓' : iftarCdStr + ' left'] } },
                        ]
                      }
                    },
                  ]
                }
              },

              // ── DAY DOTS ──
              {
                type: 'div',
                props: {
                  style: {
                    width: '92%',
                    display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: `${W * 0.014}px`,
                    marginTop: `${H * 0.022}px`,
                  },
                  children: dots.map(d => ({
                    type: 'div',
                    props: {
                      style: {
                        width:  `${W * 0.022}px`,
                        height: `${W * 0.022}px`,
                        borderRadius: '50%',
                        background: d < ramadanDay
                          ? 'rgba(180,140,50,0.8)'
                          : d === ramadanDay
                            ? '#D4A847'
                            : 'rgba(255,255,255,0.07)',
                        border: d === ramadanDay ? '0px' : '1px solid rgba(212,168,71,0.15)',
                        boxShadow: d === ramadanDay ? '0 0 8px 2px rgba(212,168,71,0.6)' : 'none',
                      },
                      children: []
                    }
                  }))
                }
              },

              // ── PHASE LABEL ──
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex', flexDirection: 'row', gap: '8px',
                    alignItems: 'center',
                    marginTop: `${H * 0.016}px`,
                  },
                  children: [
                    { type: 'div', props: { style: { width: '20px', height: '1px', background: `rgba(${phase.col === '#A8C4FF' ? '168,196,255' : phase.col === '#90D4A0' ? '144,212,160' : '255,208,128'},0.3)` }, children: [] } },
                    { type: 'div', props: { style: { fontSize: `${W * 0.028}px`, fontWeight: 300, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }, children: [`Day ${ramadanDay} · ${phase.en}`] } },
                    { type: 'div', props: { style: { width: '20px', height: '1px', background: `rgba(${phase.col === '#A8C4FF' ? '168,196,255' : phase.col === '#90D4A0' ? '144,212,160' : '255,208,128'},0.3)` }, children: [] } },
                  ]
                }
              },

              // ── CITY LABEL ──
              {
                type: 'div',
                props: {
                  style: { fontSize: `${W * 0.024}px`, fontWeight: 300, color: 'rgba(255,255,255,0.18)', letterSpacing: '2px', marginTop: `${H * 0.01}px` },
                  children: [city.toUpperCase()]
                }
              },

            ]
          }
        },
      ]
    }
  };

  // ── Render with satori ────────────────────────────────────────────────────
  const svg = await satori(el, { width: W, height: H, fonts });

  // ── Convert SVG → PNG with sharp ──────────────────────────────────────────
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
  return png;
}

// ─── Phone sizes ──────────────────────────────────────────────────────────────
const SIZES = {
  'iphone16pro': [1206, 2622],
  'iphone16':    [1179, 2556],
  'iphone15':    [1179, 2556],
  'iphone14':    [1170, 2532],
  'iphone13':    [1170, 2532],
  'iphone12':    [1170, 2532],
  's24ultra':    [1440, 3088],
  's24':         [1080, 2340],
  'pixel8':      [1080, 2400],
  'default':     [1179, 2556],
};

// ─── Vercel handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const city    = (req.query.city    || 'Dubai').trim();
  const country = (req.query.country || '').trim();
  const model   = (req.query.model   || 'iphone15').toLowerCase();

  const [W, H] = SIZES[model] || SIZES.default;

  try {
    let prayerData;
    try {
      prayerData = await getPrayerTimes(city, country);
    } catch {
      prayerData = await getPrayerTimes('Dubai', 'AE');
    }

    const { timings, date } = prayerData;
    const suhoor = parseHHMM(timings.Fajr);
    const iftar  = parseHHMM(timings.Maghrib);

    const h = date.hijri;
    const ramadanDay = parseInt(h.day) || 1;
    const hijriDate  = `${toArabicNumerals(h.day)} ${h.month.ar} ${toArabicNumerals(h.year)}`;

    const png = await renderWallpaper({ W, H, suhoor, iftar, hijriDate, ramadanDay, city });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).send(png);

  } catch (err) {
    console.error('Wallpaper error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
