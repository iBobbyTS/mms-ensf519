type FormControlRoot = Pick<ParentNode, "querySelectorAll">;

function readInput(input: HTMLInputElement) {
    if (input.type === "checkbox" || input.type === "radio") {
        return { tag: "input", type: input.type, name: input.name, checked: input.checked };
    }

    if (input.type === "file") {
        return {
            tag: "input",
            type: input.type,
            name: input.name,
            files: Array.from(input.files ?? []).map((file) => ({
                name: file.name,
                size: file.size,
                lastModified: file.lastModified,
            })),
        };
    }

    return { tag: "input", type: input.type, name: input.name, value: input.value };
}

export function captureFormInformation(root: FormControlRoot | null): string {
    if (!root) return "[]";

    const controls = Array.from(root.querySelectorAll("input, select, textarea")).map((control) => {
        if (control.tagName === "INPUT") {
            return readInput(control as HTMLInputElement);
        }
        if (control.tagName === "SELECT") {
            const select = control as unknown as HTMLSelectElement;
            return {
                tag: "select",
                name: select.name,
                selected: Array.from(select.options)
                    .filter((option) => option.selected)
                    .map((option) => option.value),
            };
        }
        const textarea = control as HTMLTextAreaElement;
        return { tag: "textarea", name: textarea.name, value: textarea.value };
    });

    return JSON.stringify(controls);
}

export function hasChangedFormInformation(
    root: FormControlRoot | null,
    initialSnapshot: string,
): boolean {
    return captureFormInformation(root) !== initialSnapshot;
}
