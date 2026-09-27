<script lang="ts">
    import {
        BriefcaseBusiness,
        Check,
        Home,
        Mail,
        MapPin,
        Pencil,
        Phone,
        Users,
    } from "lucide-svelte";
    import FormSectionDivider from "$lib/components/FormSectionDivider.svelte";
    import PersonBasicInfoSection from "$lib/components/PersonBasicInfoSection.svelte";
    import * as m from "$lib/paraglide/messages";
    import {
        accessibilityLabel,
        educationLevelLabel,
        gradeLabel,
        housingSituationLabel,
        incomeLabel,
        indigenousIdentityLabel,
        languageLabel,
        maritalStatusLabel,
        populationGroupLabel,
        present,
        type ContactItem,
        type ContactRow,
        type DetailItem,
    } from "$lib/client-detail-labels";
    import type { PageData } from "./$types";

    let { data } : { data: PageData } = $props();

    let isUpdated = $derived(data.flash === "updated");
    let isNew = $derived(data.flash === "created");

    const client = $derived(data.client);
    const legalName = $derived(`${client.firstName} ${client.lastName}`.trim());
    const displayName = $derived(
        client.chineseName || legalName || client.clientCode,
    );
    const displayInitial = $derived(displayName.trim().slice(0, 1).toUpperCase());
    const isMember = $derived(client.clientType === "Member");

    function membershipStatusLabel(state: PageData["membershipState"], membershipType: string) {
        if (membershipType === "Lifetime" && state === "valid") return m.dashboardLifetimeBadge();
        if (state === "valid") return m.dashboardStatusActive();
        if (state === "grace") return m.dashboardStatusWarning();
        if (state === "expired") return m.dashboardStatusExpired();
        return m.dashboardStatusNonMember();
    }

    function membershipStatusBadgeClass(state: PageData["membershipState"], membershipType: string) {
        if (membershipType === "Lifetime" && state === "valid") return "badge-success";
        if (state === "valid") return "badge-success";
        if (state === "grace") return "badge-warning";
        if (state === "expired") return "badge-error";
        return "badge-ghost";
    }

    const contactItems = $derived<ContactItem[]>([
        { key: "address", label: m.address(), value: client.address, icon: "location" },
        ...(isMember
            ? [{ key: "community", label: m.community(), value: client.community, icon: "location" as const }]
            : []),
        { key: "postalCode", label: m.postalCode(), value: client.postalCode, icon: "location" },
        { key: "tel", label: m.tel(), value: client.tel, icon: "phone" },
        ...(isMember
            ? [
                    {
                        key: "wechatID",
                        label: m.wechatID(),
                        value: client.wechatID,
                        icon: "phone" as const,
                    },
                    {
                        key: "email",
                        label: m.email(),
                        value: client.email,
                        icon: "email" as const,
                    },
                    {
                        key: "emergencyContactPerson",
                        label: m.emergencyContactPerson(),
                        value: client.emergencyContactPerson,
                        icon: "phone" as const,
                    },
                    {
                        key: "emergencyContactRelationship",
                        label: m.emergencyContactRelationship(),
                        value: client.emergencyContactRelationship,
                        icon: "business" as const,
                    },
                    {
                        key: "emergencyContactTel",
                        label: m.emergencyContactTel(),
                        value: client.emergencyContactTel,
                        icon: "phone" as const,
                    },
                ]
            : []),
    ]);

    const contactRows = $derived<ContactRow[]>(
        isMember
            ? [
                    { columns: 1, items: [contactItems[0]] },
                    { columns: 2, items: [contactItems[1], contactItems[2]] },
                    { columns: 2, items: [contactItems[3], contactItems[4]] },
                    { columns: 1, items: [contactItems[5]] },
                    { columns: 2, items: [contactItems[6], contactItems[7]] },
                    { columns: 1, items: [contactItems[8]] },
                ]
            : [
                    { columns: 1, items: [contactItems[0]] },
                    { columns: 2, items: [contactItems[1], contactItems[2]] },
                    { columns: 2, items: [contactItems[3], contactItems[4]] },
                    { columns: 1, items: [contactItems[5]] },
                ],
    );

    const fsiiRegistrationItem = $derived<DetailItem>({
        key: "fsiiRegistrationDate",
        label: m.fsiiRegistrationDate(),
        value: client.fsiiRegistrationDate,
    });

    const fsiiGroups = $derived([
        {
            label: m.fsiiGroupDemographics(),
            items: [
                { key: "majorLanguage", label: m.majorLanguage(), value: languageLabel(client.majorLanguage) },
                {
                    key: "populationGroup",
                    label: m.populationGroup(),
                    value: populationGroupLabel(client.populationGroup),
                },
                {
                    key: "indigenousIdentity",
                    label: m.indigenousIdentity(),
                    value: indigenousIdentityLabel(client.indigenousIdentity),
                },
            ],
        },
        {
            label: m.fsiiGroupHousehold(),
            items: [
                { key: "numberAdult", label: m.householdAdults(), value: client.numberAdult },
                { key: "numberChild", label: m.householdChildren(), value: client.numberChild },
                {
                    key: "housingSituation",
                    label: m.housingSituation(),
                    value: housingSituationLabel(client.housingSituation),
                },
            ],
        },
        {
            label: m.fsiiGroupMarital(),
            items: [
                {
                    key: "maritalStatus",
                    label: m.maritalStatus(),
                    value: maritalStatusLabel(client.maritalStatus),
                },
            ],
        },
        {
            label: m.fsiiGroupEducation(),
            items: [
                { key: "gradeInSchool", label: m.gradeInSchool(), value: gradeLabel(client.gradeInSchool) },
                { key: "highestGrade", label: m.highestGrade(), value: gradeLabel(client.highestGrade) },
                {
                    key: "educationLevel",
                    label: m.educationLevel(),
                    value: educationLevelLabel(client.educationLevel),
                },
            ],
        },
        {
            label: m.fsiiGroupArrivalIncome(),
            items: [
                { key: "arrivalMonth", label: m.arrivalMonth(), value: client.arrivalMonth },
                { key: "primaryIncome", label: m.primaryIncome(), value: incomeLabel(client.primaryIncome) },
            ],
        },
        {
            label: m.fsiiGroupHealth(),
            items: [
                {
                    key: "physicalAccessibilityDifficulty",
                    label: m.physicalAccessibilityDifficulty(),
                    value: accessibilityLabel(client.physicalAccessibilityDifficulty),
                },
                {
                    key: "cognitiveDifficulty",
                    label: m.cognitiveDifficulty(),
                    value: accessibilityLabel(client.cognitiveDifficulty),
                },
                {
                    key: "emotionalMentalHealthCondition",
                    label: m.emotionalMentalHealthCondition(),
                    value: accessibilityLabel(client.emotionalMentalHealthCondition),
                },
            ],
        },
    ]);

    const referralItems = $derived<DetailItem[]>([
        { key: "referrerName", label: m.referrerName(), value: client.referrerName },
        { key: "directorName", label: m.directorName(), value: client.directorName },
        { key: "approverName", label: m.approverName(), value: client.approverName },
    ]);
</script>

<div class="space-y-6">
    <section class="client-detail-hero-card ui-panel p-6">
        <div class="client-detail-hero">
            <div class="client-detail-hero-identity">
                <div
                    class="flex h-16 w-16 shrink-0 items-center justify-center rounded-box bg-primary/10 text-2xl font-bold text-primary"
                >
                    {displayInitial}
                </div>
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h1 class="page-title min-w-0">
                                                        <span class="truncate">{displayName}</span>
                        </h1>
                        {#if isMember}
                            <span
                                class={`badge ${membershipStatusBadgeClass(data.membershipState, client.membershipType)}`}
                            >
                                {membershipStatusLabel(data.membershipState, client.membershipType)}
                            </span>
                        {/if}
                    </div>
                    <div class="mt-1 text-sm text-base-content/60">{client.clientCode}</div>
                </div>
            </div>

            <div class="client-detail-hero-actions">
                <a
                    href={`/members/${client.clientCode}/edit`}
                    class="btn btn-primary btn-sm"
                >
                    <Pencil class="w-4 h-4" />
                    {m.edit()}
                </a>
            </div>
        </div>
    </section>

    {#if isNew}
        <div class="alert alert-success">
            <Check class="w-5 h-5" />
            <span>{m.clientCreatedBanner()}</span>
        </div>
    {/if}

    {#if isUpdated}
        <div class="alert alert-success">
            <Check class="w-5 h-5" />
            <span>{m.clientUpdatedBanner()}</span>
        </div>
    {/if}

    <section class="client-detail-layout grid gap-6">
        <div class="space-y-6">
            <PersonBasicInfoSection
                person={client}
                kind="member"
                mode="view"
                fieldPrefix="client-detail"
                membershipStatusLabel={membershipStatusLabel(data.membershipState, client.membershipType)}
                membershipBadgeClass={membershipStatusBadgeClass(data.membershipState, client.membershipType)}
            />

            {#if isMember}
                <div class="card ui-panel">
                    <div class="card-body">
                        <h2 class="card-title text-xl">
                            <Users class="h-5 w-5 text-primary" />
                            {m.fsiiRequirements()}
                        </h2>
                        <div class="space-y-3">
                            <dl class="client-detail-cell-grid client-detail-cell-grid--three grid gap-4">
                                <div class="rounded-box bg-base-200/50 p-4">
                                    <dt class="text-xs font-semibold text-base-content/60">
                                        {fsiiRegistrationItem.label}
                                    </dt>
                                    <dd
                                        class="mt-1 break-words text-base font-medium"
                                        data-client-detail-field={fsiiRegistrationItem.key}
                                    >
                                        {present(fsiiRegistrationItem.value)}
                                    </dd>
                                </div>
                            </dl>

                            {#each fsiiGroups as group}
                                <FormSectionDivider label={group.label} />
                                <dl class="client-detail-cell-grid client-detail-cell-grid--three grid gap-4">
                                    {#each group.items as item}
                                        <div class="rounded-box bg-base-200/50 p-4">
                                            <dt class="text-xs font-semibold text-base-content/60">
                                                {item.label}
                                            </dt>
                                            <dd
                                                class="mt-1 break-words text-base font-medium"
                                                data-client-detail-field={item.key}
                                            >
                                                {present(item.value)}
                                            </dd>
                                        </div>
                                    {/each}
                                </dl>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        <aside class="space-y-6">
            <div class="card ui-panel">
                <div class="card-body">
                    <h2 class="card-title text-xl">
                        <Phone class="h-5 w-5 text-primary" />
                        {m.contactInfo()}
                    </h2>
                    <div class="space-y-3">
                        {#each contactRows as row}
                            <div class={`grid gap-3 ${row.columns === 2 ? "sm:grid-cols-2" : ""}`}>
                                {#each row.items as item}
                                    <div class="flex min-w-0 gap-3 rounded-box bg-base-200/50 p-3">
                                        <div class="mt-0.5 shrink-0 text-base-content/50">
                                            {#if item.icon === "email"}
                                                <Mail class="h-4 w-4" />
                                            {:else if item.icon === "location"}
                                                <MapPin class="h-4 w-4" />
                                            {:else if item.icon === "business"}
                                                <BriefcaseBusiness class="h-4 w-4" />
                                            {:else}
                                                <Phone class="h-4 w-4" />
                                            {/if}
                                        </div>
                                        <div class="min-w-0">
                                            <div class="text-xs font-semibold text-base-content/60">
                                                {item.label}
                                            </div>
                                            <div
                                                class="mt-0.5 break-words font-medium"
                                                data-client-detail-field={item.key}
                                            >
                                                {present(item.value)}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="card ui-panel">
                <div class="card-body">
                    <h2 class="card-title text-xl">
                        <Users class="h-5 w-5 text-primary" />
                        {m.referralInfo()}
                    </h2>
                    <dl class="client-detail-cell-grid client-detail-cell-grid--three grid gap-4">
                        {#each referralItems as item}
                            <div class="rounded-box bg-base-200/50 p-4">
                                <dt class="text-xs font-semibold text-base-content/60">
                                    {item.label}
                                </dt>
                                <dd
                                    class="mt-1 break-words text-base font-medium"
                                    data-client-detail-field={item.key}
                                >
                                    {present(item.value)}
                                </dd>
                            </div>
                        {/each}
                    </dl>
                </div>
            </div>

            <div class="card ui-panel">
                <div class="card-body">
                    <h2 class="card-title text-xl">
                        <Home class="h-5 w-5 text-primary" />
                        {m.remark()}
                    </h2>
                    <p
                        class="whitespace-pre-wrap rounded-box bg-base-200/50 p-4 text-sm leading-6"
                        data-client-detail-field="remark"
                    >
                        {present(client.remark)}
                    </p>
                </div>
            </div>
        </aside>
    </section>
</div>

<style>
    .client-detail-hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content;
        align-items: flex-start;
        gap: 1.5rem;
    }

    .client-detail-hero-identity {
        display: flex;
        min-width: 0;
        gap: 1rem;
    }

    .client-detail-hero-card {
        container: client-detail-hero / inline-size;
    }

    .client-detail-hero-actions {
        display: grid;
        grid-template-columns: repeat(2, max-content);
        gap: 0.5rem;
        justify-content: end;
        justify-self: end;
    }

    .client-detail-hero-actions :global(.btn) {
        min-width: 0;
        white-space: nowrap;
    }

    @container client-detail-hero (max-width: 26rem) {
        .client-detail-hero {
            grid-template-columns: minmax(0, 1fr);
        }

        .client-detail-hero-actions {
            justify-content: start;
            justify-self: start;
        }
    }

    .client-detail-layout {
        grid-template-columns: minmax(0, 1fr);
    }

    @media (min-width: 1200px) {
        .client-detail-layout {
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
        }
    }
</style>
