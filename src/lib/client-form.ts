import { formatBusinessDate } from "./local-date.ts";
import { normalizeMemberGenderValue } from "./gender.ts";
import { normalizeResidentialStatusValue } from "./residential-status.ts";

export type PersonalProfileData = {
    fsiiRegistrationDate: string;
    firstName: string;
    lastName: string;
    legalNamePhotoIdVerified: boolean;
    englishName: string;
    chineseName: string;
    gender: string;
    otherGender: string;
    dob: string;
    // View-model age fields for the dob "age only" mode: "" while the record
    // stores a full date of birth; ageYears is the mode discriminator.
    ageYears: string;
    ageUpdatedDate: string;
    cob: string;
    birthProvince: string;
    birthCity: string;
    residentialStatus: string;
    isVolunteer: boolean;
    address: string;
    community: string;
    postalCode: string;
    tel: string;
    email: string;
    wechatID: string;
    emergencyContactPerson: string;
    emergencyContactRelationship: string;
    emergencyContactTel: string;
    majorLanguage: string;
    populationGroup: string;
    maritalStatus: string;
    housingSituation: string;
    primaryIncome: string;
    gradeInSchool: string;
    numberChild: number;
    numberAdult: number;
    highestGrade: string;
    educationLevel: string;
    indigenousIdentity: string;
    arrivalMonth: string;
    physicalAccessibilityDifficulty: string;
    cognitiveDifficulty: string;
    emotionalMentalHealthCondition: string;
    remark: string;
};

export type PersonalProfileDataSource = {
    [K in keyof PersonalProfileData]?: PersonalProfileData[K] | null | undefined;
};

export type ClientData = PersonalProfileData & {
    id?: number;
    clientCode: string;
    clientType: "Member";
    membershipType: "General" | "Lifetime";
    registrationDate: string;
    referrerName: string;
    directorName: string;
    approverName: string;
    // Form-only checkbox state for the dob "age only" mode; it is submitted
    // as the dobAgeOnly key presence and never persisted as a view field.
    dobAgeOnly: boolean;
};

export type ClientDataSource = {
    [K in keyof ClientData]?: ClientData[K] | null | undefined;
};

function todayIsoDate(now = new Date()): string {
    return formatBusinessDate(now);
}

function normalizeString(value: string | null | undefined): string {
    return value ?? "";
}

function normalizeNumber(value: number | string | null | undefined): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
}

function normalizeBoolean(value: boolean | number | string | null | undefined): boolean {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1;
    }

    if (typeof value === "string") {
        return ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());
    }

    return false;
}

export function createEmptyPersonalProfileData(): PersonalProfileData {
    return {
        fsiiRegistrationDate: "",
        firstName: "",
        lastName: "",
        legalNamePhotoIdVerified: false,
        englishName: "",
        chineseName: "",
        gender: "",
        otherGender: "",
        dob: "",
        ageYears: "",
        ageUpdatedDate: "",
        cob: "",
        birthProvince: "",
        birthCity: "",
        residentialStatus: "",
        isVolunteer: false,
        address: "",
        community: "",
        postalCode: "",
        tel: "",
        email: "",
        wechatID: "",
        emergencyContactPerson: "",
        emergencyContactRelationship: "",
        emergencyContactTel: "",
        majorLanguage: "",
        populationGroup: "",
        maritalStatus: "",
        housingSituation: "",
        primaryIncome: "",
        gradeInSchool: "",
        numberChild: 0,
        numberAdult: 0,
        highestGrade: "",
        educationLevel: "",
        indigenousIdentity: "",
        arrivalMonth: "",
        physicalAccessibilityDifficulty: "",
        cognitiveDifficulty: "",
        emotionalMentalHealthCondition: "",
        remark: "",
    };
}

function normalizeAgeYears(value: number | string | null | undefined): string {
    return value === null || value === undefined ? "" : String(value);
}

export function normalizePersonalProfileData(
    source?: PersonalProfileDataSource,
): PersonalProfileData {
    return {
        fsiiRegistrationDate: normalizeString(source?.fsiiRegistrationDate),
        firstName: normalizeString(source?.firstName),
        lastName: normalizeString(source?.lastName),
        legalNamePhotoIdVerified: normalizeBoolean(source?.legalNamePhotoIdVerified),
        englishName: normalizeString(source?.englishName),
        chineseName: normalizeString(source?.chineseName),
        gender: normalizeMemberGenderValue(normalizeString(source?.gender)),
        otherGender: source?.gender === "Other" ? normalizeString(source?.otherGender) : "",
        dob: normalizeString(source?.dob),
        ageYears: normalizeAgeYears(source?.ageYears),
        ageUpdatedDate: normalizeString(source?.ageUpdatedDate),
        cob: normalizeString(source?.cob),
        birthProvince: normalizeString(source?.birthProvince),
        birthCity: normalizeString(source?.birthCity),
        residentialStatus: normalizeResidentialStatusValue(normalizeString(source?.residentialStatus)),
        isVolunteer: normalizeBoolean(source?.isVolunteer),
        address: normalizeString(source?.address),
        community: normalizeString(source?.community),
        postalCode: normalizeString(source?.postalCode),
        tel: normalizeString(source?.tel),
        email: normalizeString(source?.email),
        wechatID: normalizeString(source?.wechatID),
        emergencyContactPerson: normalizeString(source?.emergencyContactPerson),
        emergencyContactRelationship: normalizeString(source?.emergencyContactRelationship),
        emergencyContactTel: normalizeString(source?.emergencyContactTel),
        majorLanguage: normalizeString(source?.majorLanguage),
        populationGroup: normalizeString(source?.populationGroup),
        maritalStatus: normalizeString(source?.maritalStatus),
        housingSituation: normalizeString(source?.housingSituation),
        primaryIncome: normalizeString(source?.primaryIncome),
        gradeInSchool: normalizeString(source?.gradeInSchool),
        numberChild: normalizeNumber(source?.numberChild),
        numberAdult: normalizeNumber(source?.numberAdult),
        highestGrade: normalizeString(source?.highestGrade),
        educationLevel: normalizeString(source?.educationLevel),
        indigenousIdentity: normalizeString(source?.indigenousIdentity),
        arrivalMonth: normalizeString(source?.arrivalMonth),
        physicalAccessibilityDifficulty: normalizeString(source?.physicalAccessibilityDifficulty),
        cognitiveDifficulty: normalizeString(source?.cognitiveDifficulty),
        emotionalMentalHealthCondition: normalizeString(source?.emotionalMentalHealthCondition),
        remark: normalizeString(source?.remark),
    };
}

export function createEmptyClientData(now = new Date()): ClientData {
    return {
        ...createEmptyPersonalProfileData(),
        clientCode: "",
        clientType: "Member",
        membershipType: "General",
        registrationDate: todayIsoDate(now),
        referrerName: "",
        directorName: "",
        approverName: "",
        dobAgeOnly: false,
    };
}

export function normalizeClientData(
    source?: ClientDataSource,
    now = new Date(),
): ClientData {
    const fallback = createEmptyClientData(now);
    const profile = normalizePersonalProfileData(source);

    return {
        ...profile,
        id: source?.id ?? undefined,
        clientCode: normalizeString(source?.clientCode),
        clientType: "Member",
        membershipType:
            source?.membershipType === "Lifetime" ||
            source?.membershipType === "General"
                ? source.membershipType
                : fallback.membershipType,
        registrationDate: normalizeString(source?.registrationDate) || fallback.registrationDate,
        referrerName: normalizeString(source?.referrerName),
        directorName: normalizeString(source?.directorName),
        approverName: normalizeString(source?.approverName),
        dobAgeOnly: normalizeBoolean(source?.dobAgeOnly),
    };
}

export function createClientFormData(
    client: ClientData,
    {
        includeClientCode = true,
        sourceFormData,
    }: { includeClientCode?: boolean; sourceFormData?: FormData } = {},
): FormData {
    const formData = new FormData();

    sourceFormData?.forEach((value, key) => {
        formData.append(key, value);
    });

    Object.entries(client).forEach(([key, value]) => {
        if (key === "clientCode" && !includeClientCode) {
            return;
        }
        if (key === "englishName") {
            return;
        }
        // Server-computed view state; the age round-trips through dobAge when
        // the age-only checkbox is submitted. dobAgeOnly is handled explicitly
        // below so an unchecked checkbox never leaks a "false" value key.
        if (key === "ageYears" || key === "ageUpdatedDate" || key === "dobAgeOnly") {
            return;
        }

        if (!formData.has(key) && value !== null && value !== undefined) {
            formData.append(key, String(value));
        }
    });

    if (!includeClientCode) {
        formData.delete("clientCode");
    }

    formData.set("clientType", "Member");
    formData.delete("englishName");
    formData.delete("website");
    formData.delete("contactPerson");

    // "Age only" payload contract: age mode must never carry a dob key and dob
    // mode must never carry dobAgeOnly/dobAge keys. The submitted DOM form data
    // (checkbox key presence) wins over the normalized client state.
    const dobAgeOnly = sourceFormData
        ? sourceFormData.has("dobAgeOnly")
        : client.dobAgeOnly === true;
    if (dobAgeOnly) {
        formData.delete("dob");
        formData.set("dobAgeOnly", "on");
        if (!formData.has("dobAge") && client.ageYears) {
            formData.set("dobAge", client.ageYears);
        }
    } else {
        formData.delete("dobAgeOnly");
        formData.delete("dobAge");
    }

    return formData;
}
