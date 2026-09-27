export type InterestGroupSelection = {
    id: number;
};

export function resolveInterestGroupAttendanceSelection(input: {
    interestGroups: InterestGroupSelection[];
    requestedInterestGroupId: number | null;
}): {
    interestGroupId: number | null;
} {
    const selectedInterestGroup =
        input.interestGroups.find((group) => group.id === input.requestedInterestGroupId) ??
        input.interestGroups[0] ??
        null;
    const interestGroupId = selectedInterestGroup?.id ?? null;
    return { interestGroupId };
}
