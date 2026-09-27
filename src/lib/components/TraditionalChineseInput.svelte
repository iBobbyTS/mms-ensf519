<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import {
        replaceTraditionalChineseCharacters,
        traditionalChineseSuggestionText,
    } from "$lib/traditional-chinese";

    type Layout = "horizontal" | "vertical";

    let {
        id,
        name,
        label,
        value = $bindable(""),
        required = false,
        showRequiredIndicator = false,
        readonly = false,
        inputClass = "input input-bordered w-full bg-base-100",
        layout = "vertical",
    } : {
        id: string;
        name: string;
        label: string;
        value?: string;
        required?: boolean;
        showRequiredIndicator?: boolean;
        readonly?: boolean;
        inputClass?: string;
        layout?: Layout;
    } = $props();

    const debounceMs = 200;
    let suggestion = $state<ReturnType<typeof traditionalChineseSuggestionText>>(null);

    $effect(() => {
        if (readonly) {
            suggestion = null;
            return;
        }

        const nextValue = value;
        const timer = setTimeout(() => {
            suggestion = traditionalChineseSuggestionText(nextValue);
        }, debounceMs);

        return () => clearTimeout(timer);
    });

    const hasSuggestion = $derived(Boolean(suggestion));
    const hintId = $derived(`${id}-traditional-chinese-hint`);
    const fieldLayoutClass = $derived(
        layout === "horizontal"
            ? "flex flex-col gap-2 sm:flex-row sm:items-center"
            : "grid gap-2",
    );
    const hintLayoutClass = $derived(
        layout === "horizontal"
            ? "flex min-w-0 flex-wrap items-center gap-2 text-sm"
            : "flex flex-wrap items-center gap-2 text-sm",
    );

    function replaceSuggestion() {
        value = replaceTraditionalChineseCharacters(value);
        suggestion = null;
    }
</script>

<div class="traditional-chinese-input">
    <label class="text-xs font-semibold text-base-content/60" for={id}>
        {label}
        {#if showRequiredIndicator}
            <span class="text-error" aria-hidden="true">*</span>
        {/if}
    </label>
    <div class={fieldLayoutClass}>
        <input
            type="text"
            {id}
            {name}
            bind:value
            class={inputClass}
            aria-describedby={hasSuggestion ? hintId : undefined}
            {required}
            {readonly}
        />
        {#if suggestion && !readonly}
            <div
                id={hintId}
                class={hintLayoutClass}
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <span class="text-error">
                    {m.traditionalChineseNameInlineSuggestion({
                        traditional: suggestion.traditional,
                        simplified: suggestion.simplified,
                    })}
                </span>
                <button type="button" class="btn btn-error btn-outline btn-xs" onclick={replaceSuggestion}>
                    {m.traditionalChineseNameReplace()}
                </button>
            </div>
        {/if}
    </div>
</div>
