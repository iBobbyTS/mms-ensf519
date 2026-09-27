export function toMessageText(value: unknown): string {
    return typeof value === "string" ? value : String(value);
}
