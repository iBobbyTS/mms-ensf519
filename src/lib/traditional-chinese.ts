import * as OpenCC from "opencc-js/t2cn";

export type TraditionalChineseSuggestion = {
    character: string;
    suggestion: string;
};

const toSimplified = OpenCC.Converter({ from: "t", to: "cn" });

export function toSimplifiedCharacter(character: string): string {
    return toSimplified(character);
}

export function findTraditionalChineseCharacters(input: string): TraditionalChineseSuggestion[] {
    const suggestions = new Map<string, string>();

    for (const character of Array.from(input)) {
        const suggestion = toSimplifiedCharacter(character);
        if (suggestion !== character && !suggestions.has(character)) {
            suggestions.set(character, suggestion);
        }
    }

    return Array.from(suggestions, ([character, suggestion]) => ({ character, suggestion }));
}

export function replaceTraditionalChineseCharacters(input: string): string {
    return Array.from(input, toSimplifiedCharacter).join("");
}

export function traditionalChineseSuggestionText(input: string): {
    traditional: string;
    simplified: string;
    suggestedValue: string;
} | null {
    const suggestions = findTraditionalChineseCharacters(input);
    if (suggestions.length === 0) return null;

    return {
        traditional: suggestions.map((item) => item.character).join("、"),
        simplified: suggestions.map((item) => item.suggestion).join("、"),
        suggestedValue: replaceTraditionalChineseCharacters(input),
    };
}
