const encoder = new TextEncoder();
const ITERATIONS = 210000;
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: ITERATIONS }, key, 256));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cookie(request) {
  return (request.headers.get('Cookie') || '').split(';').map(c => c.trim()).find(c => c.startsWith('session='))?.slice(8);
}
function sessionCookie(value, request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
async function currentUser(request, db) {
  const token = cookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?')
    .bind(await sha256(token), Math.floor(Date.now() / 1000)).first();
}
async function body(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null;
  try {
    const data = await request.json();
    if (typeof data?.email !== 'string' || typeof data?.password !== 'string') return null;
    const email = data.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || data.password.length < 8 || data.password.length > 128) return null;
    return { email, password: data.password };
  } catch { return null; }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (request.method === 'GET' && url.pathname === '/api/me') {
        return json({ user: await currentUser(request, env.DB) });
      }
      if (request.method !== 'POST') return json({ error: 'Không tìm thấy đường dẫn.' }, 404);
      // Browser requests that mutate state must come from this site's origin.
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
      if (url.pathname === '/api/logout') {
        const token = cookie(request);
        if (token && /^[a-f0-9]{64}$/.test(token)) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', request, 0) });
      }
      if (url.pathname !== '/api/register' && url.pathname !== '/api/login') return json({ error: 'Không tìm thấy đường dẫn.' }, 404);
      const data = await body(request);
      if (!data) return json({ error: 'Email không hợp lệ hoặc mật khẩu không dài từ 8 đến 128 ký tự.' }, 400);
      let user;
      if (url.pathname === '/api/register') {
        const salt = randomHex(16);
        const hash = await hashPassword(data.password, salt);
        user = { id: crypto.randomUUID(), email: data.email };
        try {
          await env.DB.prepare('INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)').bind(user.id, user.email, hash, salt).run();
        } catch (error) {
          if (String(error).includes('UNIQUE constraint failed')) return json({ error: 'Email này đã được đăng ký.' }, 409);
          throw error;
        }
      } else {
        const record = await env.DB.prepare('SELECT id, email, password_hash, salt FROM users WHERE email = ?').bind(data.email).first();
        const hash = await hashPassword(data.password, record?.salt || '00000000000000000000000000000000');
        if (!record || !equal(hash, record.password_hash)) return json({ error: 'Email hoặc mật khẩu không chính xác.' }, 401);
        user = { id: record.id, email: record.email };
      }
      const token = randomHex(32);
      const now = Math.floor(Date.now() / 1000);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
        env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), user.id, now + SESSION_SECONDS)
      ]);
      return json({ user }, 200, { 'Set-Cookie': sessionCookie(token, request, SESSION_SECONDS) });
    } catch (error) {
      console.error('API error:', error);
      return json({ error: 'Có lỗi xảy ra. Hãy kiểm tra cấu hình D1 và thử lại.' }, 500);
    }
  }
};
