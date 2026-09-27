import { addTraditionalDict, pinyin, polyphonic } from "pinyin-pro";
import TraditionalDict from "@pinyin-pro/data/traditional";

import { replaceTraditionalChineseCharacters } from "../traditional-chinese.ts";

addTraditionalDict(TraditionalDict);

export const MAX_D1_LIKE_PATTERN_BYTES = 50;
export const MAX_PINYIN_COMBINATIONS = 64;

export type ChineseNameSearchIndex = {
    pinyin: string | null;
    pinyinCompact: string | null;
    pinyinInitials: string | null;
    pinyinGivenSurname: string | null;
    searchTerms: string | null;
};

export type ChineseNameSearchQuery = {
    variants: string[];
    likePatterns: string[];
    exactTermPatterns: Array<string | null>;
};

const PINYIN_OPTIONS = {
    toneType: "none",
    type: "array",
    traditional: true,
    nonZh: "removed",
    v: "v",
} as const;

const COMPACT_SEPARATOR_PATTERN = /[\s._\-/\\,，、·・]+/gu;
const SEARCH_TERM_SEPARATOR = "\n";
const UTF8_ENCODER = new TextEncoder();

function normalizeSearchKey(value: string): string | null {
    const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

function compactSearchKey(value: string): string | null {
    const normalized = normalizeSearchKey(value);
    if (!normalized) return null;
    const compact = normalized.replace(COMPACT_SEPARATOR_PATTERN, "");
    return compact.length > 0 ? compact : null;
}

function addSearchTerm(terms: Set<string>, value: string | null | undefined): void {
    const normalized = normalizeSearchKey(value ?? "");
    if (!normalized) return;
    terms.add(normalized.replaceAll(SEARCH_TERM_SEPARATOR, " "));
}

function encodedSearchTerms(terms: Set<string>): string | null {
    if (terms.size === 0) return null;
    return `${SEARCH_TERM_SEPARATOR}${Array.from(terms).join(SEARCH_TERM_SEPARATOR)}${SEARCH_TERM_SEPARATOR}`;
}

export function chineseNameSearchTermLikePattern(term: string): string {
    return `%${SEARCH_TERM_SEPARATOR}${term}${SEARCH_TERM_SEPARATOR}%`;
}

function d1SafeLikePattern(pattern: string): string | null {
    return UTF8_ENCODER.encode(pattern).byteLength <= MAX_D1_LIKE_PATTERN_BYTES
        ? pattern
        : null;
}

function addPinyinSequenceTerms(terms: Set<string>, syllables: string[]): void {
    const normalized = syllables
        .map((part) => normalizeSearchKey(part))
        .filter((part): part is string => Boolean(part));
    if (normalized.length === 0) return;

    const [surname, ...givenNames] = normalized;
    const compactGiven = givenNames.join("");

    addSearchTerm(terms, normalized.join(" "));
    addSearchTerm(terms, normalized.join(""));
    addSearchTerm(terms, normalized.map((part) => part[0] ?? "").join(""));
    if (surname && compactGiven) {
        addSearchTerm(terms, `${surname} ${compactGiven}`);
        addSearchTerm(terms, `${compactGiven} ${surname}`);
    }
}

function countPinyinCombinations(candidateGroups: string[][]): number {
    return candidateGroups.reduce((count, group) => count * Math.max(group.length, 1), 1);
}

function addPinyinCombinations(
    terms: Set<string>,
    candidateGroups: string[][],
    prefix: string[] = [],
): void {
    if (candidateGroups.length === 0) {
        addPinyinSequenceTerms(terms, prefix);
        return;
    }

    const [currentGroup, ...remainingGroups] = candidateGroups;
    for (const candidate of currentGroup) {
        addPinyinCombinations(terms, remainingGroups, [...prefix, candidate]);
    }
}

function buildSearchTerms(name: string, primarySyllables: string[]): string | null {
    const terms = new Set<string>();
    const normalizedName = normalizeSearchKey(name);
    const simplifiedName = normalizedName
        ? normalizeSearchKey(replaceTraditionalChineseCharacters(normalizedName))
        : null;

    addSearchTerm(terms, normalizedName);
    addSearchTerm(terms, simplifiedName);
    addPinyinSequenceTerms(terms, primarySyllables);

    const candidateGroups = polyphonic(name, PINYIN_OPTIONS)
        .map((group) =>
            Array.from(
                new Set(
                    group
                        .map((part) => normalizeSearchKey(part))
                        .filter((part): part is string => Boolean(part)),
                ),
            ),
        )
        .filter((group) => group.length > 0);
    const combinationCount = countPinyinCombinations(candidateGroups);

    if (candidateGroups.length > 0 && combinationCount <= MAX_PINYIN_COMBINATIONS) {
        addPinyinCombinations(terms, candidateGroups);
    } else {
        for (const group of candidateGroups) {
            for (const candidate of group) {
                addSearchTerm(terms, candidate);
                addSearchTerm(terms, candidate[0] ?? "");
            }
        }
    }

    return encodedSearchTerms(terms);
}

export function buildChineseNameSearchQuery(search: string): ChineseNameSearchQuery {
    const variants = new Set<string>();
    const normalized = normalizeSearchKey(search);
    const simplified = normalized
        ? normalizeSearchKey(replaceTraditionalChineseCharacters(normalized))
        : null;

    addSearchTerm(variants, normalized);
    addSearchTerm(variants, simplified);
    addSearchTerm(variants, normalized ? compactSearchKey(normalized) : null);
    addSearchTerm(variants, simplified ? compactSearchKey(simplified) : null);

    const variantList = Array.from(variants);

    return {
        variants: variantList,
        likePatterns: variantList
            .map((variant) => d1SafeLikePattern(`%${variant}%`))
            .filter((pattern): pattern is string => pattern !== null),
        exactTermPatterns: variantList.map((variant) =>
            d1SafeLikePattern(chineseNameSearchTermLikePattern(variant)),
        ),
    };
}

export function buildChineseNameSearchIndex(name: string): ChineseNameSearchIndex {
    const syllables = pinyin(name, PINYIN_OPTIONS)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
    const initials = pinyin(name, {
        ...PINYIN_OPTIONS,
        pattern: "first",
    })
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
    const [surname, ...givenNames] = syllables;
    // Given-name-first search currently treats the first Chinese character as
    // the surname. Compound surnames are intentionally not supported yet.
    const givenSurname =
        surname && givenNames.length > 0
            ? `${givenNames.join("")} ${surname}`
            : "";

    return {
        pinyin: normalizeSearchKey(syllables.join(" ")),
        pinyinCompact: normalizeSearchKey(syllables.join("")),
        pinyinInitials: normalizeSearchKey(initials.join("")),
        pinyinGivenSurname: normalizeSearchKey(givenSurname),
        searchTerms: buildSearchTerms(name, syllables),
    };
}
