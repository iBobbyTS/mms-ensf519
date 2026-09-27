<script lang="ts">
    import { Baby, User } from "lucide-svelte";
    import { Dropdown, type DropdownOption, type DropdownOptionGroup, type DropdownSelection } from "@ibobbyts/svelte-ui-utils/dropdown";

    import TraditionalChineseInput from "$lib/components/TraditionalChineseInput.svelte";
    import { todayBusinessDate } from "$lib/local-date";
    import { FSII_BIRTH_COUNTRY_VALUES } from "$lib/fsii-member-demographics";
    import { FEATURED_COUNTRY_VALUES, localizedCountryLabel, orderCountryValues } from "$lib/country-label";
    import { GENDER_VALUES, MEMBER_GENDER_VALUES } from "$lib/gender";
    import * as m from "$lib/paraglide/messages";
    import { getLocale } from "$lib/paraglide/runtime";
    import { RESIDENTIAL_STATUS_VALUES } from "$lib/residential-status";
    import {
        TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH,
        TEMPORARY_PARTICIPANT_LEGAL_NAME_PATTERN,
        temporaryParticipantMaxDob,
    } from "$lib/temporary-participant";

    type PersonKind = "member" | "child" | "temporary";
    type PersonMode = "add" | "edit" | "view";

    type BasicPerson = {
        membershipType: "General" | "Lifetime";
        membershipExpiryDate?: string;
        registrationDate: string;
        firstName: string;
        lastName: string;
        legalNamePhotoIdVerified?: boolean;
        englishName: string;
        chineseName: string;
        gender: string;
        otherGender?: string;
        dob: string;
        // "Age only" dob mode view/form fields; ageYears !== "" marks an age
        // record and dobAgeOnly is the form checkbox state (adult kinds only).
        ageYears?: string;
        ageUpdatedDate?: string;
        dobAgeOnly?: boolean | null;
        cob: string;
        birthProvince?: string;
        birthCity?: string;
        residentialStatus: string;
        isVolunteer?: boolean;
        yearOfArrival?: number | null;
    };

    let {
        person = $bindable<BasicPerson>(),
        kind,
        mode = "add",
        fieldPrefix = "person-basic",
        readonly = false,
        legalNameRequired = true,
        membershipStatusLabel = "",
        membershipBadgeClass = "badge-ghost",
        flatFieldContainers = false,
    } : {
        person: BasicPerson;
        kind: PersonKind;
        mode?: PersonMode;
        fieldPrefix?: string;
        readonly?: boolean;
        legalNameRequired?: boolean;
        membershipStatusLabel?: string;
        membershipBadgeClass?: string;
        flatFieldContainers?: boolean;
    } = $props();

    const isView = $derived(mode === "view");
    const isReadonly = $derived(readonly || isView);
    const fieldContainerClass = $derived(
        flatFieldContainers ? "min-w-0" : "rounded-box bg-base-200/50 p-4",
    );
    const usesAdultProfile = $derived(kind !== "child");
    const profileDetailsRequired = $derived(usesAdultProfile);
    const chineseNameRequired = $derived(kind === "child");
    const currentLocale = $derived(getLocale());

    // Snapshot of the loaded age so the right-hand date can mirror the server
    // restamp rule: unchanged age keeps the stored date, a changed or fresh
    // age shows the business "today". The number input binding coerces
    // person.ageYears to a number, so compare via String() normalization.
    let loadedAgeYears = $state(person.ageYears ?? "");
    const dobAgeOnlyChecked = $derived(usesAdultProfile && person.dobAgeOnly === true);
    const isAgeRecord = $derived(usesAdultProfile && (person.ageYears ?? "") !== "");
    const dobAgeAssociatedDate = $derived.by(() => {
        if (!dobAgeOnlyChecked) return "";
        if ((person.ageYears ?? "") !== "" && String(person.ageYears) === loadedAgeYears && person.ageUpdatedDate) {
            return person.ageUpdatedDate;
        }
        return todayBusinessDate();
    });

    const currentGenderValues = $derived(
        usesAdultProfile ? MEMBER_GENDER_VALUES : GENDER_VALUES,
    );
    const genderOptions = $derived([
        { value: "", label: m.selectPlaceholder() },
        ...currentGenderValues.map((gender) => ({
            value: gender,
            searchText: gender,
            label:
                gender === "Male"
                    ? m.male()
                    : gender === "Female"
                        ? m.female()
                        : gender === "Transgender"
                            ? m.genderTransgender()
                            : gender === "Prefer not to disclose"
                                ? m.genderPreferNotToDisclose()
                                : m.genderOther(),
        })),
    ]);
    const legacyCountryValues = [
        "China", "Hong Kong", "Macau", "Taiwan", "Canada",
        "Cambodia", "Indonesia", "Malaysia", "Vietnam",
    ] as const;
    const legacyCountryOptions = $derived(createCountryOptions(legacyCountryValues));
    const memberCountryOptions = $derived(createCountryOptions([
        ...FSII_BIRTH_COUNTRY_VALUES,
        ...(person.cob && !(FSII_BIRTH_COUNTRY_VALUES as readonly string[]).includes(person.cob)
            ? [person.cob]
            : []),
    ]));
    const countryOptions = $derived(
        usesAdultProfile ? memberCountryOptions : legacyCountryOptions,
    );
    const countryOptionGroups = $derived(createCountryOptionGroups(countryOptions));
    const currentResidentialStatusOptions = $derived([
        { value: "", label: m.selectPlaceholder() },
        ...RESIDENTIAL_STATUS_VALUES.map((status) => ({
            value: status,
            searchText: status,
            label: residentialStatusLabel(status),
        })),
    ]);
    const legacyResidentialStatusOptions = $derived([
        { value: "", label: m.selectPlaceholder() },
        { value: "Citizen_Permanent Resident", searchText: "Citizen_Permanent Resident", label: m.citizenPR() },
        { value: "Temporary Resident", searchText: "Temporary Resident", label: m.temporaryResident() },
    ]);
    const residentialStatusOptions = $derived(
        usesAdultProfile ? currentResidentialStatusOptions : legacyResidentialStatusOptions,
    );

    const memberGenderOptions = $derived<DropdownOption[]>(genderOptions);
    const memberResidentialStatusOptions = $derived<DropdownOption[]>(residentialStatusOptions);

    function memberFieldChange(field: keyof BasicPerson, value: DropdownSelection) {
        if (Array.isArray(value)) return;
        person[field] = String(value) as never;
    }

    function fieldId(name: string) {
        return `${fieldPrefix}-${name}`;
    }

    function present(value: string | number | null | undefined) {
        if (value === null || value === undefined || String(value).trim() === "") {
            return m.notAvailable();
        }

        return String(value);
    }

    function genderLabel(value: string) {
        if (value === "Male") return m.male();
        if (value === "Female") return m.female();
        if (value === "Transgender") return m.genderTransgender();
        if (value === "Prefer not to disclose") return m.genderPreferNotToDisclose();
        if (value === "Other") return m.genderOther();
        return present(value);
    }

    function residentialStatusLabel(value: string) {
        if (value === "Citizen") return m.residentialStatusCitizen();
        if (value === "Permanent Resident") return m.residentialStatusPermanentResident();
        if (value === "Visitor") return m.residentialStatusVisitor();
        if (value === "International Student") return m.residentialStatusInternationalStudent();
        if (value === "Citizen_Permanent Resident") return m.citizenPR();
        if (value === "Temporary Resident") return m.temporaryResident();
        return present(value);
    }

    function countryLabel(value: string) {
        const labels: Record<string, () => string> = {
            Cambodia: m.countryCambodia,
            Canada: m.countryCanada,
            China: m.countryChina,
            "Hong Kong": m.countryHongKong,
            Indonesia: m.countryIndonesia,
            Macau: m.countryMacau,
            Taiwan: m.countryTaiwan,
            Malaysia: m.countryMalaysia,
            Vietnam: m.countryVietnam,
        };

        return labels[value]?.() ?? localizedCountryLabel(value, currentLocale);
    }

    function createCountryOptions(values: readonly string[]): DropdownOption[] {
        return [
            { value: "", label: "--" },
            ...orderCountryValues(values).map((country) => ({
                value: country,
                searchText: country === "Hong Kong"
                    ? "Hong Kong, China"
                    : country === "Macau"
                        ? "Macao, China"
                        : country === "Taiwan"
                            ? "Taiwan, China"
                            : country,
                label: countryLabel(country),
            })),
        ];
    }

    function createCountryOptionGroups(options: DropdownOption[]): DropdownOptionGroup[] {
        const featuredValues = new Set<string>(FEATURED_COUNTRY_VALUES);
        return [
            { options: options.filter((option) => option.value === "") },
            {
                label: m.countryGroupFrequentlyUsed(),
                options: options.filter((option) => featuredValues.has(String(option.value))),
            },
            {
                label: m.countryGroupOther(),
                options: options.filter((option) => option.value !== "" && !featuredValues.has(String(option.value))),
            },
        ];
    }
</script>

<div class={`card ui-panel ${usesAdultProfile && !isView ? "member-form-scope" : ""}`}>
    <div class="card-body">
        <h2 class="card-title text-xl">
            {#if kind === "child"}
                <Baby class="h-5 w-5 text-primary" />
            {:else}
                <User class="h-5 w-5 text-primary" />
            {/if}
            {m.generalInfo()}
        </h2>

        {#if isView}
            <dl class="client-detail-cell-grid client-detail-cell-grid--three grid gap-4">
                {#if membershipStatusLabel}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.membershipStatus()}
                        </dt>
                        <dd class="mt-2">
                            <span class={`badge ${membershipBadgeClass}`}>{membershipStatusLabel}</span>
                        </dd>
                    </div>
                {/if}
                {#if kind === "child"}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.membershipExpiryDate()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {present(person.membershipExpiryDate)}
                        </dd>
                    </div>
                {/if}
                {#if kind !== "temporary"}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.registrationDate()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {present(person.registrationDate)}
                        </dd>
                    </div>
                {/if}
                <div class={fieldContainerClass}>
                    <dt class="text-xs font-semibold text-base-content/60">
                        {m.chineseName()}
                    </dt>
                    <dd class="mt-1 break-words text-base font-medium">
                        {present(person.chineseName)}
                    </dd>
                </div>
                {#if kind === "child"}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.englishName()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {present(person.englishName)}
                        </dd>
                    </div>
                {/if}
                <div class={fieldContainerClass}>
                    <dt class="text-xs font-semibold text-base-content/60">
                        {m.legalName()}
                    </dt>
                    <dd class="mt-2 grid min-w-0 grid-cols-[fit-content(45%)_auto_minmax(0,1fr)] items-stretch gap-x-4">
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-base-content/50">
                                {m.legalNameFirstNameSegment()}
                            </div>
                            <div class="mt-1 break-words text-base font-semibold">
                                {present(person.firstName)}
                            </div>
                        </div>
                        <div class="w-px self-stretch bg-base-300" aria-hidden="true"></div>
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-base-content/50">
                                {m.legalNameLastNameSegment()}
                            </div>
                            <div class="mt-1 break-words text-base font-semibold">
                                {present(person.lastName)}
                            </div>
                        </div>
                    </dd>
                </div>
                {#if usesAdultProfile}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.legalNamePhotoIdVerified()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {person.legalNamePhotoIdVerified ? m.clientVerified() : m.clientNotVerified()}
                        </dd>
                    </div>
                {/if}
                <div class={fieldContainerClass}>
                    <dt class="text-xs font-semibold text-base-content/60">
                        {m.gender()}
                    </dt>
                    <dd
                        class="mt-1 break-words text-base font-medium"
                        data-client-detail-field={usesAdultProfile ? "gender" : undefined}
                    >
                        {genderLabel(person.gender)}
                    </dd>
                </div>
                {#if usesAdultProfile && person.gender === "Other"}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.otherGender()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium" data-client-detail-field="otherGender">
                            {present(person.otherGender)}
                        </dd>
                    </div>
                {/if}
                <div class={fieldContainerClass}>
                    <dt class="text-xs font-semibold text-base-content/60">
                        {m.residentialStatus()}
                    </dt>
                    <dd class="mt-1 break-words text-base font-medium">
                        {residentialStatusLabel(person.residentialStatus)}
                    </dd>
                </div>
                <div class={fieldContainerClass}>
                    <dt class="text-xs font-semibold text-base-content/60">
                        {m.cob()}
                    </dt>
                    <dd
                        class="mt-1 break-words text-base font-medium"
                        data-client-detail-field={usesAdultProfile ? "cob" : undefined}
                    >
                        {countryLabel(person.cob)}
                    </dd>
                </div>
                {#if usesAdultProfile}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.birthProvince()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {present(person.birthProvince)}
                        </dd>
                    </div>
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.birthCity()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {present(person.birthCity)}
                        </dd>
                    </div>
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.volunteer()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {person.isVolunteer ? m.yesOption() : m.noOption()}
                        </dd>
                    </div>
                {/if}
                {#if isAgeRecord}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.age()}
                        </dt>
                        <dd
                            class="mt-1 break-words text-base font-medium"
                            data-client-detail-field={usesAdultProfile ? "age" : undefined}
                        >
                            {person.ageYears} ({person.ageUpdatedDate})
                        </dd>
                    </div>
                {:else}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.dob()}
                        </dt>
                        <dd
                            class="mt-1 break-words text-base font-medium"
                            data-client-detail-field={usesAdultProfile ? "dob" : undefined}
                        >
                            {present(person.dob)}
                        </dd>
                    </div>
                {/if}
                {#if kind === "child"}
                    <div class={fieldContainerClass}>
                        <dt class="text-xs font-semibold text-base-content/60">
                            {m.yearOfArrival()}
                        </dt>
                        <dd class="mt-1 break-words text-base font-medium">
                            {present(person.yearOfArrival)}
                        </dd>
                    </div>
                {/if}
            </dl>
        {:else}
            {#if kind === "member"}
                <input type="hidden" name="clientType" value="Member" />
            {/if}

            <div class="space-y-4">
                <div class={`grid gap-4 ${usesAdultProfile ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                    {#if kind === "member"}
                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("membershipType")}>
                                {m.membershipStatus()}
                            </label>
                            <Dropdown
                                id={fieldId("membershipType")}
                                name="membershipType"
                                value={person.membershipType}
                                options={[{ value: "General", label: m.general() }, { value: "Lifetime", label: m.lifetime() }]}
                                onChange={(value) => memberFieldChange("membershipType", value)}
                                disabled={isReadonly}
                                required
                                ariaLabel={m.membershipStatus()}
                                className="mt-2 w-full"
                            />
                        </div>
                    {:else if kind === "child"}
                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("membershipExpiryDate")}>
                                {m.membershipExpiryDate()}
                            </label>
                            <input
                                type="date"
                                id={fieldId("membershipExpiryDate")}
                                name="membershipExpiryDate"
                                bind:value={person.membershipExpiryDate}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                            />
                        </div>
                    {/if}

                    <div class={fieldContainerClass}>
                        <TraditionalChineseInput
                            id={fieldId("chineseName")}
                            name="chineseName"
                            bind:value={person.chineseName}
                            label={m.chineseName()}
                            inputClass="input input-bordered mt-2 w-full bg-base-100"
                            layout="vertical"
                            readonly={isReadonly}
                            required={chineseNameRequired}
                            showRequiredIndicator={chineseNameRequired}
                        />
                    </div>

                    {#if usesAdultProfile}
                        <div class={fieldContainerClass}>
                            <label class="flex h-full cursor-pointer items-center gap-3 md:pt-6" for={fieldId("isVolunteer")}>
                                <input
                                    type="checkbox"
                                    id={fieldId("isVolunteer")}
                                    name="isVolunteer"
                                    bind:checked={person.isVolunteer}
                                    class="checkbox checkbox-primary"
                                    disabled={isReadonly}
                                />
                                <span class="text-xs font-semibold text-base-content/60">
                                    {m.volunteer()}
                                </span>
                            </label>
                        </div>
                    {:else}
                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("englishName")}>
                                {m.englishName()}
                            </label>
                            <input
                                type="text"
                                id={fieldId("englishName")}
                                name="englishName"
                                bind:value={person.englishName}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                            />
                        </div>
                    {/if}
                </div>

                {#if usesAdultProfile}
                    <div class="grid gap-4 md:grid-cols-3">
                        <div class={fieldContainerClass}>
                            <label class="min-w-0" for={fieldId("firstName")}>
                                <span class="text-xs font-semibold text-base-content/50">
                                    {m.legalFirstNameLabel()}
                                    {#if legalNameRequired}
                                        <span class="text-error" aria-hidden="true">*</span>
                                    {/if}
                                </span>
                                <input
                                    type="text"
                                    id={fieldId("firstName")}
                                    name="firstName"
                                    bind:value={person.firstName}
                                    class="input input-bordered mt-1 w-full bg-base-100"
                                    placeholder={m.legalNameFirstNameSegment()}
                                    readonly={isReadonly}
                                    required={legalNameRequired}
                                    maxlength={kind === "temporary" ? TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH : undefined}
                                    pattern={kind === "temporary" ? TEMPORARY_PARTICIPANT_LEGAL_NAME_PATTERN : undefined}
                                />
                            </label>
                        </div>
                        <div class={fieldContainerClass}>
                            <label class="min-w-0" for={fieldId("lastName")}>
                                <span class="text-xs font-semibold text-base-content/50">
                                    {m.legalLastNameLabel()}
                                    {#if legalNameRequired}
                                        <span class="text-error" aria-hidden="true">*</span>
                                    {/if}
                                </span>
                                <input
                                    type="text"
                                    id={fieldId("lastName")}
                                    name="lastName"
                                    bind:value={person.lastName}
                                    class="input input-bordered mt-1 w-full bg-base-100"
                                    placeholder={m.legalNameLastNameSegment()}
                                    readonly={isReadonly}
                                    required={legalNameRequired}
                                    maxlength={kind === "temporary" ? TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH : undefined}
                                    pattern={kind === "temporary" ? TEMPORARY_PARTICIPANT_LEGAL_NAME_PATTERN : undefined}
                                />
                            </label>
                        </div>
                        <div class={fieldContainerClass}>
                            <label class="flex h-full cursor-pointer items-center gap-3 md:pt-6" for={fieldId("legalNamePhotoIdVerified")}>
                                <input
                                    type="checkbox"
                                    id={fieldId("legalNamePhotoIdVerified")}
                                    name="legalNamePhotoIdVerified"
                                    bind:checked={person.legalNamePhotoIdVerified}
                                    class="checkbox checkbox-primary"
                                    disabled={isReadonly}
                                />
                                <span class="text-xs font-semibold text-base-content/60">
                                    {m.legalNamePhotoIdVerified()}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="grid gap-4 md:grid-cols-3">
                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("residentialStatus")}>
                                {m.residentialStatus()}
                                {#if profileDetailsRequired}
                                    <span class="text-error" aria-hidden="true">*</span>
                                {/if}
                            </label>
                            {#if usesAdultProfile}
                                <Dropdown
                                    id={fieldId("residentialStatus")}
                                    name="residentialStatus"
                                    value={person.residentialStatus}
                                    options={memberResidentialStatusOptions}
                                    onChange={(value) => memberFieldChange("residentialStatus", value)}
                                    disabled={isReadonly}
                                    required={profileDetailsRequired}
                                    ariaLabel={m.residentialStatus()}
                                    className="mt-2 w-full"
                                />
                            {:else}
                                <select
                                    id={fieldId("residentialStatus")}
                                    name="residentialStatus"
                                    bind:value={person.residentialStatus}
                                    class="select select-bordered mt-2 w-full bg-base-100"
                                    disabled={isReadonly}
                                    required={profileDetailsRequired}
                                >
                                    {#each residentialStatusOptions as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </select>
                            {/if}
                        </div>

                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("gender")}>
                                {m.gender()}
                                {#if profileDetailsRequired}
                                    <span class="text-error" aria-hidden="true">*</span>
                                {/if}
                            </label>
                            {#if usesAdultProfile}
                                <Dropdown
                                    id={fieldId("gender")}
                                    name="gender"
                                    value={person.gender}
                                    options={memberGenderOptions}
                                    onChange={(value) => memberFieldChange("gender", value)}
                                    disabled={isReadonly}
                                    required={profileDetailsRequired}
                                    ariaLabel={m.gender()}
                                    className="mt-2 w-full"
                                />
                            {:else}
                                <select
                                    id={fieldId("gender")}
                                    name="gender"
                                    bind:value={person.gender}
                                    class="select select-bordered mt-2 w-full bg-base-100"
                                    disabled={isReadonly}
                                    required={profileDetailsRequired}
                                >
                                    {#each genderOptions as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </select>
                            {/if}
                            {#if usesAdultProfile && person.gender === "Other"}
                                <label class="mt-3 block text-xs font-semibold text-base-content/60" for={fieldId("otherGender")}>
                                    {m.otherGender()}
                                </label>
                                <input
                                    type="text"
                                    id={fieldId("otherGender")}
                                    name="otherGender"
                                    bind:value={person.otherGender}
                                    maxlength="150"
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                />
                            {/if}
                        </div>

                        <div class={fieldContainerClass}>
                            <div class="flex items-center justify-between gap-2">
                                <label
                                    class="min-w-0 text-xs font-semibold text-base-content/60"
                                    for={fieldId(dobAgeOnlyChecked ? "dobAge" : "dob")}
                                >
                                    {dobAgeOnlyChecked ? m.age() : m.dob()}
                                    {#if profileDetailsRequired}
                                        <span class="text-error" aria-hidden="true">*</span>
                                    {/if}
                                </label>
                                <label
                                    class="flex shrink-0 cursor-pointer items-center gap-2"
                                    for={fieldId("dobAgeOnly")}
                                >
                                    <input
                                        type="checkbox"
                                        id={fieldId("dobAgeOnly")}
                                        name="dobAgeOnly"
                                        bind:checked={person.dobAgeOnly}
                                        class="checkbox checkbox-primary checkbox-sm"
                                        disabled={isReadonly}
                                    />
                                    <span class="text-xs font-semibold text-base-content/60">
                                        {m.dobAgeOnly()}
                                    </span>
                                </label>
                            </div>
                            {#if dobAgeOnlyChecked}
                                <div class="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        id={fieldId("dobAge")}
                                        name="dobAge"
                                        bind:value={person.ageYears}
                                        class="input input-bordered min-w-0 flex-1 bg-base-100"
                                        placeholder={m.dobAgePlaceholder()}
                                        readonly={isReadonly}
                                        required={profileDetailsRequired}
                                        min="0"
                                        max="120"
                                        step="1"
                                        inputmode="numeric"
                                    />
                                    <span
                                        class="shrink-0 text-xs font-semibold text-base-content/60"
                                        data-dob-age-updated-date
                                    >
                                        {dobAgeAssociatedDate}
                                    </span>
                                </div>
                            {:else}
                                <input
                                    type="date"
                                    id={fieldId("dob")}
                                    name="dob"
                                    bind:value={person.dob}
                                    class="input input-bordered mt-2 w-full bg-base-100"
                                    readonly={isReadonly}
                                    required={profileDetailsRequired}
                                    min={kind === "temporary" ? "1900-01-01" : undefined}
                                    max={kind === "temporary" ? temporaryParticipantMaxDob() : undefined}
                                />
                            {/if}
                        </div>
                    </div>

                    <div class="grid gap-4 md:grid-cols-3">
                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("cob")}>
                                {m.cob()}
                                {#if profileDetailsRequired}
                                    <span class="text-error" aria-hidden="true">*</span>
                                {/if}
                            </label>
                            {#if usesAdultProfile}
                                <Dropdown
                                    id={fieldId("cob")}
                                    name="cob"
                                    value={person.cob}
                                    optionGroups={countryOptionGroups}
                                    onChange={(value) => memberFieldChange("cob", value)}
                                    disabled={isReadonly}
                                    required={profileDetailsRequired}
                                    ariaLabel={m.cob()}
                                    className="mt-2 w-full"
                                />
                            {:else}
                                <select
                                    id={fieldId("cob")}
                                    name="cob"
                                    bind:value={person.cob}
                                    class="select select-bordered mt-2 w-full bg-base-100"
                                    disabled={isReadonly}
                                    required={profileDetailsRequired}
                                >
                                    <option value="">--</option>
                                    {#each countryOptionGroups.slice(1) as group}
                                        <optgroup label={group.label}>
                                            {#each group.options as option}
                                                <option value={option.value}>{option.label}</option>
                                            {/each}
                                        </optgroup>
                                    {/each}
                                </select>
                            {/if}
                        </div>

                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("birthProvince")}>
                                {m.birthProvince()}
                            </label>
                            <input
                                type="text"
                                id={fieldId("birthProvince")}
                                name="birthProvince"
                                bind:value={person.birthProvince}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                            />
                        </div>

                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("birthCity")}>
                                {m.birthCity()}
                            </label>
                            <input
                                type="text"
                                id={fieldId("birthCity")}
                                name="birthCity"
                                bind:value={person.birthCity}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                            />
                        </div>
                    </div>

                {:else}
                    <div class="grid gap-4 md:grid-cols-3">
                        <div class={fieldContainerClass}>
                            <div class="text-xs font-semibold text-base-content/60">
                                {m.legalName()}
                                {#if legalNameRequired}
                                    <span class="text-error" aria-hidden="true">*</span>
                                {/if}
                            </div>
                            <div class="mt-2 grid gap-3">
                                <label class="min-w-0" for={fieldId("firstName")}>
                                    <span class="text-xs font-semibold text-base-content/50">
                                        {m.legalNameFirstNameSegment()}
                                        {#if legalNameRequired}
                                            <span class="text-error" aria-hidden="true">*</span>
                                        {/if}
                                    </span>
                                    <input
                                        type="text"
                                        id={fieldId("firstName")}
                                        name="firstName"
                                        bind:value={person.firstName}
                                        class="input input-bordered mt-1 w-full bg-base-100"
                                        placeholder={m.legalNameFirstNameSegment()}
                                        readonly={isReadonly}
                                        required={legalNameRequired}
                                    />
                                </label>
                                <label class="min-w-0" for={fieldId("lastName")}>
                                    <span class="text-xs font-semibold text-base-content/50">
                                        {m.legalNameLastNameSegment()}
                                        {#if legalNameRequired}
                                            <span class="text-error" aria-hidden="true">*</span>
                                        {/if}
                                    </span>
                                    <input
                                        type="text"
                                        id={fieldId("lastName")}
                                        name="lastName"
                                        bind:value={person.lastName}
                                        class="input input-bordered mt-1 w-full bg-base-100"
                                        placeholder={m.legalNameLastNameSegment()}
                                        readonly={isReadonly}
                                        required={legalNameRequired}
                                    />
                                </label>
                            </div>
                        </div>

                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("gender")}>
                                {m.gender()}
                                {#if profileDetailsRequired}
                                    <span class="text-error" aria-hidden="true">*</span>
                                {/if}
                            </label>
                            <select
                                id={fieldId("gender")}
                                name="gender"
                                bind:value={person.gender}
                                class="select select-bordered mt-2 w-full bg-base-100"
                                disabled={isReadonly}
                                required={profileDetailsRequired}
                            >
                                {#each genderOptions as option}
                                    <option value={option.value}>{option.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                <div class="grid gap-4 md:grid-cols-3">
                    <div class={fieldContainerClass}>
                        <label class="text-xs font-semibold text-base-content/60" for={fieldId("residentialStatus")}>
                            {m.residentialStatus()}
                            {#if profileDetailsRequired}
                                <span class="text-error" aria-hidden="true">*</span>
                            {/if}
                        </label>
                        <select
                            id={fieldId("residentialStatus")}
                            name="residentialStatus"
                            bind:value={person.residentialStatus}
                            class="select select-bordered mt-2 w-full bg-base-100"
                            disabled={isReadonly}
                            required={profileDetailsRequired}
                        >
                            {#each residentialStatusOptions as option}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                    </div>

                    <div class={fieldContainerClass}>
                        <label class="text-xs font-semibold text-base-content/60" for={fieldId("cob")}>
                            {m.cob()}
                            {#if profileDetailsRequired}
                                <span class="text-error" aria-hidden="true">*</span>
                            {/if}
                        </label>
                        <select
                            id={fieldId("cob")}
                            name="cob"
                            bind:value={person.cob}
                            class="select select-bordered mt-2 w-full bg-base-100"
                            disabled={isReadonly}
                            required={profileDetailsRequired}
                        >
                            <option value="">--</option>
                            {#each countryOptionGroups.slice(1) as group}
                                <optgroup label={group.label}>
                                    {#each group.options as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </optgroup>
                            {/each}
                        </select>
                    </div>
                    <div class={fieldContainerClass}>
                        <label class="text-xs font-semibold text-base-content/60" for={fieldId("dob")}>
                            {m.dob()}
                            {#if profileDetailsRequired}
                                <span class="text-error" aria-hidden="true">*</span>
                            {/if}
                        </label>
                        <input
                            type="date"
                            id={fieldId("dob")}
                            name="dob"
                            bind:value={person.dob}
                            class="input input-bordered mt-2 w-full bg-base-100"
                            readonly={isReadonly}
                            required={profileDetailsRequired}
                        />
                    </div>
                </div>

                    <div class="grid gap-4 md:grid-cols-3">
                        <div class={fieldContainerClass}>
                            <label class="text-xs font-semibold text-base-content/60" for={fieldId("yearOfArrival")}>
                                {m.yearOfArrival()}
                            </label>
                            <input
                                type="number"
                                id={fieldId("yearOfArrival")}
                                name="yearOfArrival"
                                min="0"
                                step="1"
                                bind:value={person.yearOfArrival}
                                class="input input-bordered mt-2 w-full bg-base-100"
                                readonly={isReadonly}
                            />
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
