// FF_WEEKS ändrad till ['thisweek'] – nextweek finns inte som FF-endpoint
// Cloudflare Worker – Anthropic API proxy + Kanban API + Market Data Sync + Calendar
// Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, KANBAN_SECRET

const ALLOWED_ORIGINS = [
  'https://smc-trading-journal-dev.henrik-siverhall.workers.dev',
  'https://dev.journal.smctrading.se',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Kanban-Secret, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

const ADMIN_USER_ID = 'a55874aa-d36a-4d07-a40f-778b3a66d671';
const FF_WEEKS = ['thisweek'];  // nextweek-URL finns inte hos FF

const TRACKED_SYMBOLS = [
  { symbol: 'NQ=F',     label: 'NQ/MNQ – Nasdaq-100 futures' },
  { symbol: 'ES=F',     label: 'ES/MES – S&P 500 futures' },
  { symbol: 'YM=F',     label: 'YM/MYM – Dow Jones futures' },
  { symbol: 'RTY=F',    label: 'RTY/M2K – Russell 2000 futures' },
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD' },
  { symbol: 'USDCAD=X', label: 'USD/CAD' },
  { symbol: 'USDCHF=X', label: 'USD/CHF' },
  { symbol: 'NZDUSD=X', label: 'NZD/USD' },
  { symbol: 'EURGBP=X', label: 'EUR/GBP' },
  { symbol: 'EURJPY=X', label: 'EUR/JPY' },
  { symbol: 'GBPJPY=X', label: 'GBP/JPY' },
];

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

async function verifyAdminJWT(env, authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data?.id === ADMIN_USER_ID;
}

async function calendarReadCache(env, weekKey) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/calendar_cache?week_key=eq.${weekKey}&select=data,fetched_at`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

async function calendarWriteCache(env, weekKey, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/calendar_cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ week_key: weekKey, data, fetched_at: new Date().toISOString() }),
  });
  return res.ok;
}

async function calendarRefreshFromFF(env, weekKey) {
  const ffUrl = `https://nfs.faireconomy.media/ff_calendar_${weekKey}.json`;
  try {
    const resp = await fetch(ffUrl, { headers: { 'User-Agent': 'TradeLog/2.0 (+https://journal.smctrading.se)' } });
    if (!resp.ok) return { ok: false, error: `FF HTTP ${resp.status}` };
    const text = await resp.text();
    if (text.trim().startsWith('<')) return { ok: false, error: 'FF returned HTML – blocked or rate-limited' };
    let data; try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSON parse failed' }; }
    await calendarWriteCache(env, weekKey, data);
    return { ok: true, events: data.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });
    const url = new URL(request.url);

    if (url.pathname === '/calendar') {
      const safeWeek = 'thisweek';
      try {
        const cached = await calendarReadCache(env, safeWeek);
        if (!cached) return json(cors, { error: 'Ingen kalenderdata i cache.' }, 503);
        return new Response(JSON.stringify(cached.data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=3600', ...cors } });
      } catch (e) { return json(cors, { error: e.message }, 500); }
    }

    if (url.pathname === '/calendar/refresh') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const results = {};
      for (const week of FF_WEEKS) results[week] = await calendarRefreshFromFF(env, week);
      return json(cors, { refreshed: true, results });
    }

    if (url.pathname === '/calendar/refresh-admin') {
      const isAdmin = await verifyAdminJWT(env, request.headers.get('Authorization'));
      if (!isAdmin) return json(cors, { error: 'Unauthorized' }, 401);
      const results = {};
      for (const week of FF_WEEKS) results[week] = await calendarRefreshFromFF(env, week);
      return json(cors, { refreshed: true, results });
    }

    if (url.pathname === '/test-yahoo') {
      const symbol = url.searchParams.get('symbol') || 'NQ=F';
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, { headers: YAHOO_HEADERS });
        const text = await res.text();
        return json(cors, { status: res.status, ok: res.ok, bodyPreview: text.slice(0, 1500) });
      } catch (err) { return json(cors, { error: err.message }, 500); }
    }

    if (url.pathname === '/sync-market-data') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const symbolParam = url.searchParams.get('symbol');
      if (!symbolParam) return json(cors, { info: 'Specify ?symbol=XXX', availableSymbols: TRACKED_SYMBOLS.map(s => s.symbol) });
      const entry = TRACKED_SYMBOLS.find(s => s.symbol === symbolParam);
      if (!entry) return json(cors, { error: 'Unknown symbol' }, 400);
      return json(cors, await syncOneSymbol(env, entry));
    }

    if (url.pathname === '/sync-group') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const groupIndex = parseInt(url.searchParams.get('group') ?? '', 10);
      if (isNaN(groupIndex)) return json(cors, { error: 'Specify ?group=0 through ?group=4' }, 400);
      const group = TRACKED_SYMBOLS.slice(groupIndex * 3, groupIndex * 3 + 3);
      if (!group.length) return json(cors, { error: 'No symbols in that group' }, 400);
      const results = [];
      for (const entry of group) results.push(await syncOneSymbol(env, entry));
      return json(cors, { groupIndex, results });
    }

    if (url.pathname === '/sync-status') {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      const statuses = [];
      for (const { symbol, label } of TRACKED_SYMBOLS) {
        const existing = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&select=date&order=date.desc&limit=1`);
        const earliest = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&select=date&order=date.asc&limit=1`);
        statuses.push({ symbol, label, latestDate: existing?.[0]?.date || null, earliestDate: earliest?.[0]?.date || null });
      }
      return json(cors, { statuses });
    }

    if (url.pathname === '/market-data') {
      const symbol = url.searchParams.get('symbol'), from = url.searchParams.get('from'), to = url.searchParams.get('to');
      if (!symbol || !from || !to) return json(cors, { error: 'symbol, from, to required' }, 400);
      const data = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&date=gte.${from}&date=lte.${to}&select=date,bars&order=date.asc`);
      return json(cors, { symbol, from, to, days: data });
    }

    if (url.pathname === '/admin/update-user') {
      const isAdmin = await verifyAdminJWT(env, request.headers.get('Authorization'));
      if (!isAdmin) return json(cors, { error: 'Unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const { userId, updates } = body;
      if (!userId || !updates) return json(cors, { error: 'userId och updates kravs' }, 400);
      const safeUpdates = {};
      if (updates.email) safeUpdates.email = updates.email;
      if (Object.keys(safeUpdates).length === 0) return json(cors, { error: 'Inget giltigt falt' }, 400);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify(safeUpdates),
      });
      const data = await res.json();
      if (!res.ok) return json(cors, { error: data.message || 'Supabase-fel' }, res.status);
      return json(cors, { success: true, email: data.email });
    }

    if (url.pathname.startsWith('/kanban')) {
      const secret = request.headers.get('X-Kanban-Secret');
      if (secret !== env.KANBAN_SECRET) return json(cors, { error: 'Unauthorized' }, 401);
      if (url.pathname === '/kanban/read') return await kanbanRead(env, cors);
      const body = await request.json().catch(() => ({}));
      if (url.pathname === '/kanban/update') return await kanbanUpdate(env, body, cors);
      if (url.pathname === '/kanban/add')    return await kanbanAdd(env, body, cors);
      if (url.pathname === '/kanban/delete') return await kanbanDelete(env, body, cors);
      return json(cors, { error: 'Unknown endpoint' }, 404);
    }

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    try {
      const body = await request.json();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      return json(cors, await response.json());
    } catch (err) { return json(cors, { error: err.message }, 500); }
  },

  async scheduled(event, env, ctx) {
    for (const week of FF_WEEKS) {
      const result = await calendarRefreshFromFF(env, week);
      console.log(`Calendar refresh [${week}]:`, JSON.stringify(result));
    }
    const cronExpr = event.cron;
    const minuteMatch = cronExpr.match(/^(\d+)\s/);
    const minute = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
    const group = TRACKED_SYMBOLS.slice(Math.round(minute / 5) * 3, Math.round(minute / 5) * 3 + 3);
    if (group.length) {
      const results = [];
      for (const entry of group) results.push(await syncOneSymbol(env, entry));
      console.log(`Market sync:`, JSON.stringify(results));
    }
  },
};

function json(cors, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function supabaseFetch(env, path, method = 'GET', body = null) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : undefined },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Supabase ${method} ${path}: ${res.status} ${t}`); }
  return res.json();
}

async function syncOneSymbol(env, { symbol, label }) {
  const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  try {
    const existing = await supabaseFetch(env, `market_bars?symbol=eq.${encodeURIComponent(symbol)}&interval=eq.5m&select=date&order=date.desc&limit=1`);
    const latestCached = existing?.[0]?.date || null;
    if (latestCached && latestCached >= yesterdayStr) return { symbol, label, status: 'up_to_date', latestCached };
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=60d`, { headers: YAHOO_HEADERS });
    const rawText = await res.text();
    if (!res.ok) return { symbol, label, status: 'error', error: `Yahoo HTTP ${res.status}` };
    if (!rawText?.trim()) return { symbol, label, status: 'error', error: 'Empty response' };
    let data; try { data = JSON.parse(rawText); } catch (e) { return { symbol, label, status: 'error', error: 'JSON parse failed' }; }
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return { symbol, label, status: 'error', error: 'No timestamp data' };
    const quote = result.indicators.quote[0], timestamps = result.timestamp;
    const gmtOffset = result.meta?.gmtoffset || -18000, byDate = {};
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] == null) continue;
      const dateStr = new Date((timestamps[i] + gmtOffset) * 1000).toISOString().slice(0, 10);
      if (!byDate[dateStr]) byDate[dateStr] = [];
      const t = new Date(timestamps[i] * 1000);
      byDate[dateStr].push({ time: `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`, open: quote.open[i], high: quote.high[i], low: quote.low[i], close: quote.close[i], volume: quote.volume[i] });
    }
    const datesToSave = Object.keys(byDate).filter(d => (!latestCached || d > latestCached) && d <= yesterdayStr);
    if (datesToSave.length > 0) await supabaseFetch(env, 'market_bars', 'POST', datesToSave.map(d => ({ symbol, interval: '5m', date: d, bars: byDate[d] })));
    return { symbol, label, status: 'synced', daysSaved: datesToSave.length };
  } catch (err) { return { symbol, label, status: 'error', error: err.message }; }
}

async function getSettings(env) {
  const data = await supabaseFetch(env, `user_settings?user_id=eq.${ADMIN_USER_ID}&select=settings`);
  return data?.[0]?.settings || {};
}
async function saveSettings(env, settings) {
  await supabaseFetch(env, `user_settings?user_id=eq.${ADMIN_USER_ID}`, 'PATCH', { settings, updated_at: new Date().toISOString() });
}
async function kanbanRead(env, cors) { const s = await getSettings(env); return json(cors, { tasks: s.roadmapTasks || [] }); }
async function kanbanUpdate(env, body, cors) {
  const { id, ...updates } = body; if (!id) return json(cors, { error: 'id required' }, 400);
  const s = await getSettings(env); const tasks = s.roadmapTasks || [];
  const idx = tasks.findIndex(t => t.id === id); if (idx === -1) return json(cors, { error: 'Not found' }, 404);
  tasks[idx] = { ...tasks[idx], ...updates, updated_at: new Date().toISOString() };
  await saveSettings(env, { ...s, roadmapTasks: tasks }); return json(cors, { success: true, task: tasks[idx] });
}
async function kanbanAdd(env, body, cors) {
  const { title, desc = '', category = 'feature', priority = 'medium', status = 'todo' } = body;
  if (!title) return json(cors, { error: 'title required' }, 400);
  const s = await getSettings(env); const tasks = s.roadmapTasks || [];
  const t = { id: 't' + Date.now(), title, desc, category, priority, status, created_at: new Date().toISOString(), updated_at: '' };
  tasks.push(t); await saveSettings(env, { ...s, roadmapTasks: tasks }); return json(cors, { success: true, task: t });
}
async function kanbanDelete(env, body, cors) {
  const { id } = body; if (!id) return json(cors, { error: 'id required' }, 400);
  const s = await getSettings(env);
  await saveSettings(env, { ...s, roadmapTasks: (s.roadmapTasks || []).filter(t => t.id !== id) });
  return json(cors, { success: true });
}
