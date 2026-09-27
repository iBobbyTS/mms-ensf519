<script lang="ts">
    let { label } : { label: string } = $props();
</script>

<div class="flex items-center gap-3 pt-1" role="separator" aria-label={label}>
    <span class="shrink-0 text-xs font-semibold text-primary">{label}</span>
    <span class="h-px min-w-8 flex-1 bg-base-300/80" aria-hidden="true"></span>
</div>
