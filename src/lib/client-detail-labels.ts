import * as m from "$lib/paraglide/messages";

export type DetailItem = {
    key: string;
    label: string;
    value: string | number | null | undefined;
};

export type ContactItem = DetailItem & {
    icon: "business" | "email" | "location" | "phone";
};

export type ContactRow = {
    columns: 1 | 2;
    items: ContactItem[];
};

export type DetailGroup = {
    label: string;
    items: DetailItem[];
};

export function isMissing(value: string | number | null | undefined) {
    return (
        value === null ||
        value === undefined ||
        String(value).trim() === "" ||
        String(value).trim() === m.notAvailable()
    );
}

export function present(value: string | number | null | undefined) {
    if (isMissing(value)) {
        return m.notAvailable();
    }

    return String(value);
}

export function languageLabel(value: string) {
    const labels: Record<string, () => string> = {
        English: m.languageEnglishOption,
        French: m.languageFrenchOption,
        Mandarin: m.languageMandarinOption,
        Cantonese: m.languageCantoneseOption,
        Shanghaiese: m.languageShanghaineseOption,
        "An Indigenous language": m.languageIndigenousOption,
        Dinka: m.languageDinkaOption,
        Farsi: m.languageFarsiOption,
        Hindi: m.languageHindiOption,
        Korean: m.languageKoreanOption,
        Kurdish: m.languageKurdishOption,
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

    return labels[value]?.() ?? present(value);
}

export function populationGroupLabel(value: string) {
    const labels: Record<string, () => string> = {
        Chinese: m.populationGroupChinese,
        Thai: m.populationGroupThai,
        Vietnamese: m.populationGroupVietnamese,
        Cambodian: m.populationGroupCambodian,
        "Indigenous (First Nations, Metis, Inuit)": m.populationGroupIndigenous,
        "African/Caribbean": m.populationGroupAfricanCaribbean,
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

    return labels[value]?.() ?? present(value);
}

export function maritalStatusLabel(value: string) {
    const labels: Record<string, () => string> = {
        Married: m.maritalStatusMarried,
        "Common Law": m.maritalStatusCommonLaw,
        Widowed: m.maritalStatusWidowed,
        Separated: m.maritalStatusSeparated,
        Single: m.maritalStatusSingle,
        Divorced: m.maritalStatusDivorced,
    };

    return labels[value]?.() ?? present(value);
}

export function housingSituationLabel(value: string) {
    const labels: Record<string, () => string> = {
        "Stable Housing": m.housingStable,
        "Stable housing": m.housingStable,
        "Temporary Housing": m.housingTemporary,
        "Temporary housing": m.housingTemporary,
        "Couch Surfing": m.housingCouchSurfing,
        "Couch surfing": m.housingCouchSurfing,
        Shelter: m.housingShelter,
        "No shelter, sleeping rough": m.housingNoShelter,
        Other: m.genderOther,
    };

    return labels[value]?.() ?? present(value);
}

export function educationLevelLabel(value: string) {
    const labels: Record<string, () => string> = {
        Certificate: m.educationCertificate,
        Diploma: m.educationDiploma,
        "Bachelor’s Degree or Above": m.educationBachelorOrAbove,
    };

    return labels[value]?.() ?? present(value);
}

export function incomeLabel(value: string) {
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
        "Personal Private Pension / Savings / Trustfund / Inheritance":
            m.incomePrivatePensionSavings,
        "War Veterans Allowance (WVA)": m.incomeWarVeteransAllowance,
        "Workers Compensation (WCB)": m.incomeWorkersCompensation,
        "GST Rebate": m.incomeGstRebate,
        "Employment Insurance (EI)": m.incomeEmploymentInsurance,
        "Alternative Incomesource / Parents": m.incomeAlternativeParents,
    };

    return labels[value]?.() ?? present(value);
}

export function gradeLabel(value: string) {
    const grade = Number(value);
    return Number.isFinite(grade) && grade > 0 ? m.gradeOption({ grade }) : present(value);
}

export function indigenousIdentityLabel(value: string) {
    if (value === "Not applicable") return m.indigenousNotApplicable();
    if (value === "First Nations (Status/Non-Status)") return m.indigenousFirstNations();
    if (value === "Métis") return m.indigenousMetis();
    if (value === "Inuk (Inuit)") return m.indigenousInuk();
    return present(value);
}

export function accessibilityLabel(value: string) {
    if (value === "Yes, sometimes") return m.accessibilityYesSometimes();
    if (value === "Yes, often") return m.accessibilityYesOften();
    if (value === "No") return m.noOption();
    return present(value);
}
