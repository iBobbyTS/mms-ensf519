import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

test("member attendance panel delegates presentation to focused components", () => {
  const source = readSource("src/lib/components/MemberAttendancePanel.svelte");

  assert.match(source, /import AttendanceCounters/);
  assert.match(source, /import AttendanceDialogs/);
  assert.match(source, /import AttendanceRecordsTable/);
  assert.match(source, /resolveAttendanceSubmissionOutcome/);
  assert.match(source, /<AttendanceCounters/);
  assert.match(source, /<AttendanceRecordsTable/);
  assert.match(source, /<AttendanceDialogs/);
  assert.doesNotMatch(source, /<DataTable/);
});

test("interest group attendance uses shared dropdown viewport fitting", () => {
  const interestGroupPage = readSource(
    "src/routes/(app)/interest-group/attendance/+page.svelte",
  );

  assert.match(interestGroupPage, /fitViewport=\{true\}/);
  assert.match(interestGroupPage, /fitContent=\{true\}/);
  assert.doesNotMatch(interestGroupPage, /interestGroupDropdownMaxHeight/);
  assert.doesNotMatch(interestGroupPage, /getBoundingClientRect/);
  assert.doesNotMatch(
    interestGroupPage,
    /suu-dropdown__panel[\s\S]*max-height/,
  );
});

test("interest group attendance no longer exposes a check-out route", () => {
  assert.equal(
    existsSync(
      "src/routes/(app)/interest-group/attendance/check-out/+server.ts",
    ),
    false,
  );
});

test("member attendance panel sends force register again only when explicitly requested", () => {
  const source = readSource("src/lib/components/MemberAttendancePanel.svelte");

  assert.doesNotMatch(
    source,
    /force_register_again:\s*options\.forceRegisterAgain\s*===\s*true/,
  );
  assert.match(
    source,
    /if\s*\(\s*options\.forceRegisterAgain\s*===\s*true\s*\)\s*{\s*requestBody\.force_register_again\s*=\s*true;\s*}/s,
  );
  assert.match(source, /body:\s*JSON\.stringify\(requestBody\)/);
});

test("member attendance panel sends its configured member search scope", () => {
  const panelSource = readSource("src/lib/components/MemberAttendancePanel.svelte");
  const searchSource = readSource("src/lib/attendance-member-search.ts");

  assert.match(panelSource, /memberSearchClientType = "participant"/);
  assert.match(panelSource, /clientType:\s*memberSearchClientType/);
  assert.match(panelSource, /additionalMemberSearchEndpoint,/);
  assert.match(panelSource, /loadAttendanceMemberOptions\(query, context/);
  assert.match(searchSource, /\/api\/members\/search\?\$\{params\.toString\(\)\}/);
});

test("member attendance panel delegates member search to the shared loader", () => {
  const panelSource = readSource(
    "src/lib/components/MemberAttendancePanel.svelte",
  );

  assert.match(panelSource, /loadAttendanceMemberOptions\(query, context/);
  assert.doesNotMatch(panelSource, /\/api\/members\/search/);
});

test("member attendance panel locks scanner and camera submit cycles until lookup finishes", () => {
  const source = readSource("src/lib/components/MemberAttendancePanel.svelte");

  assert.match(source, /ATTENDANCE_SUBMITTED_LOOKUP_TIMEOUT_MS = 10_000/);
  assert.match(source, /startSubmittedAttendanceLookup\(submittedValue\)/);
  assert.match(source, /startSubmittedAttendanceLookup\(result\.value\)/);
  assert.match(source, /shouldFailSubmittedAttendanceLookup/);
  assert.match(source, /attendanceInputLocked/);
  assert.match(source, /showAttendanceProcessingOverlay/);
  assert.match(source, /attendanceInputResetVersion/);
  assert.match(source, /m\.attendanceLookupTimeout\(\{ seconds: 10 \}\)/);
  assert.match(source, /m\.attendanceProcessingScanHint\(\)/);
});
