const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET = 'rof-files';
const JWT_SECRET = process.env.JWT_SECRET;
const APP_PASS = process.env.APP_PASSWORD;

const STORE_KEYS = [
  'rof_pts',
  'rof_apts',
  'rof_stk',
  'rof_procs',
  'rof_caixa',
  'rof_leads',
  'rof_whats_templates',
  'rof_orientacoes',
];

const COLLECTION_MAP = {
  '/patients': 'rof_pts',
  '/appointments': 'rof_apts',
  '/inventory': 'rof_stk',
  '/procedures': 'rof_procs',
  '/finance': 'rof_caixa',
  '/leads': 'rof_leads',
  '/whatsapp-templates': 'rof_whats_templates',
  '/orientacoes': 'rof_orientacoes',
};

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function ok(body, status = 200) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

function err(message, status = 400) {
  return ok({ error: message }, status);
}

function parsePath(event) {
  const raw = event.path || '';
  return raw
    .replace(/\/.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    || '/';
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function requireServerConfig() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase env vars are missing');
  }
  if (!JWT_SECRET || !APP_PASS) {
    throw new Error('Auth env vars are missing');
  }
}

function requireAuth(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.replace('Bearer ', '').trim();
  if (!token) throw new Error('no token');
  return jwt.verify(token, JWT_SECRET);
}

function isStoreKey(key) {
  return STORE_KEYS.includes(key);
}

async function getStoreRows(keys = STORE_KEYS) {
  const { data, error } = await supabase
    .from('rof_store')
    .select('key, data')
    .in('key', keys);

  if (error) throw error;
  return data || [];
}

async function getStoreKey(key) {
  if (!isStoreKey(key)) {
    const e = new Error('Chave invalida');
    e.status = 404;
    throw e;
  }

  const { data, error } = await supabase
    .from('rof_store')
    .select('data')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data?.data || [];
}

async function putStoreKey(key, payload) {
  if (!isStoreKey(key)) {
    const e = new Error('Chave invalida');
    e.status = 404;
    throw e;
  }

  const { error } = await supabase
    .from('rof_store')
    .upsert({ key, data: payload }, { onConflict: 'key' });

  if (error) throw error;
}

function dataObjectFromRows(rows) {
  const result = {};
  rows.forEach((row) => {
    if (row.key === 'rof_pts') result.patients = row.data;
    if (row.key === 'rof_apts') result.appointments = row.data;
    if (row.key === 'rof_stk') result.inventory = row.data;
    if (row.key === 'rof_procs') result.procedures = row.data;
    if (row.key === 'rof_caixa') result.finance = row.data;
    if (row.key === 'rof_leads') result.leads = row.data;
    if (row.key === 'rof_whats_templates') result.whatsappTemplates = row.data;
    if (row.key === 'rof_orientacoes') result.orientacoes = row.data;
  });
  return result;
}

async function handlePublicIntake(path, method, body) {
  if (path === '/public-intake' && method === 'POST') {
    const label = String(body?.dr_label || body?.name || 'Cadastro publico sem nome').trim();
    const payload = body?.data || {};
    const { data, error } = await supabase
      .from('rof_intake')
      .insert({
        dr_label: `Public - ${label}`,
        data: payload,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return ok({ id: data.id });
  }

  if (!path.startsWith('/public-intake/')) return null;

  const id = decodeURIComponent(path.replace('/public-intake/', ''));

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('rof_intake')
      .select('id, status, data, dr_label')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return err('Cadastro nao encontrado', 404);
    return ok(data);
  }

  if (method === 'PUT') {
    const { data, error } = await supabase
      .from('rof_intake')
      .update({
        data: body?.data || {},
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return err('Cadastro ja enviado ou nao encontrado', 409);
    return ok({ ok: true });
  }

  return err('Metodo nao permitido', 405);
}

async function handleIntakes(path, method, body) {
  if (path === '/intakes' && method === 'GET') {
    const { data, error } = await supabase
      .from('rof_intake')
      .select('*')
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ok(data || []);
  }

  if (path === '/intakes' && method === 'POST') {
    const label = String(body?.dr_label || '').trim();
    if (!label) return err('Identificacao obrigatoria', 400);

    const { data, error } = await supabase
      .from('rof_intake')
      .insert({ dr_label: label, status: 'pending' })
      .select('*')
      .single();

    if (error) throw error;
    return ok(data, 201);
  }

  if (path.startsWith('/intakes/') && method === 'PUT') {
    const id = decodeURIComponent(path.replace('/intakes/', ''));
    const status = body?.status;

    if (!['pending', 'submitted', 'approved', 'rejected'].includes(status)) {
      return err('Status invalido', 400);
    }

    const { error } = await supabase
      .from('rof_intake')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    return ok({ ok: true });
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({});

  const path = parsePath(event);
  const method = event.httpMethod;
  const body = parseBody(event);

  try {
    requireServerConfig();

    if (path === '/auth' && method === 'POST') {
      if (!body.password || body.password !== APP_PASS) {
        return err('Senha incorreta', 401);
      }

      const token = jwt.sign({ role: 'doctor' }, JWT_SECRET, { expiresIn: '30d' });
      return ok({ token });
    }

    const publicIntake = await handlePublicIntake(path, method, body);
    if (publicIntake) return publicIntake;

    try {
      requireAuth(event);
    } catch {
      return err('Nao autorizado', 401);
    }

    if (path === '/data' && method === 'GET') {
      const rows = await getStoreRows();
      return ok(dataObjectFromRows(rows));
    }

    if (path === '/store' && method === 'GET') {
      return ok(await getStoreRows());
    }

    if (path.startsWith('/store/')) {
      const key = decodeURIComponent(path.replace('/store/', ''));
      if (method === 'GET') return ok(await getStoreKey(key));
      if (method === 'PUT') {
        await putStoreKey(key, Array.isArray(body) ? body : (body.data ?? []));
        return ok({ ok: true });
      }
    }

    const intakes = await handleIntakes(path, method, body);
    if (intakes) return intakes;

    const storeKey = COLLECTION_MAP[path];
    if (storeKey) {
      if (method === 'GET') return ok(await getStoreKey(storeKey));
      if (method === 'PUT') {
        await putStoreKey(storeKey, Array.isArray(body) ? body : (body.data ?? []));
        return ok({ ok: true });
      }
    }

    if (path === '/upload' && method === 'POST') {
      const { data: b64, name, patientId, fileType = 'foto', cat, titulo, date, obs } = body;

      if (!b64 || !patientId) return err('Dados incompletos', 400);

      const match = String(b64).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return err('Formato base64 invalido', 400);

      const [, mimeType, base64Str] = match;
      const buffer = Buffer.from(base64Str, 'base64');
      const safeName = (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `patients/${patientId}/${fileType}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType: mimeType, upsert: false });

      if (upErr) return err(upErr.message, 500);

      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      const { data: fileRow, error: dbErr } = await supabase
        .from('rof_files')
        .insert({
          patient_id: Number(patientId),
          file_type: fileType,
          storage_path: filePath,
          url: publicData.publicUrl,
          name: name || safeName,
          cat: cat || null,
          titulo: titulo || null,
          date_ref: date || null,
          obs: obs || null,
        })
        .select('id')
        .single();

      if (dbErr) console.warn('rof_files insert error:', dbErr.message);
      return ok({ url: publicData.publicUrl, fileId: fileRow?.id });
    }

    if (path.startsWith('/upload/') && method === 'DELETE') {
      const fileId = path.replace('/upload/', '');

      const { data: fileRow, error: fetchErr } = await supabase
        .from('rof_files')
        .select('storage_path')
        .eq('id', fileId)
        .single();

      if (fetchErr || !fileRow) return err('Arquivo nao encontrado', 404);

      await supabase.storage.from(BUCKET).remove([fileRow.storage_path]);
      await supabase.from('rof_files').delete().eq('id', fileId);

      return ok({ ok: true });
    }

    return err('Rota nao encontrada', 404);
  } catch (e) {
    console.error('api error:', e);
    return err(e.message || 'Erro interno', e.status || 500);
  }
};
