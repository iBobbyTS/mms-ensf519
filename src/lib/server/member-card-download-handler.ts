import { json, type RequestHandler } from "@sveltejs/kit";

import { getDb, type AppDb } from "./db.ts";
import { buildMemberCardsCsv, MemberCardCsvError } from "./member-card-csv.ts";

export function createMemberCardDownloadHandler(dependencies: {
    getDb: (platform?: App.Platform) => AppDb;
    buildCsv: typeof buildMemberCardsCsv;
}): RequestHandler {
    return async ({ platform, request }) => {
        const body = await request.json().catch(() => ({}));
        const input = body && typeof body === "object" && "input" in body
            ? (body as { input?: unknown }).input
            : undefined;
        if (typeof input !== "string") {
            return json({ error: "invalid" }, { status: 400 });
        }
        try {
            const result = await dependencies.buildCsv(dependencies.getDb(platform), input);
            if (result.missing.length || result.disabled.length || result.expired.length) {
                return json(
                    { error: "member_status", missing: result.missing, disabled: result.disabled, expired: result.expired },
                    { status: 404 },
                );
            }
            return new Response(result.csv, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": 'attachment; filename="member-cards.csv"',
                    "Cache-Control": "no-store",
                },
            });
        } catch (error) {
            if (error instanceof MemberCardCsvError) {
                return json(
                    { error: error.code, details: error.details },
                    { status: 400 },
                );
            }
            throw error;
        }
    };
}

export const memberCardDownloadHandler = createMemberCardDownloadHandler({
    getDb,
    buildCsv: buildMemberCardsCsv,
});
