import type { UiLanguage } from "@ibobbyts/svelte-ui-utils";

export function toSvelteUiLanguage(
    locale: string | null | undefined,
): UiLanguage {
    if (locale === "zh-cn") return "zh_cn";
    if (locale === "zh-tw") return "zh_tw";
    return "en_us";
}
