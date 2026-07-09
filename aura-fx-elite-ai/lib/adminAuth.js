// Demo admin gate — set ADMIN_DEMO_KEY in .env before any public deploy.

export function isAdminAuthorized(request) {
  const expected = String(process.env.ADMIN_DEMO_KEY || "").trim();
  if (!expected) {
    return process.env.NODE_ENV === "development";
  }
  return request.headers.get("x-admin-key") === expected;
}
