// ══════════════════════════════════════════════════════════════
// Sistema ROF™ — Backend API (Netlify Function)
// Rota base: /api/*  →  /.netlify/functions/api/*
// ══════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// ── Supabase client (service role — ignora RLS) ────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET      = 'rof-files';
const JWT_SECRET  = process.env.JWT_SECRET;
const APP_PASS    = process.env.APP_PASSWORD;

// ── Headers CORS ───────────────────────────────────────────────
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function ok(body, status = 200) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}
function err(msg, status = 400) {
  return { statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) };
}

// ── Extrair e verificar JWT ────────────────────────────────────
function auth(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token  = header.replace('Bearer ', '').trim();
  if (!token) throw new Error('no token');
  return jwt.verify(token, JWT_SECRET);
}

// ── Normalizar path (remove prefixos do Netlify) ──────────────
function parsePath(event) {
  const raw = event.path || '';
  return raw
    .replace(/\/.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    || '/';
}

// ── Handler principal ─────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({});

  const path   = parsePath(event);
  const method = event.httpMethod;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ok */ }

  // ────────────────────────────────────────────────────────────
  // POST /auth  — login, retorna JWT 30 dias
  // ────────────────────────────────────────────────────────────
  if (path === '/auth' && method === 'POST') {
    if (!body.password || body.password !== APP_PASS) {
      return err('Senha incorreta', 401);
    }
    const token = jwt.sign({ role: 'doctor' }, JWT_SECRET, { expiresIn: '30d' });
    return ok({ token });
  }

  // Todas as rotas abaixo exigem JWT válido
  try { auth(event); } catch {
    return err('Não autorizado', 401);
  }

  // ────────────────────────────────────────────────────────────
  // GET /data  — carrega todas as coleções de uma vez (bootstrap)
  // ────────────────────────────────────────────────────────────
  if (path === '/data' && method === 'GET') {
    const keys = ['rof_pts', 'rof_apts', 'rof_stk', 'rof_procs', 'rof_caixa', 'rof_leads'];
    const { data, error } = await supabase
      .from('rof_store')
      .select('key, data')
      .in('key', keys);

    if (error) return err(error.message, 500);

    const result = {};
    (data || []).forEach(row => {
      if (row.key === 'rof_pts')   result.patients     = row.data;
      if (row.key === 'rof_apts')  result.appointments = row.data;
      if (row.key === 'rof_stk')   result.inventory    = row.data;
      if (row.key === 'rof_procs') result.procedures   = row.data;
      if (row.key === 'rof_caixa') result.finance      = row.data;
      if (row.key === 'rof_leads') result.leads        = row.data;
    });
    return ok(result);
  }

  // ────────────────────────────────────────────────────────────
  // Helpers CRUD genérico para cada coleção
  // ────────────────────────────────────────────────────────────
  const COLLECTION_MAP = {
    '/patients':     'rof_pts',
    '/appointments': 'rof_apts',
    '/inventory':    'rof_stk',
    '/procedures':   'rof_procs',
    '/finance':      'rof_caixa',
    '/leads':        'rof_leads',
  };

  const storeKey = COLLECTION_MAP[path];
  if (storeKey) {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('rof_store')
        .select('data')
        .eq('key', storeKey)
        .single();
      if (error && error.code !== 'PGRST116') return err(error.message, 500);
      return ok(data?.data || []);
    }

    if (method === 'PUT') {
      const payload = Array.isArray(body) ? body : (body.data ?? []);
      const { error } = await supabase
        .from('rof_store')
        .upsert(
          { key: storeKey, data: payload },
          { onConflict: 'key' }
        );
      if (error) return err(error.message, 500);
      return ok({ ok: true });
    }
  }

  // ────────────────────────────────────────────────────────────
  // POST /upload  — faz upload de arquivo para Supabase Storage
  // Body: { data: "data:image/jpeg;base64,...", name, patientId, fileType, cat, titulo, date, obs }
  // Retorna: { url, fileId }
  // ────────────────────────────────────────────────────────────
  if (path === '/upload' && method === 'POST') {
    const { data: b64, name, patientId, fileType = 'foto', cat, titulo, date, obs } = body;

    if (!b64 || !patientId) return err('Dados incompletos');

    // Decodificar base64
    const match = b64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return err('Formato base64 inválido');
    const [, mimeType, base64Str] = match;
    const buffer = Buffer.from(base64Str, 'base64');

    const ext      = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
    const safeName = (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `patients/${patientId}/${fileType}/${Date.now()}-${safeName}`;

    // Upload para o bucket
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: false });

    if (upErr) return err(upErr.message, 500);

    // URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    // Registrar metadados na tabela rof_files
    const { data: fileRow, error: dbErr } = await supabase
      .from('rof_files')
      .insert({
        patient_id:   Number(patientId),
        file_type:    fileType,
        storage_path: filePath,
        url:          publicUrl,
        name:         name || safeName,
        cat:          cat || null,
        titulo:       titulo || null,
        date_ref:     date || null,
        obs:          obs || null,
      })
      .select('id')
      .single();

    if (dbErr) console.warn('rof_files insert error:', dbErr.message);

    return ok({ url: publicUrl, fileId: fileRow?.id });
  }

  // ────────────────────────────────────────────────────────────
  // DELETE /upload/:fileId  — remove arquivo do Storage + metadados
  // ────────────────────────────────────────────────────────────
  if (path.startsWith('/upload/') && method === 'DELETE') {
    const fileId = path.replace('/upload/', '');

    const { data: fileRow, error: fetchErr } = await supabase
      .from('rof_files')
      .select('storage_path')
      .eq('id', fileId)
      .single();

    if (fetchErr || !fileRow) return err('Arquivo não encontrado', 404);

    await supabase.storage.from(BUCKET).remove([fileRow.storage_path]);
    await supabase.from('rof_files').delete().eq('id', fileId);

    return ok({ ok: true });
  }

  return err('Rota não encontrada', 404);
};
