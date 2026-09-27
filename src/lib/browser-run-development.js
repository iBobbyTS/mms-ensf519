export const DISABLE_REMOTE_BROWSER_RUN_ENV = "MMS_DISABLE_REMOTE_BROWSER_RUN";

/**
 * @param {Record<string, string | undefined>} environment
 */
export function shouldDisableRemoteBrowserRun(environment) {
    return environment[DISABLE_REMOTE_BROWSER_RUN_ENV] === "1";
}
