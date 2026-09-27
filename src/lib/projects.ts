export type ProjectHomeItem = {
    id: number;
    name: string;
};

/**
 * The project table is developer-maintained. The frontend intentionally exposes
 * only these canonical rows; add or change projects through a reviewed migration.
 */
export const FIXED_PROJECTS = [
    { id: 1, name: "金色年华" },
    { id: 2, name: "新视野" },
] as const satisfies readonly ProjectHomeItem[];

export type FixedProjectId = (typeof FIXED_PROJECTS)[number]["id"];

export function isFixedProjectId(value: number): value is FixedProjectId {
    return value === 1 || value === 2;
}

export function parseCanonicalProjectId(value: string): FixedProjectId | null {
    if (value === "1") return 1;
    if (value === "2") return 2;
    return null;
}

export function normalizeProjectName(value: string): string {
    return value.trim();
}

export function projectHref(project: ProjectHomeItem): string {
    return `/projects/${project.id}`;
}

export function buildProjectHomeButtons(projects: ProjectHomeItem[]) {
    return projects
        .filter((project) => isFixedProjectId(project.id))
        .sort((left, right) => left.id - right.id)
        .map((project, index) => ({
        id: `project-${project.id}`,
        href: projectHref(project),
        label: project.name,
        requiredPermission: "admin" as const,
        startsGroup: index === 0,
        }));
}

export type ProjectListSortField = "name";
export type ProjectListSortDirection = "asc" | "desc";

export function resolveProjectListSort(input: {
    sort: string | null;
    dir: string | null;
}): {
    sort: ProjectListSortField;
    dir: ProjectListSortDirection;
} {
    return {
        sort: "name",
        dir: input.dir === "desc" ? "desc" : "asc",
    };
}
