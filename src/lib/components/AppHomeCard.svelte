<script lang="ts">
    import type { HomeSectionButton, HomeSectionColor } from "$lib/app-shell";

    let {
        title,
        buttons,
        color = "blue",
    } : {
        title: string;
        buttons: Array<HomeSectionButton & { label: string }>;
        color?: HomeSectionColor;
    } = $props();

    const cardClasses: Record<HomeSectionColor, string> = {
        blue: "app-home-card--blue",
        green: "app-home-card--green",
        orange: "app-home-card--orange",
        red: "app-home-card--red",
        teal: "app-home-card--teal",
        slate: "app-home-card--slate",
    };

    const buttonClasses: Record<HomeSectionColor, string> = {
        blue: "btn-info btn-outline",
        green: "btn-success btn-outline",
        orange: "btn-warning btn-outline",
        red: "btn-error btn-outline",
        teal: "btn-accent btn-outline",
        slate: "btn-outline",
    };

    let resolvedColor = $derived((color ?? "blue") as HomeSectionColor);
</script>

<article class={`app-home-card card border shadow-sm ${cardClasses[resolvedColor]}`}>
    <div class="card-body gap-5">
        <h2 class="card-title text-2xl">{title}</h2>

        <div class="grid gap-3 sm:grid-cols-2">
            {#each buttons as button}
                {#if button.startsGroup}
                    <div class="divider my-0 sm:col-span-2"></div>
                {/if}
                <a
                    href={button.href}
                    data-sveltekit-reload={button.reload ? true : undefined}
                    class={`app-home-card__button btn justify-start min-h-12 ${buttonClasses[resolvedColor]}`}
                >
                    {button.label}
                </a>
            {/each}
        </div>
    </div>
</article>

<style>
    .app-home-card {
        color: var(--color-base-content);
        border-color: var(--app-home-card-border);
        background: var(--app-home-card-bg);
    }

    .app-home-card--blue {
        --app-home-card-border: rgb(186 230 253);
        --app-home-card-bg: rgb(240 249 255 / 0.6);
    }

    .app-home-card--green {
        --app-home-card-border: rgb(167 243 208);
        --app-home-card-bg: rgb(236 253 245 / 0.6);
    }

    .app-home-card--orange {
        --app-home-card-border: rgb(253 230 138);
        --app-home-card-bg: rgb(255 251 235 / 0.7);
    }

    .app-home-card--red {
        --app-home-card-border: rgb(254 205 211);
        --app-home-card-bg: rgb(255 241 242 / 0.6);
    }

    .app-home-card--teal {
        --app-home-card-border: rgb(153 246 228);
        --app-home-card-bg: rgb(240 253 250 / 0.6);
    }

    .app-home-card--slate {
        --app-home-card-border: rgb(226 232 240);
        --app-home-card-bg: rgb(248 250 252 / 0.8);
    }

    .app-home-card__button {
        color: #000 !important;
    }

    :global([data-theme="dark"]) .app-home-card {
        color: var(--color-base-content);
        box-shadow: 0 12px 28px rgb(0 0 0 / 0.24);
    }

    :global([data-theme="dark"]) .app-home-card--blue {
        --app-home-card-border: rgb(56 189 248 / 0.34);
        --app-home-card-bg:
            linear-gradient(rgb(56 189 248 / 0.09), rgb(56 189 248 / 0.09)),
            var(--color-base-100);
    }

    :global([data-theme="dark"]) .app-home-card--green {
        --app-home-card-border: rgb(52 211 153 / 0.34);
        --app-home-card-bg:
            linear-gradient(rgb(52 211 153 / 0.09), rgb(52 211 153 / 0.09)),
            var(--color-base-100);
    }

    :global([data-theme="dark"]) .app-home-card--orange {
        --app-home-card-border: rgb(251 191 36 / 0.36);
        --app-home-card-bg:
            linear-gradient(rgb(251 191 36 / 0.1), rgb(251 191 36 / 0.1)),
            var(--color-base-100);
    }

    :global([data-theme="dark"]) .app-home-card--red {
        --app-home-card-border: rgb(251 113 133 / 0.34);
        --app-home-card-bg:
            linear-gradient(rgb(251 113 133 / 0.09), rgb(251 113 133 / 0.09)),
            var(--color-base-100);
    }

    :global([data-theme="dark"]) .app-home-card--teal {
        --app-home-card-border: rgb(45 212 191 / 0.34);
        --app-home-card-bg:
            linear-gradient(rgb(45 212 191 / 0.09), rgb(45 212 191 / 0.09)),
            var(--color-base-100);
    }

    :global([data-theme="dark"]) .app-home-card--slate {
        --app-home-card-border: rgb(148 163 184 / 0.32);
        --app-home-card-bg:
            linear-gradient(rgb(148 163 184 / 0.08), rgb(148 163 184 / 0.08)),
            var(--color-base-100);
    }

    :global([data-theme="dark"]) .app-home-card__button {
        color: #f8fafc !important;
    }
</style>
