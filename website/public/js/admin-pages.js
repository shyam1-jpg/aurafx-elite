/**
 * Shared helpers for password-protected admin pages (session cookie auth).
 */
(function (global) {
  function apiBase() {
    return global.AURAFX_API_BASE != null ? global.AURAFX_API_BASE : '';
  }

  async function requireAdmin() {
    var r = await fetch(apiBase() + '/api/admin/session', { credentials: 'include', cache: 'no-store' });
    var d = await r.json();
    if (!d.authenticated) {
      var next = encodeURIComponent(global.location.pathname + global.location.search);
      global.location.href = '/admin-login.html?next=' + next;
      return false;
    }
    return d;
  }

  async function adminFetch(path, options) {
    options = options || {};
    options.credentials = 'include';
    options.headers = options.headers || {};
    var r = await fetch(apiBase() + path, options);
    if (r.status === 401 || r.status === 403) {
      global.location.href = '/admin-login.html?next=' + encodeURIComponent(global.location.pathname);
      throw new Error('Session expired — sign in again');
    }
    return r;
  }

  async function adminLogout() {
    await fetch(apiBase() + '/api/admin/logout', { method: 'POST', credentials: 'include' });
    global.location.href = '/admin-login.html';
  }

  global.AURAFX_ADMIN = { requireAdmin: requireAdmin, adminFetch: adminFetch, adminLogout: adminLogout };
})(window);
