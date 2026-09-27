import type { DropdownSearchItem } from "./dropdown-search.ts";
import {
    mergeAttendanceSearchOptions,
    mergeAttendanceSearchParamDict,
    resolveAttendanceSearchExactMatch,
} from "./member-attendance.ts";
import { parseTemporaryParticipantCode } from "./temporary-participant.ts";

export type AttendanceMemberSearchContext = {
    clientType: "participant" | "Member";
    additionalMemberSearchEndpoint?: string;
    clientCodeLabel: string;
};

export function formatAttendanceSearchItem(
    item: DropdownSearchItem,
    clientCodeLabel: string,
): DropdownSearchItem {
    const name = item.chineseName?.trim() || item.englishName?.trim() || item.clientCode;

    return {
        ...item,
        title: name,
        label: name,
        param_dict: mergeAttendanceSearchParamDict(item, clientCodeLabel),
    };
}

export async function loadAttendanceMemberOptions(
    query: string,
    context: { limit: number; signal?: AbortSignal },
    options: AttendanceMemberSearchContext,
): Promise<{
    options: DropdownSearchItem[];
    exactMatch: DropdownSearchItem | null;
}> {
    const params = new URLSearchParams({
        q: query,
        limit: String(context.limit),
        clientType: options.clientType,
    });
    const memberRequest = fetch(`/api/members/search?${params.toString()}`, {
        signal: context.signal,
    });
    const additionalRequest = options.additionalMemberSearchEndpoint
        ? fetch(`${options.additionalMemberSearchEndpoint}?${params.toString()}`, {
              signal: context.signal,
          })
        : null;
    const [response, additionalResponse] = await Promise.all([
        memberRequest,
        additionalRequest,
    ]);
    if (!response.ok || (additionalResponse && !additionalResponse.ok)) {
        throw new Error("Attendance participant search failed.");
    }
    const result = (await response.json()) as {
        options?: DropdownSearchItem[];
        exactMatch?: DropdownSearchItem | null;
        exactMatchCount?: number;
    };
    const additionalResult = additionalResponse
        ? (await additionalResponse.json()) as {
              options?: DropdownSearchItem[];
              exactMatch?: DropdownSearchItem | null;
              exactMatchCount?: number;
          }
        : null;
    const memberOptions = (result.options ?? []).filter(
        (item) =>
            !options.additionalMemberSearchEndpoint ||
            parseTemporaryParticipantCode(item.clientCode) === null,
    );
    const memberExactMatch =
        result.exactMatch &&
        (!options.additionalMemberSearchEndpoint ||
            parseTemporaryParticipantCode(result.exactMatch.clientCode) === null)
            ? result.exactMatch
            : null;
    const memberExactMatchCount = result.exactMatchCount === 1 && !memberExactMatch
        ? 0
        : (result.exactMatchCount ?? 0);
    const additionalOptions = additionalResult?.options ?? [];
    const mergedOptions = mergeAttendanceSearchOptions(
        memberOptions,
        additionalOptions,
        context.limit,
    );
    const exactMatch = resolveAttendanceSearchExactMatch(query, [
        {
            options: memberOptions,
            exactMatch: memberExactMatch,
            exactMatchCount: memberExactMatchCount,
        },
        {
            options: additionalOptions,
            exactMatch: additionalResult?.exactMatch ?? null,
            exactMatchCount: additionalResult?.exactMatchCount ?? 0,
        },
    ]);

    return {
        options: mergedOptions.map((item) =>
            formatAttendanceSearchItem(item, options.clientCodeLabel)
        ),
        exactMatch: exactMatch
            ? formatAttendanceSearchItem(exactMatch, options.clientCodeLabel)
            : null,
    };
}
