const dispatchTurnstileEvent = (event) => {
    const listener = window.activityRegistrationTurnstileListener;
    if (typeof listener === "function") {
        listener(event);
        return;
    }
    window.activityRegistrationPendingTurnstile = event;
};

window.activityRegistrationTurnstileSuccess = (token) =>
    dispatchTurnstileEvent({ kind: "success", token });
window.activityRegistrationTurnstileExpired = () =>
    dispatchTurnstileEvent({ kind: "expired" });
window.activityRegistrationTurnstileError = (code) =>
    dispatchTurnstileEvent({ kind: "error", code });
window.activityRegistrationTurnstileReady = () =>
    dispatchTurnstileEvent({ kind: "ready" });
