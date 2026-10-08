// Buzón de pagos de Mis Cuentas (Cloudflare Worker + KV).
// El atajo de iOS deja aquí cada pago de Apple Pay ("importe;comercio") y la app los recoge al abrirse.
// No hay cuentas: cada móvil usa una clave aleatoria larga (?k=...) que separa sus pagos de los de cualquier otro.
const ORIGINS = ['https://josemaaafc13.github.io', 'http://localhost:8765'];
const MAX_PENDING = 300;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const k = url.searchParams.get('k') || '';
    if (!/^[a-f0-9]{32}$/.test(k)) return new Response('Clave no válida', { status: 400, headers: cors });
    // Buzón privado: solo las claves del secreto ALLOWED_KEYS (separadas por comas). La app es pública,
    // pero este servicio va en la cuenta de Cloudflare del dueño: nadie más deja aquí sus pagos.
    const allowed = String(env.ALLOWED_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!allowed.includes(k)) return Response.json({ error: 'private' }, { status: 403, headers: cors });
    const prefix = `p:${k}:`;

    // El atajo envía un pago (texto plano, JSON {"l": ...} o formulario)
    if (url.pathname === '/pay' && req.method === 'POST') {
      let line = '';
      const type = req.headers.get('content-type') || '';
      try {
        if (type.includes('json')) { const j = await req.json(); line = String(j.l ?? j.line ?? j.text ?? ''); }
        else if (type.includes('form')) { const f = await req.formData(); line = String(f.get('l') || [...f.keys()][0] || ''); }
        else line = await req.text();
      } catch { line = ''; }
      line = line.trim().slice(0, 160);
      if (!line) return new Response('Vacío', { status: 400 });
      const pending = await env.PAYS.list({ prefix, limit: MAX_PENDING });
      if (pending.keys.length >= MAX_PENDING) return new Response('Buzón lleno', { status: 429 });
      const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      await env.PAYS.put(prefix + id, JSON.stringify({ line, date: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 90 });
      return new Response('Guardado');
    }

    // La app recoge los pagos pendientes
    if (url.pathname === '/pays' && req.method === 'GET') {
      const list = await env.PAYS.list({ prefix, limit: MAX_PENDING });
      const items = await Promise.all(list.keys.map(async ({ name }) => {
        const v = await env.PAYS.get(name);
        try { return { id: name.slice(prefix.length), ...JSON.parse(v) }; } catch { return null; }
      }));
      return Response.json(items.filter(i => i && i.line), { headers: { ...cors, 'Cache-Control': 'no-store' } });
    }

    // La app confirma lo que ya añadió y se borra del buzón
    if (url.pathname === '/ack' && req.method === 'POST') {
      let ids = [];
      try { ids = await req.json(); } catch {}
      if (Array.isArray(ids)) await Promise.all(ids.slice(0, MAX_PENDING).map(id => env.PAYS.delete(prefix + String(id).slice(0, 40))));
      return new Response('OK', { headers: cors });
    }

    return new Response('Buzón de Mis Cuentas', { headers: cors });
  },
};
