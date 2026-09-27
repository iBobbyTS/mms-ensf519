import { error, json } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { getInterestGroupAttendanceSnapshot, listInterestGroups } from "$lib/server/domain";
import { requireAttendanceAccess } from "$lib/server/security";

export async function GET({ locals, platform, url, setHeaders }) {
    requireAttendanceAccess(locals);
    setHeaders({ "Cache-Control": "no-store" });
    const rawInterestGroupId = url.searchParams.get("interest_group_id") ?? "";
    if (!/^[1-9]\d*$/.test(rawInterestGroupId)) throw error(400, "interest_group_required");
    const interestGroupId = Number(rawInterestGroupId);
    if (!Number.isSafeInteger(interestGroupId)) throw error(400, "interest_group_required");
    const db = getDb(platform);
    if (!(await listInterestGroups(db)).some((group) => group.id === interestGroupId)) return json({ error: "interest_group_unavailable" }, { status: 404 });
    return json({ interestGroupId, ...(await getInterestGroupAttendanceSnapshot(db, interestGroupId)) });
}
