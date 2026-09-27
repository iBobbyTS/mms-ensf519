import { like, or, sql, type SQL } from "drizzle-orm";

import type { ChineseNameSearchQuery } from "$lib/server/client-name-index";
import { schema } from "$lib/server/db-schema";

type ClientSearchColumns = Pick<
    typeof schema.clients,
    | "clientCode"
    | "firstName"
    | "lastName"
    | "chineseName"
    | "englishName"
    | "chineseNamePinyin"
    | "chineseNamePinyinCompact"
    | "chineseNamePinyinInitials"
    | "chineseNamePinyinGivenSurname"
    | "chineseNameSearchTerms"
>;

type OrganizationSearchColumns = Pick<
    typeof schema.organizations,
    | "organizationCode"
    | "chineseName"
    | "englishName"
    | "chineseNamePinyin"
    | "chineseNamePinyinCompact"
    | "chineseNamePinyinInitials"
    | "chineseNamePinyinGivenSurname"
    | "chineseNameSearchTerms"
>;

type ChildMemberSearchColumns = Pick<
    typeof schema.childMembers,
    | "childCode"
    | "chineseName"
    | "englishName"
    | "chineseNamePinyin"
    | "chineseNamePinyinCompact"
    | "chineseNamePinyinInitials"
    | "chineseNamePinyinGivenSurname"
    | "chineseNameSearchTerms"
>;

function likeExpressions(
    query: ChineseNameSearchQuery,
    buildExpressions: (searchLike: string) => SQL[],
): SQL[] {
    return query.likePatterns.flatMap(buildExpressions);
}

function orFalse(expressions: SQL[]): SQL {
    return or(...expressions) ?? sql<boolean>`0`;
}

export function clientSearchLikeExpression(
    table: ClientSearchColumns,
    query: ChineseNameSearchQuery,
): SQL {
    return orFalse(
        likeExpressions(query, (searchLike) => [
            like(table.clientCode, searchLike),
            sql`COALESCE(${table.chineseName}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`${table.englishName} LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.firstName}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.lastName}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyin}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinCompact}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinInitials}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinGivenSurname}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNameSearchTerms}, '') LIKE ${searchLike} COLLATE NOCASE`,
        ]),
    );
}

export function childMemberSearchLikeExpression(
    table: ChildMemberSearchColumns,
    query: ChineseNameSearchQuery,
): SQL {
    return orFalse(
        likeExpressions(query, (searchLike) => [
            like(table.childCode, searchLike),
            like(table.chineseName, searchLike),
            sql`${table.englishName} LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyin}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinCompact}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinInitials}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinGivenSurname}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNameSearchTerms}, '') LIKE ${searchLike} COLLATE NOCASE`,
        ]),
    );
}

export function organizationSearchLikeExpression(
    table: OrganizationSearchColumns,
    query: ChineseNameSearchQuery,
): SQL {
    return orFalse(
        likeExpressions(query, (searchLike) => [
            like(table.organizationCode, searchLike),
            like(table.chineseName, searchLike),
            sql`${table.englishName} LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyin}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinCompact}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinInitials}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNamePinyinGivenSurname}, '') LIKE ${searchLike} COLLATE NOCASE`,
            sql`COALESCE(${table.chineseNameSearchTerms}, '') LIKE ${searchLike} COLLATE NOCASE`,
        ]),
    );
}
