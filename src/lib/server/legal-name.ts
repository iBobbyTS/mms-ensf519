import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

function cleanNamePart(value: string | null | undefined): string {
    return value?.trim() ?? "";
}

function collapseSqliteNameSpaces(expression: string): string {
    let collapsed = expression;
    for (const codePoint of [9, 10, 11, 12, 13]) {
        collapsed = `replace(${collapsed}, char(${codePoint}), ' ')`;
    }
    collapsed = `trim(${collapsed})`;
    // Eight passes collapse every repeated-space run allowed by the 200-character name limit.
    for (let pass = 0; pass < 8; pass += 1) {
        collapsed = `replace(${collapsed}, '  ', ' ')`;
    }
    return collapsed;
}

function collapseSqliteNameSpacesSql(expression: SQLWrapper): SQL<string> {
    let collapsed = sql<string>`${expression}`;
    for (const codePoint of [9, 10, 11, 12, 13]) {
        collapsed = sql<string>`replace(${collapsed}, ${sql.raw(`char(${codePoint})`)}, ' ')`;
    }
    collapsed = sql<string>`trim(${collapsed})`;
    for (let pass = 0; pass < 8; pass += 1) {
        collapsed = sql<string>`replace(${collapsed}, '  ', ' ')`;
    }
    return collapsed;
}

export function sqliteNormalizedFirstLastNameExpression(
    firstNameExpression: string,
    lastNameExpression: string,
): string {
    return `lower(${collapseSqliteNameSpaces(firstNameExpression)}) || ' ' || lower(${collapseSqliteNameSpaces(lastNameExpression)})`;
}

export function sqliteNormalizedFirstLastNameSql(
    firstNameExpression: SQLWrapper,
    lastNameExpression: SQLWrapper,
): SQL<string> {
    return sql<string>`lower(${collapseSqliteNameSpacesSql(firstNameExpression)}) || ' ' || lower(${collapseSqliteNameSpacesSql(lastNameExpression)})`;
}

// Default legal name display is "FirstName LastName"; only use
// "LastName, FirstName" when a view explicitly asks for that order.
export function formatLegalNameFirstLast(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string | null {
    const cleanFirstName = cleanNamePart(firstName);
    const cleanLastName = cleanNamePart(lastName);
    const parts = [cleanFirstName, cleanLastName].filter(Boolean);

    return parts.length > 0 ? parts.join(" ") : null;
}

export function formatLegalNameLastFirst(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string | null {
    const cleanFirstName = cleanNamePart(firstName);
    const cleanLastName = cleanNamePart(lastName);

    if (cleanLastName && cleanFirstName) {
        return `${cleanLastName}, ${cleanFirstName}`;
    }

    return cleanLastName || cleanFirstName || null;
}
