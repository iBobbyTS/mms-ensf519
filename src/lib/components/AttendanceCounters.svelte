<script lang="ts">
    import type { AttendanceCounterDefinition } from "$lib/attendance-panel";

    let {
        counters,
        counterDefinitions,
    } : {
        counters: Record<string, number>;
        counterDefinitions: AttendanceCounterDefinition[];
    } = $props();

    function counterToneClass(tone: AttendanceCounterDefinition["tone"]): string {
        if (tone === "secondary") return "text-secondary";
        if (tone === "accent") return "text-accent";
        return "text-primary";
    }
</script>

<div class="stats stats-vertical ui-panel lg:stats-horizontal">
    {#each counterDefinitions as counter}
        <div class="stat">
            <div class="stat-title">{counter.label}</div>
            <div class={`stat-value ${counterToneClass(counter.tone)}`}>
                {counters[counter.key] ?? 0}
            </div>
        </div>
    {/each}
</div>
