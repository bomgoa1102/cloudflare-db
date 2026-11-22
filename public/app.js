const $ = selector => document.querySelector(selector);
let mode = 'login';
const form = $('#auth-form');
function setMode(next) {
  mode = next;
  const login = mode === 'login';
  $('#title').innerHTML = login ? 'Chào mừng trở lại<span>.</span>' : 'Bắt đầu thôi<span>.</span>';
  $('#subtitle').textContent = login ? 'Đăng nhập để tiếp tục hành trình của bạn.' : 'Tạo tài khoản để khám phá bản demo.';
  $('#submit span').textContent = login ? 'Đăng nhập' : 'Tạo tài khoản';
  $('#password').autocomplete = login ? 'current-password' : 'new-password';
  for (const [id, active] of [['#login-tab', login], ['#register-tab', !login]]) {
    $(id).classList.toggle('active', active); $(id).setAttribute('aria-selected', String(active));
  }
  $('#message').textContent = '';
}
function showUser(user) {
  $('#auth-view').hidden = !!user; $('#user-view').hidden = !user;
  if (user) $('#user-email').textContent = user.email;
}
async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  return data;
}
$('#login-tab').addEventListener('click', () => setMode('login'));
$('#register-tab').addEventListener('click', () => setMode('register'));
form.addEventListener('submit', async event => {
  event.preventDefault(); $('#message').textContent = ''; $('#submit').disabled = true;
  try {
    const data = await api(`/api/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) });
    form.reset(); showUser(data.user);
  } catch (error) { $('#message').textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.'; }
  finally { $('#submit').disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  $('#logout').disabled = true; $('#user-message').textContent = '';
  try { await api('/api/logout', { method: 'POST' }); showUser(null); setMode('login'); }
  catch (error) { $('#user-message').textContent = error.message || 'Không thể kết nối. Vui lòng thử lại.'; }
  finally { $('#logout').disabled = false; }
});
api('/api/me').then(data => showUser(data.user)).catch(() => { $('#message').textContent = 'Không thể kiểm tra phiên đăng nhập. Hãy thử tải lại trang.'; });
