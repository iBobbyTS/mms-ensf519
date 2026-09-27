<script lang="ts">
    import { Home, Users } from "lucide-svelte";
    import {
        Dropdown,
        type DropdownOption,
        type DropdownOptionGroup,
        type DropdownSelection,
    } from "@ibobbyts/svelte-ui-utils/dropdown";

    import {
        createClientFormData,
        normalizeClientData,
        type ClientData,
        type ClientDataSource,
    } from "$lib/client-form";
    import FormSectionDivider from "$lib/components/FormSectionDivider.svelte";
    import PersonBasicInfoSection from "$lib/components/PersonBasicInfoSection.svelte";
    import { SegmentedDateInput } from "@ibobbyts/svelte-ui-utils/segmented-date";
    import {
        FSII_ACCESSIBILITY_DIFFICULTY_VALUES,
        FSII_HOUSING_SITUATION_VALUES,
        FSII_INDIGENOUS_IDENTITY_VALUES,
        FSII_MAIN_LANGUAGE_VALUES,
        FSII_NEIGHBOURHOOD_VALUES,
        FSII_POPULATION_GROUP_VALUES,
    } from "$lib/fsii-member-demographics";
    import * as m from "$lib/paraglide/messages";
    import { traditionalChineseSuggestionText } from "$lib/traditional-chinese";
    import {
        createTemporaryParticipantFormData,
        DOB_AGE_FIELD,
        DOB_AGE_ONLY_FIELD,
        normalizeTemporaryParticipantData,
        TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH,
        TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH,
        TEMPORARY_PARTICIPANT_WECHAT_ID_MAX_LENGTH,
        type TemporaryParticipantData,
        type TemporaryParticipantDataSource,
    } from "$lib/temporary-participant";

    type FormConstraintControl = {
        disabled: boolean;
        required: boolean;
        validity: { valid: boolean; valueMissing: boolean };
        labels: NodeListOf<HTMLLabelElement> | null;
        name: string;
        getAttribute: (name: string) => string | null;
        reportValidity: () => boolean;
    };

    let {
        client,
        temporaryParticipant,
        kind = "member",
        mode = "add",
        hideRemark = false,
        formId,
        onsubmit,
        oncancel,
    } : {
        client?: ClientDataSource;
        temporaryParticipant?: TemporaryParticipantDataSource;
        kind?: "member" | "temporary";
        mode?: "add" | "edit" | "view";
        hideRemark?: boolean;
        formId?: string;
        onsubmit: (data: FormData) => void | Promise<void>;
        oncancel: () => void;
    } = $props();

    type SharedFormData = ClientData & TemporaryParticipantData;

    function readClientData(): SharedFormData {
        if (kind === "temporary") {
            const participant = normalizeTemporaryParticipantData(temporaryParticipant);
            return {
                ...normalizeClientData(),
                ...participant,
                // An age record (ageYears !== "") opens the form in age mode.
                dobAgeOnly: (participant.ageYears ?? "") !== "",
                clientCode: participant.participantCode,
                registrationDate: "",
                referrerName: "",
                directorName: "",
                approverName: "",
            };
        }

        return {
            ...normalizeTemporaryParticipantData(),
            ...normalizeClientData(client),
            // An age record (ageYears !== "") opens the form in age mode.
            dobAgeOnly: client?.dobAgeOnly === true || (client?.ageYears ?? "") !== "",
            legalName: "",
            wechatId: null,
            status: "active",
            createdAt: "",
            updatedAt: "",
        };
    }

    let localClient = $state<SharedFormData>(readClientData());
    let isReadonly = $derived(mode === "view");
    let isAddMode = $derived(mode === "add");
    let isTemporary = $derived(kind === "temporary");
    let isSubmitting = $state(false);
    let formElement = $state<HTMLFormElement | null>(null);
    let confirmDialog = $state<HTMLDialogElement | null>(null);
    let missingRequiredFields = $state<string[]>([]);
    let chineseNameSuggestion = $derived(traditionalChineseSuggestionText(localClient.chineseName));

    function fieldId(name: string) {
        return `client-form-${name}`;
    }

    function syncLocalClientFromForm() {
        if (!formElement) {
            return;
        }

        const currentFormData = new FormData(formElement);
        const source = {
            ...localClient,
            legalNamePhotoIdVerified: currentFormData.has("legalNamePhotoIdVerified"),
            isVolunteer: currentFormData.has("isVolunteer"),
            dobAgeOnly: currentFormData.has(DOB_AGE_ONLY_FIELD),
            ...Object.fromEntries(currentFormData.entries()),
        };
        if (kind === "temporary") {
            localClient = {
                ...localClient,
                ...normalizeTemporaryParticipantData(source),
            };
            return;
        }
        localClient = {
            ...localClient,
            ...normalizeClientData({ ...source, clientType: "Member" }),
        };
    }

    function requestSubmitConfirmation(e?: Event) {
        e?.preventDefault();
        syncLocalClientFromForm();
        const formControls = formElement
            ? Array.from(formElement.querySelectorAll("input, select, textarea"))
                .map((field) => field as unknown as FormConstraintControl)
            : [];
        const invalidBlockingField = formControls.find(
            (field) =>
                !field.disabled &&
                !field.validity.valid &&
                !field.validity.valueMissing,
        );
        if (invalidBlockingField) {
            invalidBlockingField.reportValidity();
            return;
        }
        missingRequiredFields = formControls
            .filter((field) =>
                field.required && !field.disabled && field.validity.valueMissing,
            )
            .map((field) =>
                field.labels?.[0]?.textContent
                    ?.replaceAll("*", "")
                    .replace(/\s+/g, " ")
                    .trim() || field.getAttribute("aria-label") || field.name,
            )
            .filter((label, index, labels) => labels.indexOf(label) === index);
        // Temporary forms hard-block on the identity fields; in age mode the
        // dobAge input replaces dob, so the blocking name follows the mode.
        const blockingDobField = localClient.dobAgeOnly ? DOB_AGE_FIELD : "dob";
        const missingBlockingField = formControls.find(
            (field) =>
                field.required &&
                !field.disabled &&
                field.validity.valueMissing &&
                ["firstName", "lastName", blockingDobField].includes(field.name),
        );
        if (isTemporary && missingBlockingField) {
            missingBlockingField.reportValidity();
            return;
        }
        confirmDialog?.showModal();
    }

    async function confirmSubmit() {
        confirmDialog?.close();
        isSubmitting = true;

        const sourceFormData = formElement ? new FormData(formElement) : undefined;
        const formData = kind === "temporary"
            ? createTemporaryParticipantFormData(localClient, sourceFormData)
            : createClientFormData(localClient, {
                  includeClientCode: !isAddMode,
                  sourceFormData,
              });
        // "Age only" payload invariant: age mode must never carry a dob key and
        // dob mode must never carry dobAgeOnly/dobAge keys. The DOM checkbox
        // presence decides the mode (the shared state object also carries a
        // dobAgeOnly flag that builders must not leak as a value key).
        const dobAgeOnly = sourceFormData
            ? sourceFormData.has(DOB_AGE_ONLY_FIELD)
            : localClient.dobAgeOnly === true;
        if (dobAgeOnly) {
            formData.delete("dob");
        } else {
            formData.delete(DOB_AGE_ONLY_FIELD);
            formData.delete(DOB_AGE_FIELD);
        }
        try {
            await onsubmit(formData);
        } finally {
            isSubmitting = false;
        }
    }

    let legalNameDisplay = $derived(
        isTemporary
            ? localClient.legalName
            : `${localClient.firstName} ${localClient.lastName}`.trim(),
    );
    let confirmationDisplayName = $derived(
        localClient.chineseName || legalNameDisplay,
    );

    function hasOption(options: readonly string[], value: string) {
        return options.includes(value);
    }

    function dropdownOptions(
        values: readonly string[],
        label: (value: string) => string,
        currentValue: string,
    ): DropdownOption[] {
        return [
            { value: "", label: "--" },
            ...values.map((value) => ({ value, searchText: value, label: label(value) })),
            ...(currentValue && !hasOption(values, currentValue)
                ? [{ value: currentValue, searchText: currentValue, label: currentValue }]
                : []),
        ];
    }

    function groupedDropdownOptions(
        values: readonly string[],
        label: (value: string) => string,
        currentValue: string,
        frequentlyUsedValues: readonly string[],
    ): DropdownOptionGroup[] {
        const options = dropdownOptions(values, label, currentValue);
        const frequentlyUsed = new Set(frequentlyUsedValues);
        const optionsByValue = new Map(options.map((option) => [String(option.value), option]));
        return [
            { options: options.filter((option) => option.value === "") },
            {
                label: m.countryGroupFrequentlyUsed(),
                options: frequentlyUsedValues
                    .map((value) => optionsByValue.get(value))
                    .filter((option): option is DropdownOption => option !== undefined),
            },
            {
                label: m.countryGroupOther(),
                options: options.filter(
                    (option) => option.value !== "" && !frequentlyUsed.has(String(option.value)),
                ),
            },
        ];
    }

    function updateClientField(field: keyof SharedFormData, value: DropdownSelection) {
        if (Array.isArray(value)) return;
        localClient[field] = String(value) as never;
    }

    function accessibilityLabel(value: string) {
        if (value === "Yes, sometimes") return m.accessibilityYesSometimes();
        if (value === "Yes, often") return m.accessibilityYesOften();
        if (value === "No") return m.noOption();
        return value;
    }

    function mainLanguageLabel(value: string) {
        const labels: Record<string, () => string> = {
            English: m.languageEnglishOption,
            French: m.languageFrenchOption,
            "An Indigenous language": m.languageIndigenousOption,
            Cantonese: m.languageCantoneseOption,
            Dinka: m.languageDinkaOption,
            Farsi: m.languageFarsiOption,
            Hindi: m.languageHindiOption,
            Korean: m.languageKoreanOption,
            Kurdish: m.languageKurdishOption,
            Mandarin: m.languageMandarinOption,
            Nuer: m.languageNuerOption,
            Pashto: m.languagePashtoOption,
            Polish: m.languagePolishOption,
            Punjabi: m.languagePunjabiOption,
            Somali: m.languageSomaliOption,
            Spanish: m.languageSpanishOption,
            Tagalog: m.languageTagalogOption,
            Urdu: m.languageUrduOption,
            Vietnamese: m.languageVietnameseOption,
            Other: m.genderOther,
            Arabic: m.languageArabicOption,
            "Don't Know": m.dontKnowOption,
        };
        return labels[value]?.() ?? value;
    }

    function populationGroupLabel(value: string) {
        const labels: Record<string, () => string> = {
            "Indigenous (First Nations, Metis, Inuit)": m.populationGroupIndigenous,
            "African/Caribbean": m.populationGroupAfricanCaribbean,
            Chinese: m.populationGroupChinese,
            Filipino: m.populationGroupFilipino,
            Japanese: m.populationGroupJapanese,
            Korean: m.populationGroupKorean,
            "Latin American": m.populationGroupLatinAmerican,
            "South Asian (Indian, Pakistani, Sri Lankan, etc.)": m.populationGroupSouthAsian,
            "Southeast Asian (Vietnamese, Cambodian, Thai, Laotian, etc.)": m.populationGroupSoutheastAsian,
            "If more than one group not listed, write other population group(s)": m.populationGroupMultipleOther,
            "Arab/West Asian": m.populationGroupArabWestAsian,
            White: m.populationGroupWhite,
        };
        return labels[value]?.() ?? value;
    }

    function indigenousIdentityLabel(value: string) {
        if (value === "Not applicable") return m.indigenousNotApplicable();
        if (value === "First Nations (Status/Non-Status)") return m.indigenousFirstNations();
        if (value === "Métis") return m.indigenousMetis();
        if (value === "Inuk (Inuit)") return m.indigenousInuk();
        return value;
    }

    function housingSituationLabel(value: string) {
        if (value === "Stable housing") return m.housingStable();
        if (value === "Temporary housing") return m.housingTemporary();
        if (value === "Couch surfing") return m.housingCouchSurfing();
        if (value === "Shelter") return m.housingShelter();
        if (value === "No shelter, sleeping rough") return m.housingNoShelter();
        if (value === "Other") return m.genderOther();
        return value;
    }

    const maritalStatusValues = ["Married", "Common Law", "Widowed", "Separated", "Single", "Divorced"] as const;
    const educationLevelValues = ["Certificate", "Diploma", "Bachelor’s Degree or Above"] as const;
    const primaryIncomeValues = [
        "No Income",
        "Employment",
        "AISH",
        "Alberta Income Support",
        "Alberta Family Employment Tax Credit",
        "Alberta Child Benefit",
        "Canada Child Benefit",
        "Canada Pension Plan (CPP)",
        "Old Age Security (OAS)",
        "Alberta Seniors Benefit (ASB)",
        "Guaranteed Income Supplement (GIS)",
        "Personal Private Pension / Savings / Trustfund / Inheritance",
        "War Veterans Allowance (WVA)",
        "Workers Compensation (WCB)",
        "GST Rebate",
        "Employment Insurance (EI)",
        "Alternative Incomesource / Parents",
    ] as const;

    function maritalStatusLabel(value: string) {
        const labels: Record<string, () => string> = {
            Married: m.maritalStatusMarried,
            "Common Law": m.maritalStatusCommonLaw,
            Widowed: m.maritalStatusWidowed,
            Separated: m.maritalStatusSeparated,
            Single: m.maritalStatusSingle,
            Divorced: m.maritalStatusDivorced,
        };
        return labels[value]?.() ?? value;
    }

    function educationLevelLabel(value: string) {
        const labels: Record<string, () => string> = {
            Certificate: m.educationCertificate,
            Diploma: m.educationDiploma,
            "Bachelor’s Degree or Above": m.educationBachelorOrAbove,
        };
        return labels[value]?.() ?? value;
    }

    function primaryIncomeLabel(value: string) {
        const labels: Record<string, () => string> = {
            "No Income": m.incomeNoIncome,
            Employment: m.incomeEmployment,
            AISH: m.incomeAish,
            "Alberta Income Support": m.incomeAlbertaIncomeSupport,
            "Alberta Family Employment Tax Credit": m.incomeAlbertaFamilyEmploymentTaxCredit,
            "Alberta Child Benefit": m.incomeAlbertaChildBenefit,
            "Canada Child Benefit": m.incomeCanadaChildBenefit,
            "Canada Pension Plan (CPP)": m.incomeCanadaPensionPlan,
            "Old Age Security (OAS)": m.incomeOldAgeSecurity,
            "Alberta Seniors Benefit (ASB)": m.incomeAlbertaSeniorsBenefit,
            "Guaranteed Income Supplement (GIS)": m.incomeGuaranteedIncomeSupplement,
            "Personal Private Pension / Savings / Trustfund / Inheritance": m.incomePrivatePensionSavings,
            "War Veterans Allowance (WVA)": m.incomeWarVeteransAllowance,
            "Workers Compensation (WCB)": m.incomeWorkersCompensation,
            "GST Rebate": m.incomeGstRebate,
            "Employment Insurance (EI)": m.incomeEmploymentInsurance,
            "Alternative Incomesource / Parents": m.incomeAlternativeParents,
        };
        return labels[value]?.() ?? value;
    }

    const gradeValues = Array.from({ length: 12 }, (_, index) => String(index + 1));
    const majorLanguageOptionGroups = $derived(
        groupedDropdownOptions(
            FSII_MAIN_LANGUAGE_VALUES,
            mainLanguageLabel,
            localClient.majorLanguage,
            ["Mandarin", "Cantonese", "English", "French"],
        ),
    );
    const populationGroupOptionGroups = $derived(
        groupedDropdownOptions(
            FSII_POPULATION_GROUP_VALUES,
            populationGroupLabel,
            localClient.populationGroup,
            [
                "Chinese",
                "White",
                "Southeast Asian (Vietnamese, Cambodian, Thai, Laotian, etc.)",
            ],
        ),
    );
    const indigenousIdentityOptions = $derived(dropdownOptions(FSII_INDIGENOUS_IDENTITY_VALUES, indigenousIdentityLabel, localClient.indigenousIdentity));
    const housingSituationOptions = $derived(dropdownOptions(FSII_HOUSING_SITUATION_VALUES, housingSituationLabel, localClient.housingSituation));
    const maritalStatusOptions = $derived(dropdownOptions(maritalStatusValues, maritalStatusLabel, localClient.maritalStatus));
    const gradeInSchoolOptions = $derived(dropdownOptions(gradeValues, (value) => m.gradeOption({ grade: Number(value) }), localClient.gradeInSchool));
    const highestGradeOptions = $derived(dropdownOptions(gradeValues, (value) => m.gradeOption({ grade: Number(value) }), localClient.highestGrade));
    const educationLevelOptions = $derived(dropdownOptions(educationLevelValues, educationLevelLabel, localClient.educationLevel));
    const primaryIncomeOptions = $derived(dropdownOptions(primaryIncomeValues, primaryIncomeLabel, localClient.primaryIncome));
    const physicalAccessibilityDifficultyOptions = $derived(dropdownOptions(FSII_ACCESSIBILITY_DIFFICULTY_VALUES, accessibilityLabel, localClient.physicalAccessibilityDifficulty));
    const cognitiveDifficultyOptions = $derived(dropdownOptions(FSII_ACCESSIBILITY_DIFFICULTY_VALUES, accessibilityLabel, localClient.cognitiveDifficulty));
    const emotionalMentalHealthConditionOptions = $derived(dropdownOptions(FSII_ACCESSIBILITY_DIFFICULTY_VALUES, accessibilityLabel, localClient.emotionalMentalHealthCondition));
    const communityOptions = $derived(dropdownOptions(FSII_NEIGHBOURHOOD_VALUES, (value) => value, localClient.community));
</script>

<form
    id={formId}
    bind:this={formElement}
    onsubmit={requestSubmitConfirmation}
    class={`space-y-6 ${!isTemporary ? "member-form-scope" : ""}`}
    novalidate
>
    <section class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-6">
            <PersonBasicInfoSection
                bind:person={localClient}
                kind={isTemporary ? "temporary" : "member"}
                {mode}
                legalNameRequired={true}
                fieldPrefix="client-form"
                flatFieldContainers={true}
            />

            <div class="card ui-panel">
                    <div class="card-body">
                        <h2 class="card-title text-xl">
                            <Users class="h-5 w-5 text-primary" />
                            {m.fsiiRequirements()}
                        </h2>

                        <div class="space-y-4">
                            <FormSectionDivider label={m.fsiiGroupDemographics()} />

                            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("majorLanguage")}>
                                    {m.majorLanguage()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("majorLanguage")} name="majorLanguage" value={localClient.majorLanguage} optionGroups={majorLanguageOptionGroups} onChange={(value) => updateClientField("majorLanguage", value)} disabled={isReadonly} ariaLabel={m.majorLanguage()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("majorLanguage")} name="majorLanguage" bind:value={localClient.majorLanguage} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each FSII_MAIN_LANGUAGE_VALUES as language}<option value={language}>{mainLanguageLabel(language)}</option>{/each}
                                        {#if localClient.majorLanguage && !hasOption(FSII_MAIN_LANGUAGE_VALUES, localClient.majorLanguage)}
                                            <option value={localClient.majorLanguage}>{localClient.majorLanguage}</option>
                                        {/if}
                                    </select>
                                {/if}
                                </div>

                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("populationGroup")}>
                                    {m.populationGroup()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("populationGroup")} name="populationGroup" value={localClient.populationGroup} optionGroups={populationGroupOptionGroups} onChange={(value) => updateClientField("populationGroup", value)} disabled={isReadonly} ariaLabel={m.populationGroup()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("populationGroup")} name="populationGroup" bind:value={localClient.populationGroup} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each FSII_POPULATION_GROUP_VALUES as populationGroup}<option value={populationGroup}>{populationGroupLabel(populationGroup)}</option>{/each}
                                        {#if localClient.populationGroup && !hasOption(FSII_POPULATION_GROUP_VALUES, localClient.populationGroup)}
                                            <option value={localClient.populationGroup}>{localClient.populationGroup}</option>
                                        {/if}
                                    </select>
                                {/if}
                                </div>

                                <div class="min-w-0">
                                    <label class="text-xs font-semibold text-base-content/60" for={fieldId("indigenousIdentity")}>
                                        {m.indigenousIdentity()}
                                    </label>
                                    {#if !isTemporary}
                                        <Dropdown id={fieldId("indigenousIdentity")} name="indigenousIdentity" value={localClient.indigenousIdentity} options={indigenousIdentityOptions} onChange={(value) => updateClientField("indigenousIdentity", value)} disabled={isReadonly} ariaLabel={m.indigenousIdentity()} className="mt-2 w-full" />
                                    {:else}
                                        <select id={fieldId("indigenousIdentity")} name="indigenousIdentity" bind:value={localClient.indigenousIdentity} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                            <option value="">--</option>
                                            {#each FSII_INDIGENOUS_IDENTITY_VALUES as identity}<option value={identity}>{indigenousIdentityLabel(identity)}</option>{/each}
                                        </select>
                                    {/if}
                                </div>
                            </div>

                            <FormSectionDivider label={m.fsiiGroupHousehold()} />

                            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div class="min-w-0">
                                    <label class="text-xs font-semibold text-base-content/60" for={fieldId("numberAdult")}>
                                        {m.householdAdults()}
                                    </label>
                                    <input
                                        type="number"
                                        id={fieldId("numberAdult")}
                                        name="numberAdult"
                                        bind:value={localClient.numberAdult}
                                        class="input input-bordered mt-2 w-full bg-base-100"
                                        min="0"
                                        step="1"
                                        readonly={isReadonly}
                                    />
                                </div>

                                <div class="min-w-0">
                                    <label class="text-xs font-semibold text-base-content/60" for={fieldId("numberChild")}>
                                        {m.householdChildren()}
                                    </label>
                                    <input
                                        type="number"
                                        id={fieldId("numberChild")}
                                        name="numberChild"
                                        bind:value={localClient.numberChild}
                                        class="input input-bordered mt-2 w-full bg-base-100"
                                        min="0"
                                        step="1"
                                        readonly={isReadonly}
                                    />
                                </div>

                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("housingSituation")}>
                                    {m.housingSituation()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("housingSituation")} name="housingSituation" value={localClient.housingSituation} options={housingSituationOptions} onChange={(value) => updateClientField("housingSituation", value)} disabled={isReadonly} ariaLabel={m.housingSituation()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("housingSituation")} name="housingSituation" bind:value={localClient.housingSituation} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each FSII_HOUSING_SITUATION_VALUES as housingSituation}<option value={housingSituation}>{housingSituationLabel(housingSituation)}</option>{/each}
                                        {#if localClient.housingSituation && !hasOption(FSII_HOUSING_SITUATION_VALUES, localClient.housingSituation)}
                                            <option value={localClient.housingSituation}>{localClient.housingSituation}</option>
                                        {/if}
                                    </select>
                                {/if}
                                </div>
                            </div>

                            <FormSectionDivider label={m.fsiiGroupMarital()} />

                            <div class="grid gap-4 sm:grid-cols-2">
                                <div class="min-w-0">
                                    <label class="text-xs font-semibold text-base-content/60" for={fieldId("maritalStatus")}>
                                        {m.maritalStatus()}
                                    </label>
                                    {#if !isTemporary}
                                        <Dropdown id={fieldId("maritalStatus")} name="maritalStatus" value={localClient.maritalStatus} options={maritalStatusOptions} onChange={(value) => updateClientField("maritalStatus", value)} disabled={isReadonly} ariaLabel={m.maritalStatus()} className="mt-2 w-full" />
                                    {:else}
                                        <select id={fieldId("maritalStatus")} name="maritalStatus" bind:value={localClient.maritalStatus} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                            <option value="">--</option>
                                            {#each maritalStatusValues as value}<option {value}>{maritalStatusLabel(value)}</option>{/each}
                                        </select>
                                    {/if}
                                </div>

                            </div>

                            <FormSectionDivider label={m.fsiiGroupEducation()} />

                            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("gradeInSchool")}>
                                    {m.gradeInSchool()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("gradeInSchool")} name="gradeInSchool" value={localClient.gradeInSchool} options={gradeInSchoolOptions} onChange={(value) => updateClientField("gradeInSchool", value)} disabled={isReadonly} ariaLabel={m.gradeInSchool()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("gradeInSchool")} name="gradeInSchool" bind:value={localClient.gradeInSchool} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each gradeValues as value}<option {value}>{m.gradeOption({ grade: Number(value) })}</option>{/each}
                                    </select>
                                {/if}
                                </div>

                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("highestGrade")}>
                                    {m.highestGrade()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("highestGrade")} name="highestGrade" value={localClient.highestGrade} options={highestGradeOptions} onChange={(value) => updateClientField("highestGrade", value)} disabled={isReadonly} ariaLabel={m.highestGrade()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("highestGrade")} name="highestGrade" bind:value={localClient.highestGrade} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each gradeValues as value}<option {value}>{m.gradeOption({ grade: Number(value) })}</option>{/each}
                                    </select>
                                {/if}
                                </div>

                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("educationLevel")}>
                                    {m.educationLevel()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("educationLevel")} name="educationLevel" value={localClient.educationLevel} options={educationLevelOptions} onChange={(value) => updateClientField("educationLevel", value)} disabled={isReadonly} ariaLabel={m.educationLevel()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("educationLevel")} name="educationLevel" bind:value={localClient.educationLevel} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each educationLevelValues as value}<option {value}>{educationLevelLabel(value)}</option>{/each}
                                    </select>
                                {/if}
                                </div>
                            </div>

                            <FormSectionDivider label={m.fsiiGroupArrivalIncome()} />

                            <div class="grid gap-4 sm:grid-cols-2">
                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("arrivalMonth")}>
                                    {m.arrivalMonth()}
                                </label>
                                <SegmentedDateInput
                                    inputClass="input input-bordered min-w-0 w-full bg-base-100"
                                    bind:value={localClient.arrivalMonth}
                                    precision="month"
                                    id={fieldId("arrivalMonth")}
                                    name="arrivalMonth"
                                    class="mt-2"
                                    ariaLabel={m.arrivalMonth()}
                                    yearLabel={m.year()}
                                    monthLabel={m.month()}
                                    yearPlaceholder={m.activityRegistrationDobYearShort()}
                                    monthPlaceholder={m.activityRegistrationDobMonthShort()}
                                    readonly={isReadonly}
                                />
                                </div>

                                <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("primaryIncome")}>
                                    {m.primaryIncome()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("primaryIncome")} name="primaryIncome" value={localClient.primaryIncome} options={primaryIncomeOptions} onChange={(value) => updateClientField("primaryIncome", value)} disabled={isReadonly} ariaLabel={m.primaryIncome()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("primaryIncome")} name="primaryIncome" bind:value={localClient.primaryIncome} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each primaryIncomeValues as value}<option {value}>{primaryIncomeLabel(value)}</option>{/each}
                                    </select>
                                {/if}
                                </div>
                            </div>

                            <FormSectionDivider label={m.fsiiGroupHealth()} />

                            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {#each [
                                    { name: "physicalAccessibilityDifficulty", label: m.physicalAccessibilityDifficulty() },
                                    { name: "cognitiveDifficulty", label: m.cognitiveDifficulty() },
                                    { name: "emotionalMentalHealthCondition", label: m.emotionalMentalHealthCondition() },
                                ] as field}
                                    <div class="min-w-0">
                                        <label class="text-xs font-semibold text-base-content/60" for={fieldId(field.name)}>
                                            {field.label}
                                        </label>
                                        {#if !isTemporary}
                                            {@const options = field.name === "physicalAccessibilityDifficulty" ? physicalAccessibilityDifficultyOptions : field.name === "cognitiveDifficulty" ? cognitiveDifficultyOptions : emotionalMentalHealthConditionOptions}
                                            <Dropdown id={fieldId(field.name)} name={field.name} value={localClient[field.name as keyof ClientData] as string} options={options} onChange={(value) => updateClientField(field.name as keyof SharedFormData, value)} disabled={isReadonly} ariaLabel={field.label} className="mt-2 w-full" />
                                        {:else}
                                            <select id={fieldId(field.name)} name={field.name} bind:value={localClient[field.name as keyof ClientData] as string} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                                <option value="">--</option>
                                                {#each FSII_ACCESSIBILITY_DIFFICULTY_VALUES as option}<option value={option}>{accessibilityLabel(option)}</option>{/each}
                                            </select>
                                        {/if}
                                    </div>
                                {/each}
                            </div>

                        </div>
                    </div>
            </div>
        </div>

        <aside class="space-y-6">
            <div class="card ui-panel">
                <div class="card-body">
                    <h2 class="card-title text-xl">
                        {m.contactInfo()}
                    </h2>

                    <div class="space-y-3">
                        <div class="min-w-0">
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("address")}>
                                {m.address()}
                            </label>
                            <input
                                type="text"
                                id={fieldId("address")}
                                name="address"
                                bind:value={localClient.address}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                            />
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("postalCode")}>
                                    {m.postalCode()}
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("postalCode")}
                                    name="postalCode"
                                    bind:value={localClient.postalCode}
                                    pattern="[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]"
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                />
                            </div>

                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("community")}>
                                    {m.community()}
                                </label>
                                {#if !isTemporary}
                                    <Dropdown id={fieldId("community")} name="community" value={localClient.community} options={communityOptions} onChange={(value) => updateClientField("community", value)} disabled={isReadonly} ariaLabel={m.community()} className="mt-2 w-full" />
                                {:else}
                                    <select id={fieldId("community")} name="community" bind:value={localClient.community} class="select select-bordered mt-2 w-full bg-base-100" disabled={isReadonly}>
                                        <option value="">--</option>
                                        {#each FSII_NEIGHBOURHOOD_VALUES as neighbourhood}<option value={neighbourhood}>{neighbourhood}</option>{/each}
                                    </select>
                                {/if}
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("tel")}>
                                    {m.tel()}
                                    {#if isTemporary}<span class="text-error" aria-hidden="true">*</span>{/if}
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("tel")}
                                    name="tel"
                                    bind:value={localClient.tel}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                    required={isTemporary}
                                    maxlength={isTemporary ? TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH : undefined}
                                />
                            </div>

                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("wechatID")}>
                                    {m.wechatID()}
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("wechatID")}
                                    name="wechatID"
                                    bind:value={localClient.wechatID}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                    maxlength={isTemporary ? TEMPORARY_PARTICIPANT_WECHAT_ID_MAX_LENGTH : undefined}
                                />
                            </div>
                        </div>

                        <div class="min-w-0">
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("email")}>
                                {m.email()}
                                {#if isTemporary}<span class="text-error" aria-hidden="true">*</span>{/if}
                            </label>
                            <input
                                type="email"
                                id={fieldId("email")}
                                name="email"
                                bind:value={localClient.email}
                                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                                required={isTemporary}
                                maxlength={isTemporary ? TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH : undefined}
                            />
                        </div>

                        <div class="divider my-1"></div>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("emergencyContactPerson")}>
                                    {m.emergencyContactPerson()}
                                    <span class="text-error" aria-hidden="true">*</span>
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("emergencyContactPerson")}
                                    name="emergencyContactPerson"
                                    bind:value={localClient.emergencyContactPerson}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                    required
                                />
                            </div>

                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("emergencyContactRelationship")}>
                                    {m.emergencyContactRelationship()}
                                    <span class="text-error" aria-hidden="true">*</span>
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("emergencyContactRelationship")}
                                    name="emergencyContactRelationship"
                                    bind:value={localClient.emergencyContactRelationship}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                    required
                                />
                            </div>
                        </div>

                        <div class="min-w-0">
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("emergencyContactTel")}>
                                {m.emergencyContactTel()}
                                <span class="text-error" aria-hidden="true">*</span>
                            </label>
                            <input
                                type="text"
                                id={fieldId("emergencyContactTel")}
                                name="emergencyContactTel"
                                bind:value={localClient.emergencyContactTel}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                                required
                            />
                        </div>
                    </div>
                </div>
            </div>

            {#if !isTemporary}<div class="card ui-panel">
                <div class="card-body">
                    <h2 class="card-title text-xl">
                        <Users class="h-5 w-5 text-primary" />
                        {m.referralInfo()}
                    </h2>

                    <div class="space-y-3">
                        <div class="min-w-0">
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("referrerName")}>
                                {m.referrerName()}
                                <span class="text-error" aria-hidden="true">*</span>
                            </label>
                            <input
                                type="text"
                                id={fieldId("referrerName")}
                                name="referrerName"
                                bind:value={localClient.referrerName}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                                required
                            />
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("directorName")}>
                                    {m.directorName()}
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("directorName")}
                                    name="directorName"
                                    bind:value={localClient.directorName}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                />
                            </div>

                            <div class="min-w-0">
                                <label class="text-xs font-semibold text-base-content/60" for={fieldId("approverName")}>
                                    {m.approverName()}
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("approverName")}
                                    name="approverName"
                                    bind:value={localClient.approverName}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>{/if}

            {#if !hideRemark}<div class="card ui-panel">
                <div class="card-body">
                    <h2 class="card-title text-xl">
                        <Home class="h-5 w-5 text-primary" />
                        {m.remark()}
                    </h2>
                    <textarea
                        id={fieldId("remark")}
                        name="remark"
                        bind:value={localClient.remark}
                        class="textarea textarea-bordered min-h-32 bg-base-200/50"
                        readonly={isReadonly}
                    ></textarea>
                </div>
            </div>{/if}
        </aside>
    </section>

</form>

<dialog bind:this={confirmDialog} class="modal">
    <div class="ui-modal-box">
        <h3 class="font-bold text-lg">
            {mode === "add" ? m.confirmSave() : m.confirmUpdate()}
        </h3>
        <div class="py-4 space-y-2 text-sm">
            <p>
                <span class="opacity-70 inline-block w-24"
                    >{m.clientCode()}:</span
                >
                {isAddMode ? m.clientCodeAutoPlaceholder() : (isTemporary ? localClient.participantCode : localClient.clientCode)}
            </p>
            <p>
                <span class="opacity-70 inline-block w-24"
                    >{m.chineseName()}:</span
                >
                {confirmationDisplayName}
            </p>
                {#if localClient.gender}
                <p>
                    <span class="opacity-70 inline-block w-24"
                        >{m.gender()}:</span
                    >
                    {localClient.gender}
                </p>
            {/if}
            {#if missingRequiredFields.length > 0}
                <div class="alert alert-warning mt-4 text-sm">
                    <div>
                        <p class="font-semibold">{m.clientRequiredFieldsWarning()}</p>
                        <ul class="mt-2 list-disc space-y-1 pl-5">
                            {#each missingRequiredFields as field}
                                <li>{field}</li>
                            {/each}
                        </ul>
                    </div>
                </div>
            {/if}
            {#if chineseNameSuggestion}
                <div class="alert alert-warning mt-4 text-sm">
                    <span>
                        {m.traditionalChineseNameConfirmWarning({
                            traditional: chineseNameSuggestion.traditional,
                            simplified: chineseNameSuggestion.simplified,
                        })}
                    </span>
                </div>
            {/if}
        </div>
        <div class="modal-action">
            <form method="dialog">
                <button class="btn">{m.cancel()}</button>
            </form>
            <button
                class="btn btn-primary"
                onclick={confirmSubmit}
                disabled={isSubmitting}
            >
                {#if isSubmitting}<span class="loading loading-spinner"
                    ></span>{/if}
                {chineseNameSuggestion ? m.traditionalChineseNameContinueSave() : m.confirmSubmit()}
            </button>
        </div>
    </div>
</dialog>
