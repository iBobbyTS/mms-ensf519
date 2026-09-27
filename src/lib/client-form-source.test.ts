import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RESIDENTIAL_STATUS_VALUES } from "./residential-status.ts";

test("personal forms expose only fixed top-level primary actions", () => {
    const clientForm = readFileSync("src/lib/components/ClientForm.svelte", "utf8");
    const actionOwners = [
        "src/lib/components/ClientCreatePage.svelte",
        "src/routes/(app)/members/[id]/edit/+page.svelte",
    ].map((path) => readFileSync(path, "utf8"));

    for (const form of [clientForm]) {
        assert.doesNotMatch(form.slice(0, form.indexOf("</form>")), /onclick=\{oncancel\}|type="submit"/);
    }
    for (const owner of actionOwners) {
        assert.match(owner, /ui-action-row--floating/);
        assert.match(owner, /type="submit"/);
    }
});

test("member form warns about blank required fields without blocking confirmation", () => {
    const source = readFileSync("src/lib/components/ClientForm.svelte", "utf8");

    assert.match(source, /<form[\s\S]*novalidate/);
    assert.match(source, /querySelectorAll\("input, select, textarea"\)/);
    assert.match(source, /!field\.validity\.valid[\s\S]*!field\.validity\.valueMissing/);
    assert.match(source, /invalidBlockingField\.reportValidity\(\)/);
    assert.match(source, /field\.validity\.valueMissing/);
    assert.match(source, /m\.clientRequiredFieldsWarning\(\)/);
    assert.match(source, /confirmDialog\?\.showModal\(\)/);
    assert.doesNotMatch(source, /formElement\.reportValidity\(\)/);
});

test("member add form requires legal name fields", () => {
    const clientFormSource = readFileSync("src/lib/components/ClientForm.svelte", "utf8");
    const basicInfoSource = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");

    assert.match(clientFormSource, /legalNameRequired=\{true\}/);
    assert.match(basicInfoSource, /legalNameRequired = true/);
    assert.match(basicInfoSource, /required=\{legalNameRequired\}/);
});

test("adult profile required details show required indicators", () => {
    const source = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");

    assert.match(source, /const profileDetailsRequired = \$derived\(usesAdultProfile\)/);
    for (const field of ["gender", "residentialStatus", "cob", "dob"]) {
        // The adult dob label switches its target between the age and date
        // inputs when the age-only checkbox is checked.
        const labelAnchor = field === "dob"
            ? 'for={fieldId(dobAgeOnlyChecked ? "dobAge" : "dob")}'
            : `for={fieldId("${field}")}`;
        const block = source.slice(
            source.indexOf(labelAnchor),
            source.indexOf(`name="${field}"`),
        );
        assert.match(block, /profileDetailsRequired/);
        assert.match(block, /<span class="text-error" aria-hidden="true">\*<\/span>/);
    }

    const chineseNameBlock = source.slice(
        source.indexOf('id={fieldId("chineseName")}'),
        source.indexOf('<div class="grid gap-4 md:grid-cols-3">'),
    );
    assert.match(chineseNameBlock, /required=\{chineseNameRequired\}/);
    assert.match(chineseNameBlock, /showRequiredIndicator=\{chineseNameRequired\}/);
    assert.match(source, /const chineseNameRequired = \$derived\(kind === "child"\)/);
    assert.match(source, /id=\{fieldId\("birthProvince"\)\}/);
    assert.match(source, /id=\{fieldId\("birthCity"\)\}/);
    assert.doesNotMatch(
        source.slice(
            source.indexOf('for={fieldId("birthProvince")}'),
            source.indexOf('for={fieldId("birthCity")}'),
        ),
        /required/,
    );
    assert.match(source, /name="isVolunteer"/);
});

test("personal member basic information follows the requested three-column order", () => {
    const source = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");
    const firstRowStart = source.indexOf(
        '<div class={`grid gap-4 ${usesAdultProfile ? "md:grid-cols-3" : "md:grid-cols-2"}`}>',
    );
    const memberLayoutStart = source.indexOf(
        '{#if usesAdultProfile}\n                    <div class="grid gap-4 md:grid-cols-3">\n                        <div class={fieldContainerClass}>\n                            <label class="min-w-0" for={fieldId("firstName")}>',
        firstRowStart,
    );
    const memberLayoutEnd = source.indexOf("\n                {:else}", memberLayoutStart);
    assert.notEqual(firstRowStart, -1);
    assert.notEqual(memberLayoutStart, -1);
    assert.notEqual(memberLayoutEnd, -1);
    const firstRow = source.slice(firstRowStart, memberLayoutStart);
    const memberLayout = source.slice(memberLayoutStart, memberLayoutEnd);
    const fieldOrder = [
        'name="firstName"',
        'name="lastName"',
        'name="legalNamePhotoIdVerified"',
        'name="residentialStatus"',
        'name="gender"',
        'name="dob"',
        'name="cob"',
        'name="birthProvince"',
        'name="birthCity"',
    ];

    assert.match(firstRow, /name="membershipType"/);
    assert.match(firstRow, /name="chineseName"/);
    assert.match(firstRow, /name="isVolunteer"/);
    assert.match(firstRow, /md:grid-cols-3/);
    assert.match(firstRow, /\{:else\}/);
    assert.match(firstRow, /name="englishName"/);
    assert.doesNotMatch(memberLayout, /name="englishName"/);
    const firstRowPositions = [
        'name="membershipType"',
        'name="chineseName"',
        'name="isVolunteer"',
    ].map((field) => firstRow.indexOf(field));
    assert.ok(firstRowPositions.every((position) => position >= 0));
    assert.deepEqual(firstRowPositions, [...firstRowPositions].sort((a, b) => a - b));
    const fieldPositions = fieldOrder.map((field) => memberLayout.indexOf(field));
    assert.ok(fieldPositions.every((position) => position >= 0));
    assert.deepEqual(fieldPositions, [...fieldPositions].sort((a, b) => a - b));
    assert.equal(memberLayout.match(/<div class="grid gap-4 md:grid-cols-3">/g)?.length, 3);

    const genderStart = memberLayout.indexOf('for={fieldId("gender")}');
    // The adult dob label switches its target between the age and date inputs.
    const dobStart = memberLayout.indexOf('for={fieldId(dobAgeOnlyChecked ? "dobAge" : "dob")}');
    assert.ok(genderStart >= 0);
    assert.ok(dobStart > genderStart);
    const genderColumn = memberLayout.slice(
        genderStart,
        dobStart,
    );
    assert.match(genderColumn, /name="otherGender"/);
    assert.doesNotMatch(memberLayout, /name="isVolunteer"/);
});

test("personal member form uses only current residential status options", () => {
    const source = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");

    assert.match(source, /import \{ RESIDENTIAL_STATUS_VALUES \} from "\$lib\/residential-status"/);
    const currentOptionsBlock = source.slice(
        source.indexOf("const currentResidentialStatusOptions"),
        source.indexOf("const legacyResidentialStatusOptions"),
    );
    assert.match(currentOptionsBlock, /\.\.\.RESIDENTIAL_STATUS_VALUES\.map/);
    assert.deepEqual(RESIDENTIAL_STATUS_VALUES, [
        "Citizen",
        "Permanent Resident",
        "Visitor",
        "International Student",
    ]);
    assert.doesNotMatch(currentOptionsBlock, /value: "Citizen_Permanent Resident"/);
    assert.doesNotMatch(currentOptionsBlock, /value: "Temporary Resident"/);
    assert.match(
        source,
        /usesAdultProfile \? currentResidentialStatusOptions : legacyResidentialStatusOptions/,
    );
});

test("child member form keeps legacy residential status options", () => {
    const source = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");
    const legacyOptionsBlock = source.slice(
        source.indexOf("const legacyResidentialStatusOptions"),
        source.indexOf("const residentialStatusOptions"),
    );

    assert.match(legacyOptionsBlock, /value: "Citizen_Permanent Resident"/);
    assert.match(legacyOptionsBlock, /label: m\.citizenPR\(\)/);
    assert.match(legacyOptionsBlock, /value: "Temporary Resident"/);
    assert.match(legacyOptionsBlock, /label: m\.temporaryResident\(\)/);
});

test("member form requires emergency contacts and referrer", () => {
    const source = readFileSync("src/lib/components/ClientForm.svelte", "utf8");

    for (const field of [
        "emergencyContactPerson",
        "emergencyContactRelationship",
        "emergencyContactTel",
        "referrerName",
    ]) {
        const start = source.indexOf(`for={fieldId("${field}")}`);
        const end = source.indexOf("/>", source.indexOf(`bind:value={localClient.${field}}`));
        const block = source.slice(start, end);
        assert.match(block, /<span class="text-error" aria-hidden="true">\*<\/span>/);
        assert.match(block, /required/);
    }

    assert.match(source, /m\.referralInfo\(\)/);
    assert.match(source, /name="directorName"/);
    assert.match(source, /name="approverName"/);
    assert.match(source, /legalNameDisplay = \$derived/);
    assert.match(source, /localClient\.chineseName \|\| legalNameDisplay/);
});

test("country options keep their inventories and render accessible localized groups", () => {
    const source = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");
    const legacyValues = source.slice(
        source.indexOf("const legacyCountryValues"),
        source.indexOf("const memberCountryOptions"),
    );
    assert.match(legacyValues, /"Cambodia"/);
    assert.match(source, /Cambodia: m\.countryCambodia/);
    assert.match(source, /createCountryOptions\(\[\s*\.\.\.FSII_BIRTH_COUNTRY_VALUES/);
    assert.match(source, /usesAdultProfile \? memberCountryOptions : legacyCountryOptions/);
    assert.match(source, /optionGroups=\{countryOptionGroups\}/);
    assert.match(source, /label: m\.countryGroupFrequentlyUsed\(\)/);
    assert.match(source, /label: m\.countryGroupOther\(\)/);

    assert.match(source, /kind: PersonKind/);
    assert.match(source, /type PersonKind = "member" \| "child" \| "temporary"/);
});

test("personal member keeps free-text address separate from the FSII community inventory", () => {
    const source = readFileSync("src/lib/components/ClientForm.svelte", "utf8");
    const fsiiStart = source.indexOf("{m.fsiiRequirements()}");
    const contactStart = source.indexOf("{m.contactInfo()}", fsiiStart);
    const referralStart = source.indexOf("{m.referralInfo()}", contactStart);
    assert.ok(fsiiStart >= 0);
    assert.ok(contactStart > fsiiStart);
    assert.ok(referralStart > contactStart);
    const fsiiSection = source.slice(fsiiStart, contactStart);
    const contactSection = source.slice(contactStart, referralStart);

    assert.doesNotMatch(fsiiSection, /name="community"/);
    assert.match(contactSection, /name="community"/);
    assert.match(contactSection, /FSII_NEIGHBOURHOOD_VALUES/);
    assert.match(contactSection, /name="address"/);
    assert.match(contactSection, /bind:value=\{localClient\.address\}/);
    assert.match(contactSection, /type="text"/);

    const communityStart = contactSection.indexOf('for={fieldId("community")}');
    const communityEnd = contactSection.indexOf("\n                            </div>\n                        </div>", communityStart);
    assert.ok(communityStart >= 0);
    assert.ok(communityEnd > communityStart);
    const communityControl = contactSection.slice(communityStart, communityEnd);
    const addressControl = contactSection.slice(
        contactSection.indexOf('for={fieldId("address")}'),
        contactSection.indexOf("/>", contactSection.indexOf('name="address"')),
    );
    assert.doesNotMatch(communityControl, /required/);
    assert.doesNotMatch(addressControl, /required/);
});

test("member-only form fields use Dropdown bridges while temporary fields retain native selects", () => {
    const clientForm = readFileSync("src/lib/components/ClientForm.svelte", "utf8");
    const personForm = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");
    for (const field of ["membershipType", "residentialStatus", "gender", "cob"]) {
        assert.match(personForm, new RegExp(`<Dropdown[\\s\\S]*?name=\\"${field}\\"`));
    }
    for (const field of [
        "majorLanguage", "populationGroup", "indigenousIdentity", "housingSituation", "maritalStatus",
        "gradeInSchool", "highestGrade", "educationLevel", "primaryIncome", "community",
    ]) {
        assert.match(clientForm, new RegExp(`<Dropdown[\\s\\S]*?name=\\"${field}\\"`));
    }
    for (const field of ["physicalAccessibilityDifficulty", "cognitiveDifficulty", "emotionalMentalHealthCondition"]) {
        assert.match(clientForm, new RegExp(`<Dropdown[\\s\\S]*?id=\\{fieldId\\(field\\.name\\)\\} name=\\{field\\.name\\}`));
    }
    assert.match(clientForm, /\{#if !isTemporary\}[\s\S]*?<Dropdown/);
    assert.match(clientForm, /\{:else\}[\s\S]*?<select/);
    assert.match(personForm, /\{#if kind === "member"\}[\s\S]*?<Dropdown/);
    assert.match(personForm, /\{:else\}[\s\S]*?<select/);
});

test("temporary native demographic selects preserve unknown current values", () => {
    const source = readFileSync("src/lib/components/ClientForm.svelte", "utf8");
    const fallbackFields = [
        ["majorLanguage", "FSII_MAIN_LANGUAGE_VALUES"],
        ["populationGroup", "FSII_POPULATION_GROUP_VALUES"],
        ["housingSituation", "FSII_HOUSING_SITUATION_VALUES"],
    ] as const;

    for (const [field, values] of fallbackFields) {
        const selectStart = source.indexOf(`<select id={fieldId("${field}")}`);
        const selectEnd = source.indexOf("</select>", selectStart);
        assert.ok(selectStart >= 0);
        assert.ok(selectEnd > selectStart);
        const selectBlock = source.slice(selectStart, selectEnd);
        assert.match(
            selectBlock,
            new RegExp(`localClient\\.${field} && !hasOption\\(${values}, localClient\\.${field}\\)`),
        );
        assert.match(selectBlock, new RegExp(`value=\\{localClient\\.${field}\\}`));
    }
});
