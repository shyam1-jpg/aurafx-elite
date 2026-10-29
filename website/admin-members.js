'use strict';

const STORAGE_NOTE = 'Members are stored in website/data/members.json on this server disk. The file is not in git and is not written to the database. A hosting redeploy can remove it unless the host keeps that folder.';
const POSTGRES_NOTE = 'Members are stored in Postgres from DATABASE_URL. Accounts, tiers, drawings and alerts survive a redeploy. Passwords stay scrypt hashes.';

function slim(member) {
  if (!member) return null;
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    tier: member.tier,
    created_at: member.created_at
  };
}

function createAdminMembers(options) {
  const opts = options || {};
  async function resolveStore() {
    if (opts.store) return opts.store;
    if (opts.storeGetter) return opts.storeGetter();
    return null;
  }

  async function handle(req, res, ctx) {
    const url = ctx.url;
    if (url !== '/api/admin/members' && url !== '/api/admin/members/tier') return false;
    if (!ctx.isAdmin(req)) {
      ctx.json(res, 403, { ok: false, error: 'Forbidden — admin sign-in required' });
      return true;
    }
    const store = await resolveStore();
    if (!store) {
      ctx.json(res, 503, { ok: false, error: 'Members store is unavailable.' });
      return true;
    }
    if (url === '/api/admin/members' && req.method === 'GET') {
      const params = new URLSearchParams(ctx.rawUrl && ctx.rawUrl.includes('?') ? ctx.rawUrl.split('?')[1] : '');
      const storage = store.storage === 'postgres' ? 'postgres' : 'file';
      ctx.json(res, 200, {
        ok: true,
        members: await Promise.resolve(store.listPublic(params.get('q') || '')),
        storage,
        note: storage === 'postgres' ? POSTGRES_NOTE : STORAGE_NOTE
      });
      return true;
    }
    if (url === '/api/admin/members/tier' && req.method === 'POST') {
      const body = await ctx.readBody(req);
      const email = String(body && body.email || '').trim().toLowerCase();
      const tier = String(body && body.tier || '').trim().toLowerCase();
      try {
        const member = await Promise.resolve(store.setTier(email, tier));
        if (ctx.audit) ctx.audit('member_tier', req, email + ' ' + tier);
        ctx.json(res, 200, { ok: true, member: slim(member) });
      } catch (error) {
        ctx.json(res, error.status || 400, { ok: false, error: error.message || 'Could not update the tier.' });
      }
      return true;
    }
    ctx.json(res, 405, { ok: false, error: 'Method not allowed' });
    return true;
  }

  return { handle };
}

module.exports = { createAdminMembers, STORAGE_NOTE, POSTGRES_NOTE };
