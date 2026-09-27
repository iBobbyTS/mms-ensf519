import type {
    ActivityQuestionnaire,
    ActivityRegistrationAnswers,
} from "$lib/activity-questionnaire";

export type ActivityCapacitySummary = {
    activeCount: number;
    limit: number;
    waitlistedCount: number;
    waitlistLimit: number;
};

export type ActivityIntegritySummary = {
    lossCount: number;
    percentage: 100 | 67 | 33 | 0;
    registrationBlocked: boolean;
};

export type ActivityIntegrityPolicy = {
    enabled: boolean;
    cancellationDeadline: string | null;
};

export type ActivityIntegrityTone = "success" | "warning" | "error";

export type PublicActivityPageActivity = {
    id: number;
    name: string;
    heldAt: string | null;
    questions: ActivityQuestionnaire;
    questionnaireVersion: string;
    capacity: ActivityCapacitySummary;
    integrityPolicy: ActivityIntegrityPolicy;
};

export type ActivityRegistrationAvailability = "register" | "waitlist" | "full";

export function isActivityCapacitySummary(value: unknown): value is ActivityCapacitySummary {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return ["activeCount", "limit", "waitlistedCount", "waitlistLimit"].every((key) =>
        Number.isSafeInteger(candidate[key]) && Number(candidate[key]) >= 0,
    ) && Number(candidate.waitlistLimit) >= 1;
}

export function isActivityIntegritySummary(value: unknown): value is ActivityIntegritySummary {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    if (!Number.isSafeInteger(candidate.lossCount) || Number(candidate.lossCount) < 0) return false;
    const lossCount = Number(candidate.lossCount);
    const expectedPercentage = lossCount === 0 ? 100 : lossCount === 1 ? 67 : lossCount === 2 ? 33 : 0;
    return candidate.percentage === expectedPercentage && candidate.registrationBlocked === (lossCount >= 3);
}

export function isActivityIntegrityPolicy(value: unknown): value is ActivityIntegrityPolicy {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.enabled !== "boolean") return false;
    if (candidate.cancellationDeadline === null) return !candidate.enabled;
    return typeof candidate.cancellationDeadline === "string" &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(candidate.cancellationDeadline);
}

export function activityIntegrityTone(summary: ActivityIntegritySummary): ActivityIntegrityTone {
    if (summary.percentage === 100) return "success";
    if (summary.percentage === 0) return "error";
    return "warning";
}

export function activityIntegrityBlocksNewRegistration(
    policy: ActivityIntegrityPolicy,
    summary: ActivityIntegritySummary | null,
): boolean {
    return policy.enabled && (!summary || summary.registrationBlocked);
}

export function activityRegistrationAvailability(
    capacity: ActivityCapacitySummary | null | undefined,
): ActivityRegistrationAvailability {
    if (!capacity) return "full";
    if (capacity.activeCount < capacity.limit && capacity.waitlistedCount === 0) return "register";
    if (capacity.waitlistedCount < capacity.waitlistLimit) return "waitlist";
    return "full";
}

export type RegistrationSnapshot = {
    status: "registered";
    questionnaireVersion: string;
    answers: ActivityRegistrationAnswers;
    answersVersion: string;
    attended: boolean;
    capacity: ActivityCapacitySummary;
    integritySummary: ActivityIntegritySummary | null;
    integrityPolicy: ActivityIntegrityPolicy;
    questionnaireChanged?: true;
} | {
    status: "waitlisted";
    questionnaireVersion: string;
    answers: ActivityRegistrationAnswers;
    answersVersion: string;
    attended: false;
    queuePosition: number;
    capacity: ActivityCapacitySummary;
    integritySummary: ActivityIntegritySummary | null;
    integrityPolicy: ActivityIntegrityPolicy;
    questionnaireChanged?: true;
} | {
    status: "not_registered";
    questionnaireVersion: string;
    answers: null;
    answersVersion: null;
    attended: false;
    capacity: ActivityCapacitySummary;
    integritySummary: ActivityIntegritySummary | null;
    integrityPolicy: ActivityIntegrityPolicy;
} | {
    status: "unknown";
    error: "questionnaire_changed" | "activity_unavailable" | "identity_invalidated" | "service_unavailable";
};

export type RegistrationSnapshotError = Extract<RegistrationSnapshot, { status: "unknown" }>["error"];

export function initialRegistrationSnapshotError(
    initialSnapshot: RegistrationSnapshot | null,
    normalizedSnapshot: RegistrationSnapshot | null,
): RegistrationSnapshotError | null {
    if (
        (normalizedSnapshot?.status === "registered" || normalizedSnapshot?.status === "waitlisted") &&
        normalizedSnapshot.questionnaireChanged
    ) return "questionnaire_changed";
    if (normalizedSnapshot?.status === "unknown") return normalizedSnapshot.error;
    return initialSnapshot && !normalizedSnapshot ? "questionnaire_changed" : null;
}

export type RegistrationStatusActionEnvelope = {
    target: "registrationStatus";
    snapshot: RegistrationSnapshot;
};

export type PublicActivityIdParseResult =
    | { kind: "none" }
    | { kind: "invalid" }
    | { kind: "candidate"; id: number };

/** Parse the repeated public activity id input without applying a fallback. */
export function parsePublicActivityId(values: string[]): PublicActivityIdParseResult {
    if (values.length === 0) return { kind: "none" };
    if (values.length !== 1) return { kind: "invalid" };
    const value = values[0];
    if (!/^[1-9][0-9]*$/.test(value)) return { kind: "invalid" };
    const id = Number(value);
    return Number.isSafeInteger(id) ? { kind: "candidate", id } : { kind: "invalid" };
}
