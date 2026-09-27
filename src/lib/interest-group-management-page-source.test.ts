import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("interest group management uses a create dialog and shared table filters", () => {
    const source = readFileSync("src/routes/(app)/interest-group/manage/+page.svelte", "utf8");

    assert.match(source, /import \{[\s\S]*DataTable,[\s\S]*FilterTable,[\s\S]*filter,[\s\S]*\} from "@ibobbyts\/svelte-ui-utils\/table";/);
    assert.match(source, /let createDialog = \$state<HTMLDialogElement \| null>\(null\)/);
    assert.match(source, /onclick=\{\(\) => createDialog\?\.showModal\(\)\}/);
    assert.match(source, /<dialog class="modal" bind:this=\{createDialog\}>/);
    assert.match(source, /action="\/interest-group\/manage\/create"/);
    assert.match(source, /name="interestGroupName"[\s\S]*required/);
    assert.match(source, /const interestGroupFilterRows = \$derived<FilterTableRow\[\]>/);
    assert.match(source, /filter\.dropdownSearch\(/);
    assert.match(source, /loadOptions: loadInterestGroupSearchOptions/);
    assert.match(source, /<FilterTable rows=\{interestGroupFilterRows\} language=\{uiLanguage\} \/>/);
    assert.match(source, /const filteredInterestGroups = \$derived/);
    assert.match(source, /<DataTable[\s\S]*rows=\{filteredInterestGroups\}/);
    assert.doesNotMatch(source, /xl:grid-cols-\[1fr_1\.4fr\]/);
});
