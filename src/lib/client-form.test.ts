import assert from "node:assert/strict";
import test from "node:test";

import {
    createClientFormData,
    createEmptyClientData,
    normalizeClientData,
    type ClientDataSource,
} from "./client-form.ts";
import { RESIDENTIAL_STATUS_VALUES } from "./residential-status.ts";

test("createEmptyClientData uses provided date and stable defaults", () => {
    const client = createEmptyClientData(new Date("2026-03-28T12:00:00Z"));

    assert.equal(client.registrationDate, "2026-03-28");
    assert.equal(client.fsiiRegistrationDate, "");
    assert.equal(client.clientType, "Member");
    assert.equal(client.membershipType, "General");
    assert.equal(client.legalNamePhotoIdVerified, false);
    assert.equal(client.birthProvince, "");
    assert.equal(client.birthCity, "");
    assert.equal(client.isVolunteer, false);
    assert.equal(client.address, "");
    assert.equal(client.community, "");
    assert.equal("website" in client, false);
    assert.equal("contactPerson" in client, false);
    assert.equal(client.emergencyContactPerson, "");
    assert.equal(client.emergencyContactRelationship, "");
    assert.equal(client.emergencyContactTel, "");
    assert.equal(client.referrerName, "");
    assert.equal(client.directorName, "");
    assert.equal(client.approverName, "");
    assert.equal(client.gradeInSchool, "");
    assert.equal(client.indigenousIdentity, "");
    assert.equal(client.arrivalMonth, "");
    assert.equal(client.physicalAccessibilityDifficulty, "");
    assert.equal(client.cognitiveDifficulty, "");
    assert.equal(client.emotionalMentalHealthCondition, "");
    assert.equal(client.numberChild, 0);
    assert.equal(client.numberAdult, 0);
});

test("normalizeClientData keeps existing client values", () => {
    const source: ClientDataSource = {
        id: 42,
        clientCode: "SCSC0261",
        clientType: "Member",
        membershipType: "Lifetime",
        registrationDate: "2025-01-02",
        firstName: "DAVID",
        lastName: "THOMPSON",
        legalNamePhotoIdVerified: true,
        chineseName: "大卫",
        englishName: "DAVID THOMPSON",
        birthProvince: "Guangdong",
        birthCity: "Guangzhou",
        residentialStatus: "Citizen_Permanent Resident",
        isVolunteer: "on",
        address: "123 Main St, Unit 4",
        community: "Acadia",
        emergencyContactPerson: "Alex Thompson",
        emergencyContactRelationship: "Spouse",
        emergencyContactTel: "403-555-0100",
        referrerName: "Board Member",
        directorName: "Director One",
        approverName: "Approver One",
        numberChild: 2,
        numberAdult: 1,
    } as unknown as ClientDataSource;

    const client = normalizeClientData(source, new Date("2026-03-28T12:00:00Z"));

    assert.equal(client.id, 42);
    assert.equal(client.clientCode, "SCSC0261");
    assert.equal(client.membershipType, "Lifetime");
    assert.equal(client.registrationDate, "2025-01-02");
    assert.equal(client.firstName, "DAVID");
    assert.equal(client.legalNamePhotoIdVerified, true);
    assert.equal(client.birthProvince, "Guangdong");
    assert.equal(client.birthCity, "Guangzhou");
    assert.equal(client.residentialStatus, "Permanent Resident");
    assert.equal(client.isVolunteer, true);
    assert.equal(client.address, "123 Main St, Unit 4");
    assert.equal(client.community, "Acadia");
    assert.equal(client.emergencyContactPerson, "Alex Thompson");
    assert.equal(client.emergencyContactRelationship, "Spouse");
    assert.equal(client.emergencyContactTel, "403-555-0100");
    assert.equal(client.referrerName, "Board Member");
    assert.equal(client.directorName, "Director One");
    assert.equal(client.approverName, "Approver One");
    assert.equal(client.numberChild, 2);
    assert.equal(client.numberAdult, 1);
});

test("normalizeClientData fills nullish fields and invalid enums with safe defaults", () => {
    const source = {
        clientCode: null,
        clientType: "Unknown",
        membershipType: "VIP",
        registrationDate: "",
        chineseName: null,
        email: undefined,
        residentialStatus: "Temporary Resident",
        isVolunteer: "false",
        numberChild: null,
        numberAdult: "NaN",
    } as unknown as ClientDataSource;

    const client = normalizeClientData(source, new Date("2026-03-28T12:00:00Z"));

    assert.equal(client.clientCode, "");
    assert.equal(client.clientType, "Member");
    assert.equal(client.membershipType, "General");
    assert.equal(client.registrationDate, "2026-03-28");
    assert.equal(client.chineseName, "");
    assert.equal(client.email, "");
    assert.equal(client.residentialStatus, "");
    assert.equal(client.isVolunteer, false);
    assert.equal(client.legalNamePhotoIdVerified, false);
    assert.equal(client.numberChild, 0);
    assert.equal(client.numberAdult, 0);
});

test("normalizeClientData accepts only the current residential status values", () => {
    for (const status of RESIDENTIAL_STATUS_VALUES) {
        assert.equal(normalizeClientData({ residentialStatus: status }).residentialStatus, status);
    }

    assert.equal(
        normalizeClientData({ residentialStatus: "Citizen_Permanent Resident" }).residentialStatus,
        "Permanent Resident",
    );
    assert.equal(
        normalizeClientData({ residentialStatus: "Temporary Resident" }).residentialStatus,
        "",
    );
});

test("normalizeClientData preserves expanded member gender values", () => {
    const client = normalizeClientData(
        { gender: "Transgender" },
        new Date("2026-03-28T12:00:00Z"),
    );

    assert.equal(client.gender, "Transgender");
    assert.equal(normalizeClientData({ gender: "Prefer not to disclose" }).gender, "Prefer not to disclose");
    assert.equal(
        normalizeClientData({ gender: "Prefer Not Disclose" }).gender,
        "Prefer not to disclose",
    );
});

test("normalizeClientData exposes other gender only for Other", () => {
    assert.equal(normalizeClientData({ gender: "Other", otherGender: "Non-binary" }).otherGender, "Non-binary");
    assert.equal(normalizeClientData({ gender: "Female", otherGender: "stale" }).otherGender, "");
});

test("normalizeClientData parses numeric strings for imported edge cases", () => {
    const client = normalizeClientData(
        {
            numberChild: "3",
            numberAdult: "2",
        } as unknown as ClientDataSource,
        new Date("2026-03-28T12:00:00Z"),
    );

    assert.equal(client.numberChild, 3);
    assert.equal(client.numberAdult, 2);
});

test("createClientFormData omits member client code for automatic numbering", () => {
    const client = normalizeClientData(
        {
            clientCode: "SCSC9999",
            clientType: "Member",
            chineseName: "自动编号",
            englishName: "Auto Number Member",
            birthProvince: "Guangdong",
            birthCity: "Guangzhou",
            isVolunteer: true,
            address: "456 Centre St",
            community: "Beltline",
            emergencyContactPerson: "Emergency Person",
            emergencyContactRelationship: "Friend",
            emergencyContactTel: "403-555-0100",
            referrerName: "Referrer",
            directorName: "Director",
            approverName: "Approver",
            numberChild: 1,
            numberAdult: 2,
            highestGrade: "12",
            educationLevel: "Diploma",
        },
        new Date("2026-03-28T12:00:00Z"),
    );

    const formData = createClientFormData(client, { includeClientCode: false });

    assert.equal(formData.has("clientCode"), false);
    assert.equal(formData.get("clientType"), "Member");
    assert.equal(formData.get("chineseName"), "自动编号");
    assert.equal(formData.has("englishName"), false);
    assert.equal(formData.get("birthProvince"), "Guangdong");
    assert.equal(formData.get("birthCity"), "Guangzhou");
    assert.equal(formData.get("isVolunteer"), "true");
    assert.equal(formData.get("address"), "456 Centre St");
    assert.equal(formData.get("community"), "Beltline");
    assert.equal(formData.get("emergencyContactPerson"), "Emergency Person");
    assert.equal(formData.get("emergencyContactRelationship"), "Friend");
    assert.equal(formData.get("emergencyContactTel"), "403-555-0100");
    assert.equal(formData.get("referrerName"), "Referrer");
    assert.equal(formData.get("directorName"), "Director");
    assert.equal(formData.get("approverName"), "Approver");
    assert.equal(formData.get("numberChild"), "1");
    assert.equal(formData.get("numberAdult"), "2");
    assert.equal(formData.get("highestGrade"), "12");
    assert.equal(formData.get("educationLevel"), "Diploma");
});

test("createClientFormData forces member type even when source form has stale type", () => {
    const client = normalizeClientData(
        {
            clientCode: "SCSC9999",
            clientType: "Member",
            chineseName: "自动编号客户",
            englishName: "Auto Member",
        },
        new Date("2026-03-28T12:00:00Z"),
    );

    const sourceFormData = new FormData();
    sourceFormData.append("clientCode", "SCSC-SHOULD-NOT-SUBMIT");
    sourceFormData.append("clientType", "Legacy Type");
    sourceFormData.append("chineseName", "表单客户");
    sourceFormData.append("website", "https://legacy.example.com");
    sourceFormData.append("contactPerson", "Legacy Contact");

    const formData = createClientFormData(client, {
        includeClientCode: false,
        sourceFormData,
    });

    assert.equal(formData.has("clientCode"), false);
    assert.equal(formData.get("clientType"), "Member");
    assert.equal(formData.get("chineseName"), "表单客户");
    assert.equal(formData.has("englishName"), false);
    assert.equal(formData.has("website"), false);
    assert.equal(formData.has("contactPerson"), false);
});

test("createClientFormData includes client code for existing clients", () => {
    const client = normalizeClientData(
        {
            clientCode: "SCSC0261",
            chineseName: "既有会员",
        },
        new Date("2026-03-28T12:00:00Z"),
    );

    const formData = createClientFormData(client);

    assert.equal(formData.get("clientCode"), "SCSC0261");
    assert.equal(formData.get("chineseName"), "既有会员");
});

test("createClientFormData prefers current form values over normalized state", () => {
    const client = normalizeClientData(
        {
            clientCode: "",
            clientType: "Member",
            chineseName: "状态姓名",
            englishName: "State Name",
            gender: "",
            residentialStatus: "",
            isVolunteer: false,
        },
        new Date("2026-03-28T12:00:00Z"),
    );
    const sourceFormData = new FormData();
    sourceFormData.append("clientCode", "SHOULD-NOT-SUBMIT");
    sourceFormData.append("clientType", "Member");
    sourceFormData.append("chineseName", "表单姓名");
    sourceFormData.append("englishName", "Form Name");
    sourceFormData.append("legalNamePhotoIdVerified", "on");
    sourceFormData.append("isVolunteer", "on");
    sourceFormData.append("gender", "Other");
    sourceFormData.append("residentialStatus", "Citizen_Permanent Resident");
    sourceFormData.append("emergencyContactPerson", "Form Emergency");
    sourceFormData.append("emergencyContactRelationship", "Sibling");
    sourceFormData.append("emergencyContactTel", "403-555-0200");
    sourceFormData.append("referrerName", "Form Referrer");

    const formData = createClientFormData(client, {
        includeClientCode: false,
        sourceFormData,
    });

    assert.equal(formData.has("clientCode"), false);
    assert.equal(formData.get("chineseName"), "表单姓名");
    assert.equal(formData.has("englishName"), false);
    assert.equal(formData.get("legalNamePhotoIdVerified"), "on");
    assert.equal(formData.get("isVolunteer"), "on");
    assert.equal(formData.get("gender"), "Other");
    assert.equal(formData.get("residentialStatus"), "Citizen_Permanent Resident");
    assert.equal(formData.get("emergencyContactPerson"), "Form Emergency");
    assert.equal(formData.get("emergencyContactRelationship"), "Sibling");
    assert.equal(formData.get("emergencyContactTel"), "403-555-0200");
    assert.equal(formData.get("referrerName"), "Form Referrer");
    assert.equal(formData.get("registrationDate"), "2026-03-28");
});

test("createClientFormData keeps the dob age-only payload invariant", () => {
    const dobModeClient = normalizeClientData(
        {
            clientCode: "SCSC0100",
            chineseName: "出生日期会员",
            dob: "1990-01-02",
        },
        new Date("2026-03-28T12:00:00Z"),
    );
    const dobModeSource = new FormData();
    dobModeSource.append("dob", "1990-01-02");
    dobModeSource.append("dobAge", "65");
    const dobModePayload = createClientFormData(dobModeClient, {
        sourceFormData: dobModeSource,
    });
    assert.equal(dobModePayload.get("dob"), "1990-01-02");
    assert.equal(dobModePayload.has("dobAgeOnly"), false);
    assert.equal(dobModePayload.has("dobAge"), false);

    const ageClient = normalizeClientData(
        {
            clientCode: "SCSC0101",
            chineseName: "仅年龄会员",
            dob: "",
            ageYears: "65",
            ageUpdatedDate: "2026-03-01",
        },
        new Date("2026-03-28T12:00:00Z"),
    );
    const ageSource = new FormData();
    ageSource.append("dob", "1990-01-02");
    ageSource.append("dobAgeOnly", "on");
    ageSource.append("dobAge", "65");
    const agePayload = createClientFormData(
        { ...ageClient, dobAgeOnly: true },
        { sourceFormData: ageSource },
    );
    assert.equal(agePayload.has("dob"), false);
    assert.equal(agePayload.get("dobAgeOnly"), "on");
    assert.equal(agePayload.get("dobAge"), "65");
    assert.equal(agePayload.has("ageYears"), false);
    assert.equal(agePayload.has("ageUpdatedDate"), false);

    // Without form data the normalized checkbox state decides the mode and a
    // stale dob text never rides along.
    const programmaticAgePayload = createClientFormData({
        ...ageClient,
        dob: "1990-01-02",
        dobAgeOnly: true,
    });
    assert.equal(programmaticAgePayload.has("dob"), false);
    assert.equal(programmaticAgePayload.get("dobAgeOnly"), "on");
    assert.equal(programmaticAgePayload.get("dobAge"), "65");

    // An unchecked checkbox must never leak a literal "false" value key.
    const uncheckedClient = normalizeClientData(
        {
            clientCode: "SCSC0102",
            chineseName: "未勾选会员",
            dob: "1990-01-02",
        },
        new Date("2026-03-28T12:00:00Z"),
    );
    assert.equal(uncheckedClient.dobAgeOnly, false);
    const uncheckedSource = new FormData();
    uncheckedSource.append("dob", "1990-01-02");
    const uncheckedPayload = createClientFormData(uncheckedClient, {
        sourceFormData: uncheckedSource,
    });
    assert.equal(uncheckedPayload.has("dobAgeOnly"), false);
    assert.equal(uncheckedPayload.has("dobAge"), false);
    assert.equal(uncheckedPayload.get("dob"), "1990-01-02");
});
