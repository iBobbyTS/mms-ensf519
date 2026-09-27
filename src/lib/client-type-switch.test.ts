import assert from "node:assert/strict";
import test from "node:test";

import {
    captureFormInformation,
    hasChangedFormInformation,
} from "./client-type-switch.ts";

function rootWith(...controls: Array<Record<string, unknown>>) {
    return {
        querySelectorAll: () => controls,
    } as unknown as ParentNode;
}

test("保持包含系统默认值的初始表单不视为已输入信息", () => {
    const controls = rootWith(
        { tagName: "INPUT", type: "text", name: "name", value: "" },
        { tagName: "INPUT", type: "date", name: "date", value: "2026-08-05" },
        {
            tagName: "SELECT",
            name: "type",
            options: [
                { selected: false, value: "first" },
                { selected: true, value: "second" },
            ],
        },
    );
    const initial = captureFormInformation(controls);

    assert.equal(hasChangedFormInformation(controls, initial), false);
});

test("文字、选项、勾选或文件变化均视为已输入信息", () => {
    const text = { tagName: "INPUT", type: "text", name: "name", value: "" };
    const textRoot = rootWith(text);
    const textInitial = captureFormInformation(textRoot);
    text.value = "Alice";
    assert.equal(hasChangedFormInformation(textRoot, textInitial), true);

    const options = [
        { selected: true, value: "member" },
        { selected: false, value: "non-member" },
    ];
    const selectRoot = rootWith({ tagName: "SELECT", name: "type", options });
    const selectInitial = captureFormInformation(selectRoot);
    options[0].selected = false;
    options[1].selected = true;
    assert.equal(hasChangedFormInformation(selectRoot, selectInitial), true);

    const checkbox = {
        tagName: "INPUT",
        type: "checkbox",
        name: "volunteer",
        checked: false,
    };
    const checkboxRoot = rootWith(checkbox);
    const checkboxInitial = captureFormInformation(checkboxRoot);
    checkbox.checked = true;
    assert.equal(hasChangedFormInformation(checkboxRoot, checkboxInitial), true);

    const file = { name: "photo.jpg", size: 10, lastModified: 1 };
    const fileInput = { tagName: "INPUT", type: "file", name: "photo", files: [] as typeof file[] };
    const fileRoot = rootWith(fileInput);
    const fileInitial = captureFormInformation(fileRoot);
    fileInput.files = [file];
    assert.equal(hasChangedFormInformation(fileRoot, fileInitial), true);
});

test("清空或还原输入后不再视为有会丢失的信息", () => {
    const input = { tagName: "INPUT", type: "text", name: "name", value: "" };
    const controls = rootWith(input);
    const initial = captureFormInformation(controls);

    input.value = "Alice";
    assert.equal(hasChangedFormInformation(controls, initial), true);
    input.value = "";
    assert.equal(hasChangedFormInformation(controls, initial), false);
});
