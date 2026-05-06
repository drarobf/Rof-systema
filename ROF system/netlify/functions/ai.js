// ══════════════════════════════════════════════════════════════
// Sistema ROF™ — Proxy seguro para Júlia IA (Anthropic API)
// Rota: POST /api/ai
// ══════════════════════════════════════════════════════════════
// Por que este proxy existe?
// A chave da Anthropic API não pode ficar no frontend (seria
// exposta no DevTools para qualquer visitante). Este proxy
// recebe as mensagens do frontend, valida o JWT da sessão e
// só então chama a API da Anthropic com a chave segura.
// ══════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

const JWT_SECRET     = process.env.JWT_SECRET;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYS_AI = `Você é Júlia, secretária virtual do Método ROF™ — Reabilitação Oral & Facial Integrada da Dra. Rossana Batista Fucks, CRO/SC 21403, Porto Belo/SC. Atenda com elegância, calor humano e profissionalismo. Protocolos disponíveis: ROF White Glow™ (clareamento), ROF Veneer Glow™ (facetas resina), ROF Upper Lift™ (toxina botulínica), ROF Lips™ (preenchimento labial), ROF Balance™ (bruxismo/ATM), ROF Skin™ (pele), ROF Contour™ (harmonização estrutural), ROF Rejuvenate™ (bioestimuladores + Profhilo®), ROF Osseum™ (implantes + enxerto + PRF), ROF Prime™ (transformação completa face + sorriso + pele). Filosofia ROF™: "Função gera equilíbrio. Equilíbrio gera estética. Função e estética integradas geram harmonia facial.™" Nunca forneça diagnósticos definitivos, preços fechados ou garantias de resultado sem avaliação presencial. Incentive sempre a agendar uma consulta. Responda em português brasileiro com elegância. Máximo 3 parágrafos curtos e objetivos.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verificar JWT
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Não autorizado' }) };
  }

  // Parsear body
  let messages = [];
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages || [];
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  if (!messages.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Mensagens ausentes' }) };
  }

  // Chamar Anthropic API
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYS_AI,
        messages: messages.map(m => ({
          role:    m.r === 'a' ? 'assistant' : 'user',
          content: m.t,
        })),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Anthropic error:', data);
      return {
        statusCode: res.status,
        headers: CORS,
        body: JSON.stringify({ error: data.error?.message || 'Erro na API' }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ text: data.content?.[0]?.text || '' }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Erro de conexão com a IA' }),
    };
  }
};
