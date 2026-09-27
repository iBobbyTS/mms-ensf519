export type TemporaryParticipantDirectorySort = {
    sort: "participantCode" | null;
    dir: "asc" | "desc";
};

export function resolveTemporaryParticipantDirectorySort(input: {
    sort: string | null;
    dir: string | null;
}): TemporaryParticipantDirectorySort {
    return {
        sort: input.sort === "participantCode" ? "participantCode" : null,
        dir: input.dir === "asc" ? "asc" : "desc",
    };
}
