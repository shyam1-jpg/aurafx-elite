// In-memory approval overrides for the demo admin queue.
// Resets each UTC day so mock signal IDs stay aligned. Replace with Supabase later.

const overrides = new Map();
let storedDay = null;

function todayKey() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function resetIfNewDay() {
  const day = todayKey();
  if (storedDay !== day) {
    overrides.clear();
    storedDay = day;
  }
}

export function getApprovalStatus(signalId, initialStatus) {
  resetIfNewDay();
  return overrides.get(signalId) ?? initialStatus;
}

export function setApprovalStatus(signalId, status) {
  resetIfNewDay();
  overrides.set(signalId, status);
}

export function applyApprovals(signals) {
  return signals.map((s) => ({
    ...s,
    approvalStatus: getApprovalStatus(s.id, s.approvalStatus)
  }));
}
