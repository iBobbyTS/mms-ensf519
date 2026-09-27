export const ATTENDANCE_FOCUS_RESTORE_EVENT = "scsc:attendance-focus-restore";

export function requestAttendanceFocusRestore() {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new CustomEvent(ATTENDANCE_FOCUS_RESTORE_EVENT));
}

export function scheduleAttendanceFocusRestore(delayMs = 0) {
    if (typeof window === "undefined") {
        return;
    }

    window.setTimeout(requestAttendanceFocusRestore, delayMs);
}
