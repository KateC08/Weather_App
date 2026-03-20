const supabaseUrl = "https://saawgnizjfsepeooahsk.supabase.co";
const supabaseKey = "sb_publishable_H5IRLcvWEIFWWFC1pUI2fw_lmDJD9V_";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ── FABRIC CONFIG ──
const FABRICS = {
    polo:  { label: 'Polo / Shirt',   mult: 1.0 },
    pe:    { label: 'PE Uniform',     mult: 0.75 },
    pants: { label: 'Pants / Slacks', mult: 1.4 },
    socks: { label: 'Socks',          mult: 0.5 },
    dress: { label: 'Dress / Skirt',  mult: 1.2 }
};

let currentFabric = 'polo';
let lastSensorRow = null;
let weatherData   = null;
let userCoords    = null;
let scoreHistory  = [];
let notifEnabled  = false;
let notifDryFired = false;
let notifRainFired = false;

// ── SAFE DOM HELPER — never crashes on missing element ──
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}
function setHtml(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
}

// ── DATE DISPLAY ──
function setDate() {
    const now = new Date();
    setText("date-display",
        now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }));
}
setDate();

// ── FABRIC SELECTOR ──
function selectFabric(btn) {
    document.querySelectorAll('.fab-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFabric = btn.dataset.key;
    if (lastSensorRow) updateUI(lastSensorRow);
    lucide.createIcons();
}

// ── GEOLOCATION + OPEN-METEO ──
function initLocation() {
    if (!navigator.geolocation) {
        setText('location-name', 'Manolo Fortich, Northern Mindanao');
        fetchWeatherByCoords(8.3667, 124.8667);
        return;
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            reverseGeocode(userCoords.lat, userCoords.lon);
            fetchWeatherByCoords(userCoords.lat, userCoords.lon);
        },
        () => {
            setText('location-name', 'Manolo Fortich, Northern Mindanao');
            fetchWeatherByCoords(8.3667, 124.8667);
        },
        { timeout: 8000 }
    );
}

async function reverseGeocode(lat, lon) {
    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const d = await r.json();
        const city  = d.address.city || d.address.town || d.address.municipality || d.address.village || '';
        const state = d.address.state || '';
        setText('location-name', [city, state].filter(Boolean).join(', ') || 'Your Location');
    } catch {
        setText('location-name', 'Manolo Fortich, Northern Mindanao');
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
            + `&hourly=uv_index,precipitation_probability,windspeed_10m,relativehumidity_2m,temperature_2m`
            + `&forecast_days=1&timezone=auto`;
        const r = await fetch(url);
        weatherData = await r.json();
        updateWeatherExtras();
        buildTimeline();
    } catch (e) {
        console.warn('Open-Meteo fetch failed:', e);
    }
}

// ── CURRENT HOUR INDEX ──
function getCurrentHourIndex() {
    if (!weatherData) return -1;
    const h = new Date().getHours();
    return weatherData.hourly.time.findIndex(t => new Date(t).getHours() === h);
}

// ── WEATHER EXTRAS (UV / Wind / Rain) ──
function updateWeatherExtras() {
    if (!weatherData) return;
    const idx = getCurrentHourIndex();
    if (idx < 0) return;

    const uv   = weatherData.hourly.uv_index[idx] ?? 0;
    const wind = weatherData.hourly.windspeed_10m[idx] ?? 0;

    // Check rain in next 3 hours
    const nextRains = [];
    for (let i = idx; i < Math.min(idx + 3, weatherData.hourly.precipitation_probability.length); i++) {
        nextRains.push(weatherData.hourly.precipitation_probability[i]);
    }
    const maxRain = Math.max(...nextRains);

    // UV
    setText('uv-num', uv.toFixed(1));
    let uvColor = '#4ade80', uvLabel = 'Low — normal drying';
    if (uv >= 8)      { uvColor = '#f87171'; uvLabel = 'Very High — fast drying!'; }
    else if (uv >= 6) { uvColor = '#ffc107'; uvLabel = 'High — speeds up drying'; }
    else if (uv >= 3) { uvColor = '#38bdf8'; uvLabel = 'Moderate — good drying'; }
    const uvBar = document.getElementById('uv-bar');
    const uvLbl = document.getElementById('uv-lbl');
    if (uvBar) { uvBar.style.width = Math.min(100, (uv / 11) * 100) + '%'; uvBar.style.background = uvColor; }
    if (uvLbl) { uvLbl.innerText = uvLabel; uvLbl.style.color = uvColor; }

    // Wind
    const windBonus = Math.round(wind * 2.5);
    let windColor = '#7d93ab', windLabel = 'Calm';
    if (wind >= 20)      { windColor = '#4ade80'; windLabel = `Strong — saves ~${windBonus} min`; }
    else if (wind >= 10) { windColor = '#38bdf8'; windLabel = `Moderate — saves ~${windBonus} min`; }
    else if (wind >= 5)  { windColor = '#ffc107'; windLabel = `Light — saves ~${windBonus} min`; }
    const windNum = document.getElementById('wind-num');
    const windBar = document.getElementById('wind-bar');
    const windLbl = document.getElementById('wind-lbl');
    if (windNum) windNum.innerHTML = `${Math.round(wind)} <span class="extra-unit">km/h</span>`;
    if (windBar) { windBar.style.width = Math.min(100, (wind / 50) * 100) + '%'; windBar.style.background = windColor; }
    if (windLbl) { windLbl.innerText = windLabel; windLbl.style.color = windColor; }

    // Rain
    setText('rain-prob', Math.round(maxRain) + '%');
    let rainColor = '#4ade80', rainLabel = 'No rain expected', rainHint = 'Safe to hang clothes';
    if (maxRain >= 70)      { rainColor = '#f87171'; rainLabel = 'Rain very likely!'; rainHint = 'Avoid hanging outside'; }
    else if (maxRain >= 40) { rainColor = '#ffc107'; rainLabel = 'Possible rain'; rainHint = 'Watch the sky'; }
    const rainBar = document.getElementById('rain-bar');
    const rainLbl = document.getElementById('rain-lbl');
    if (rainBar) { rainBar.style.width = maxRain + '%'; rainBar.style.background = rainColor; }
    if (rainLbl) { rainLbl.innerText = rainLabel; rainLbl.style.color = rainColor; }
    setText('rain-hint', rainHint);

    // Rain strip in score card
    const strip = document.getElementById('rain-strip');
    if (strip) {
        strip.style.display = 'flex';
        if (maxRain >= 40) {
            strip.className = 'rain-strip warn';
            strip.innerHTML = `⚠ Rain ${Math.round(maxRain)}% in next 3h — bring clothes in early`;
        } else {
            strip.className = 'rain-strip safe';
            strip.innerHTML = `✓ No rain expected before clothes dry`;
        }
    }
}

// ── TIMELINE ──
function buildTimeline() {
    if (!weatherData) return;
    const slots = document.getElementById('timeline-slots');
    if (!slots) return;
    slots.innerHTML = '';
    const currentH = new Date().getHours();

    for (let h = 6; h <= 19; h++) {
        const idx = weatherData.hourly.time.findIndex(t => new Date(t).getHours() === h);
        if (idx < 0) continue;

        const rh   = weatherData.hourly.relativehumidity_2m[idx] ?? 70;
        const uv   = weatherData.hourly.uv_index[idx] ?? 2;
        const rain = weatherData.hourly.precipitation_probability[idx] ?? 0;
        const temp = weatherData.hourly.temperature_2m[idx] ?? 28;

        let score = calcDryingScore(temp, rh);
        if (uv >= 6)   score = Math.min(100, score + 10);
        if (rain >= 50) score = Math.max(0, score - 30);

        const isNow = h === currentH;
        const barH  = Math.max(4, (score / 100) * 58);
        let color = '#3f566e';
        if (rain >= 60)    color = '#38bdf8';
        else if (score >= 75) color = '#4ade80';
        else if (score >= 50) color = '#ffc107';

        const lbl  = h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`;
        const slot = document.createElement('div');
        slot.className = 'tl-slot';
        slot.title = `${lbl}: Score ${score}, Rain ${rain}%`;
        slot.innerHTML = `
            <div class="tl-bar${isNow ? ' is-now' : ''}"
                 style="height:${barH}px;background:${color};opacity:${h < currentH ? 0.35 : 1}">
            </div>
            <div class="tl-time${isNow ? ' now' : ''}">${isNow ? '▲' : lbl}</div>
        `;
        slots.appendChild(slot);
    }
}

// ── HEAT INDEX ──
function calculateHeatIndex(temp, humidity) {
    if (temp < 26) return Math.round(temp);
    const hi = -8.78469475556 + 1.61139411 * temp + 2.33854883889 * humidity
        - 0.14611605 * temp * humidity - 0.012308094 * temp * temp
        - 0.0164248277778 * humidity * humidity + 0.002211732 * temp * temp * humidity
        + 0.00072546 * temp * humidity * humidity - 0.000003582 * temp * temp * humidity * humidity;
    return Math.round(hi);
}

// ── DRYING SCORE ──
function calcDryingScore(temp, hum) {
    let score = 50;
    if (temp >= 30 && temp <= 36) score += 25;
    else if (temp >= 27) score += 15;
    else if (temp >= 24) score += 5;
    else score -= 10;

    if (hum <= 55)      score += 25;
    else if (hum <= 65) score += 15;
    else if (hum <= 75) score += 5;
    else if (hum <= 85) score -= 10;
    else                score -= 25;

    return Math.min(100, Math.max(0, Math.round(score)));
}

// ── SUNSET ──
function minutesUntilSunset() {
    const now = new Date();
    const sunset = new Date();
    sunset.setHours(18, 14, 0, 0);
    return Math.max(0, Math.round((sunset - now) / 60000));
}

function formatMinsLeft(mins) {
    if (mins <= 0) return "Past sunset";
    const h = Math.floor(mins / 60), m = mins % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function getDryFinishTime(dryHours) {
    if (!dryHours) return "N/A";
    const finish = new Date(Date.now() + dryHours * 3600000);
    return finish.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function willDryBefore7AM(dryHours) {
    if (!dryHours) return false;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(7, 0, 0, 0);
    return new Date(Date.now() + dryHours * 3600000) <= deadline;
}

// ── SCORE RING ──
function animateRing(score) {
    const ring = document.getElementById('ring-fill');
    if (!ring) return;
    ring.style.strokeDashoffset = 207.3 - (score / 100) * 207.3;
    ring.style.stroke = score >= 70 ? '#4ade80' : score >= 45 ? '#ffc107' : '#f87171';
}

// ── CHIP TAGS ──
function setTag(id, level, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'chip-tag ' + (level === 'good' ? 'tag-good' : level === 'ok' ? 'tag-ok' : 'tag-bad');
    el.innerText = text;
}

// ── SPARKLINE ──
function updateSparkline() {
    const wrap = document.getElementById('sparkline-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    const history = scoreHistory.slice(-8);
    const max = Math.max(...history, 1);
    history.forEach(s => {
        const bar = document.createElement('div');
        bar.className = 'spark-bar';
        bar.style.cssText = `height:${Math.max(3, (s / max) * 40)}px;background:${
            s >= 75 ? '#4ade80' : s >= 50 ? '#ffc107' : '#3f566e'};`;
        bar.title = `Score: ${s}`;
        wrap.appendChild(bar);
    });
}

// ── DRY TIME ──
function calcDryHours(t, h, isNight) {
    if (h > 90) return null;

    let base = 3.5;
    if (t >= 32)      base -= 1;
    else if (t >= 28) base -= 0.5;
    else if (t < 25)  base += 1;

    if (h > 80)      base += 2;
    else if (h > 70) base += 1;
    else if (h < 60) base -= 0.5;

    if (isNight) base += 2;

    base *= FABRICS[currentFabric]?.mult ?? 1;

    if (weatherData) {
        const idx = getCurrentHourIndex();
        if (idx >= 0) {
            const wind = weatherData.hourly.windspeed_10m[idx] ?? 0;
            base = Math.max(0.5, base - (wind * 2.5) / 60);
        }
    }

    return Math.max(0.5, Math.round(base * 10) / 10);
}

// ── VIBE CARD ──
function updateVibeCard(score, isNight) {
    const iconWrap = document.getElementById("vibe-icon-wrap");
    const title    = document.getElementById("vibe-title");
    const text     = document.getElementById("vibe-text");
    if (!iconWrap || !title || !text) return;

    let icon, titleTxt, textTxt;
    if (isNight) {
        icon = `<i data-lucide="moon-star" style="color:#38bdf8;width:80px;height:80px;"></i>`;
        titleTxt = "Pahuway sa, Bes! 🌙";
        textTxt  = "Gabi na. Ugma na ta mag-sampay para hayag!";
    } else if (score >= 75) {
        icon = `<i data-lucide="shirt" style="color:#4ade80;width:80px;height:80px;"></i>`;
        titleTxt = "Labada na, Friend! ✨";
        textTxt  = "Grabe ka nindot sa panahon! Bisan tulo ka uniform, uga jud dayon ni!";
    } else if (score >= 50) {
        icon = `<i data-lucide="cloud-sun" style="color:#ffc107;width:80px;height:80px;"></i>`;
        titleTxt = "Keri pa maglaba! 👍";
        textTxt  = "Hayag pa gamay. Isampay na dayon para uga na before sunset!";
    } else {
        icon = `<i data-lucide="cloud-rain" style="color:#f87171;width:80px;height:80px;"></i>`;
        titleTxt = "Pass sa ta run... 🛑";
        textTxt  = "Basin manimaho tag-as (kulob) imong uniform. Pa-uga lang sa fan!";
    }

    iconWrap.innerHTML = icon;
    title.innerText    = titleTxt;
    text.innerText     = textTxt;
    lucide.createIcons();
}

// ── NOTIFICATIONS ──
function requestNotification() {
    if (!('Notification' in window)) { alert('Notifications not supported.'); return; }
    Notification.requestPermission().then(perm => {
        if (perm !== 'granted') return;
        notifEnabled = true;
        const btn = document.getElementById('notif-btn');
        if (btn) { btn.innerText = '✓ Enabled'; btn.classList.add('enabled'); }
        setText('notif-sub', 'You will be notified when clothes are dry or rain is approaching.');
        new Notification('UniWeather', { body: "Notifications enabled! We'll alert you when ready." });
    });
}

function maybeSendNotif(dryHours, rainPct) {
    if (!notifEnabled || Notification.permission !== 'granted') return;
    if (dryHours && !notifDryFired && dryHours * 60 <= 15) {
        notifDryFired = true;
        new Notification('UniWeather — Clothes Ready! 👕', {
            body: `Your ${FABRICS[currentFabric].label} should be dry now. Bring them in!`
        });
    }
    if (rainPct >= 60 && !notifRainFired) {
        notifRainFired = true;
        new Notification('UniWeather — Rain Alert! 🌧', {
            body: `Rain ${Math.round(rainPct)}% likely. Bring your clothes inside soon!`
        });
    }
}

// ── MAIN UI ──
function updateUI(row) {
    try {
        lastSensorRow = row;
        const t = row.temperature;
        const h = row.humidity;
        const hi = calculateHeatIndex(t, h);
        const minsLeft = minutesUntilSunset();
        const isNight  = minsLeft <= 0;

        const dryHours = calcDryHours(t, h, isNight);
        const finishTime = getDryFinishTime(dryHours);
        const canDryBeforeClass = willDryBefore7AM(dryHours);

        const baseScore    = calcDryingScore(t, h);
        const displayScore = isNight ? Math.round(baseScore * 0.6) : baseScore;

        scoreHistory.push(displayScore);
        if (scoreHistory.length > 20) scoreHistory.shift();
        updateSparkline();

        // Hidden elements (still needed by JS)
        setText("temp",       Math.round(t));
        setText("feels-like", hi);
        setText("hum",        Math.round(h));

        // Vibe card meta row
        setText("temp-desc",  hi > 35 ? "Mainit sobra 🔥" : "Sakto lang 👌");
        setText("hum-advice", h > 80  ? "Humid kaayo 😓"  : "Dry air 👍");
        setText("safety-msg-mini", h > 85 ? "Alert" : "Stable");

        // Humidity bar (hidden but updated)
        const humBar = document.getElementById("hum-progress");
        if (humBar) {
            humBar.style.width      = Math.min(100, h) + "%";
            humBar.style.background = h > 80 ? '#f87171' : h > 65 ? '#ffc107' : '#4ade80';
        }

        // Score ring
        document.getElementById("score-num").innerText = displayScore;
        animateRing(displayScore);

        // Vibe card
        updateVibeCard(displayScore, isNight);

        // Score title/sub
        if (isNight) {
            setText("score-title", "Night Mode 🌙");
            setText("score-sub",   "Drying is slower tonight. Use a fan.");
        } else if (displayScore >= 70) {
            setText("score-title", "Wash Now! ✅");
            setText("score-sub",   `Dries in ~${dryHours}h (${FABRICS[currentFabric].label})`);
        } else if (displayScore >= 45) {
            setText("score-title", "Pwede na 👍");
            setText("score-sub",   `~${dryHours}h drying time`);
        } else {
            setText("score-title", "Wag muna ❌");
            setText("score-sub",   "Too humid. Risk of amoy kulob.");
        }

        // Window pill
        setText("window-text", isNight
            ? "Past sunset — wash tomorrow morning"
            : `Hang now — ${formatMinsLeft(minsLeft)} sunlight left`);

        // Chips
        setText("f-temp",      Math.round(t) + "°C");
        setText("f-hum",       Math.round(h) + "%");
        setText("f-hi",        hi + "°C");
        setText("f-dry",       dryHours ? dryHours + "h" : "N/A");
        setText("f-dry-label", FABRICS[currentFabric].label);

        setTag("ft-temp", t >= 28 ? 'good' : 'ok',                       'Temp');
        setTag("ft-hum",  h <= 65 ? 'good' : 'ok',                       'Humidity');
        setTag("ft-hi",   hi <= 32 ? 'good' : 'ok',                      'Heat');
        setTag("ft-dry",  !dryHours ? 'bad' : dryHours <= 3 ? 'good' : 'ok', 'Dry');

        // Laundry card
        if (!dryHours) {
            setText("laundry-status",  "DO NOT WASH ❌");
            setText("laundry-advice",  "Too humid. Clothes won't dry.");
        } else {
            setText("laundry-status",  isNight ? `~${dryHours}h (with fan)` : `Dry in ~${dryHours}h`);
            setText("laundry-advice",  `Ready by ${finishTime} ${canDryBeforeClass ? "(before 7AM ✅)" : "(too late ❌)"}`);
        }

        setText("tip-text", isNight && h > 70
            ? "Use fan overnight for faster drying."
            : "Bring clothes inside before evening.");

        // Insight card
        setText("safety-msg", h > 85
            ? "Too humid — drying will struggle 😬"
            : "Good drying conditions 👍");

        const safetyIcon = document.getElementById("safety-icon");
        if (safetyIcon) {
            safetyIcon.style.background = h > 85
                ? 'rgba(248,113,113,0.1)'
                : 'rgba(74,222,128,0.1)';
        }

        // Sunlight + timestamp
        setText("mins-left-text", isNight ? "0m" : formatMinsLeft(minsLeft));
        setText("time", "Last update: " + new Date(row.created_at).toLocaleTimeString('en-PH'));

        // Open-Meteo extras
        updateWeatherExtras();
        buildTimeline();

        // Notifications
        const rainPct = weatherData
            ? (weatherData.hourly.precipitation_probability[getCurrentHourIndex()] ?? 0)
            : 0;
        maybeSendNotif(dryHours, rainPct);

    } catch (err) {
        console.error('updateUI error:', err);
    }
}

// ── FETCH ──
async function fetchData() {
    try {
        const { data, error } = await supabaseClient
            .from('weather_data')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        if (error) { console.error('Supabase error:', error); return; }
        if (data && data.length > 0) updateUI(data[0]);
    } catch (err) {
        console.error('fetchData error:', err);
    }
}

// ── REALTIME ──
supabaseClient.channel('weather_data')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weather_data' },
        payload => updateUI(payload.new))
    .subscribe();

// Open-Meteo refresh every 15 min
setInterval(() => {
    if (userCoords) fetchWeatherByCoords(userCoords.lat, userCoords.lon);
}, 15 * 60 * 1000);

// Sensor refresh every 5s
setInterval(fetchData, 5000);

// Boot
initLocation();
fetchData();

// ── CSV DOWNLOAD ──
async function downloadCSV() {
    const btn     = document.getElementById('csv-btn');
    const limitEl = document.getElementById('csv-limit');
    const subEl   = document.getElementById('csv-sub');
    const limit   = parseInt(limitEl?.value ?? '100');

    if (btn) { btn.disabled = true; btn.innerText = 'Fetching...'; }

    try {
        let query = supabaseClient
            .from('weather_data')
            .select('created_at, temperature, humidity')
            .order('created_at', { ascending: false });

        if (limit > 0) query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
            if (subEl) subEl.innerText = 'No data found in database.';
            return;
        }

        // Build CSV — only timestamp, temperature, humidity
        const headers = ['timestamp', 'temperature', 'humidity'];
        const rows = data.map(row => [
            row.created_at ?? '',
            row.temperature ?? '',
            row.humidity ?? ''
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');

        // Trigger download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const now  = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
        a.href     = url;
        a.download = `uniweather_${now}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        if (subEl) subEl.innerText = `Downloaded ${data.length} rows ✓`;
        setTimeout(() => {
            if (subEl) subEl.innerText = 'Download your weather readings as a CSV file';
        }, 3000);

    } catch (err) {
        console.error('CSV download error:', err);
        if (subEl) subEl.innerText = 'Download failed. Check console.';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="download" class="icon-xs"></i> Download CSV';
            lucide.createIcons();
        }
    }
}