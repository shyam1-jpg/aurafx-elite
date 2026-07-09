import { NextResponse } from "next/server";
import { generateMockSignals } from "../../../lib/mockSignals";
import { getLivePrices } from "../../../lib/livePrices";
import { applyApprovals, setApprovalStatus } from "../../../lib/signalApprovals";
import { isAdminAuthorized } from "../../../lib/adminAuth";

export const revalidate = 300;

const DISCLAIMER =
  "Educational demo signals. Prices may be live; the analysis is illustrative only. Not financial advice. Trading involves high risk of loss.";

async function buildSignals() {
  const { prices, dataMode, fetchedAt } = await getLivePrices();
  const signals = applyApprovals(generateMockSignals(new Date(), prices));
  return { signals, dataMode, fetchedAt };
}

// GET /api/signals — approved signals for users; ?view=admin shows full queue (key required).
export async function GET(request) {
  try {
    const view = request.nextUrl.searchParams.get("view");
    const { signals, dataMode, fetchedAt } = await buildSignals();

    if (view === "admin") {
      if (!isAdminAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({ disclaimer: DISCLAIMER, dataMode, fetchedAt, signals });
    }

    const published = signals.filter((s) => s.approvalStatus === "approved");
    return NextResponse.json({
      disclaimer: DISCLAIMER,
      dataMode,
      fetchedAt,
      signals: published
    });
  } catch (err) {
    console.error("[api/signals GET]", err);
    return NextResponse.json({ error: "Failed to load signals" }, { status: 500 });
  }
}

// POST /api/signals — admin approve / reject (persists in demo memory until server restart).
export async function POST(request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, decision } = body || {};

    if (!id || !["approved", "rejected", "pending"].includes(decision)) {
      return NextResponse.json({ error: "Invalid id or decision" }, { status: 400 });
    }

    setApprovalStatus(id, decision);
    const { signals, dataMode, fetchedAt } = await buildSignals();

    return NextResponse.json({ ok: true, dataMode, fetchedAt, signals });
  } catch (err) {
    console.error("[api/signals POST]", err);
    return NextResponse.json({ error: "Failed to update signal" }, { status: 500 });
  }
}
