import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return reply(200, {});
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return reply(401, { error: 'Inicia sesión para continuar.' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'Sesión no válida. Vuelve a iniciar sesión.' });
    const text = await request.text();
    if (text.length > 160000) return reply(413, { error: 'Demasiados datos en un envío.' });
    let body; try { body=JSON.parse(text); } catch { return reply(400,{error:'JSON no válido.'}); }
    if(!body || typeof body!=='object') return reply(400,{error:'Envío no válido.'});
    if (body.action === 'delete-account') {
      if (body.confirm !== 'ELIMINAR') return reply(400, { error: 'Confirma la eliminación de la cuenta.' });
      // Revoke refresh sessions first; getUser rejects deleted users on subsequent requests.
      const { error: signoutError } = await admin.auth.admin.signOut(token, 'global');
      if (signoutError) throw signoutError;
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;
      return reply(200, { deleted: true });
    }
    if (body.action !== 'sync' || !/^[0-9a-f-]{36}$/i.test(body.deviceId ?? '') || !Array.isArray(body.days) || !Array.isArray(body.cells) || !body.preferences) return reply(400, { error: 'Envío no válido.' });
    const { data, error } = await admin.rpc('sync_walkworld', { p_user: user.id, p_device: body.deviceId, p_days: body.days, p_cells: body.cells, p_preferences: body.preferences, p_edit_preferences: body.editPreferences === true });
    if (error) return reply(422, { error: 'No se pudo validar el envío. Revisa la fecha y la fuente de tus registros.', code: error.code });
    return reply(200, data);
  } catch { return reply(500, { error: 'No se pudo completar la operación. Inténtalo de nuevo.' }); }
});
