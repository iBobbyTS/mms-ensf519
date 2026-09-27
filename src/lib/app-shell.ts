export type HomeSectionColor = "blue" | "green" | "orange" | "red" | "teal" | "slate";

export type HomeSectionButton = {
    id: string;
    href: string;
    labelKey?: string;
    label?: string;
    reload?: boolean;
    startsGroup?: boolean;
};

export type HomeSection = {
    id: string;
    titleKey: string;
    color: HomeSectionColor;
    buttons: HomeSectionButton[];
};

const HOME_SECTIONS: HomeSection[] = [
    {
        id: "members",
        titleKey: "homeSectionMembersTitle",
        color: "blue",
        buttons: [
            { id: "member-directory", href: "/members", labelKey: "memberDirectoryPageTitle" },
            { id: "member-add", href: "/members/add", labelKey: "memberAddPageTitle" },
        ],
    },
    {
        id: "groups",
        titleKey: "homeSectionGroupsTitle",
        color: "teal",
        buttons: [
            {
                id: "group-manage",
                href: "/interest-group/manage",
                labelKey: "groupManagementTitle",
            },
            {
                id: "attendance",
                href: "/interest-group/attendance",
                labelKey: "interestGroupCheckInTitle",
            },
        ],
    },
];

type PageTitleRule = {
    titleKey: string;
    exact?: string;
    pattern?: RegExp;
};

type BackRouteRule = {
    exact?: string;
    pattern?: RegExp;
    labelKey: string;
    target: string | ((match: RegExpMatchArray) => string);
};

export type LogicalBackRoute = {
    href: string;
    labelKey: string;
};

const PAGE_TITLE_RULES: PageTitleRule[] = [
    { exact: "/home", titleKey: "homeTitle" },
    { exact: "/members/add", titleKey: "memberAddPageTitle" },
    { exact: "/members", titleKey: "memberDirectoryPageTitle" },
    { exact: "/members/card-download", titleKey: "memberCardCsvTitle" },
    { pattern: /^\/members\/[^/]+\/edit$/, titleKey: "editClient" },
    { pattern: /^\/members\/[^/]+$/, titleKey: "clientDetailTitle" },
    { exact: "/interest-group/manage", titleKey: "groupManagementTitle" },
    { exact: "/interest-group/attendance", titleKey: "interestGroupCheckInTitle" },
];

const BACK_ROUTE_RULES: BackRouteRule[] = [
    { exact: "/members/add", target: "/members", labelKey: "backToMemberDirectory" },
    { exact: "/members/card-download", target: "/members", labelKey: "backToMemberDirectory" },
    {
        pattern: /^\/members\/([^/]+)\/edit$/,
        target: (match) => `/members/${match[1]}`,
        labelKey: "backToMemberDetail",
    },
    { pattern: /^\/members\/[^/]+$/, target: "/members", labelKey: "backToMemberDirectory" },
    { exact: "/members", target: "/home", labelKey: "backToHome" },
    { exact: "/interest-group/attendance", target: "/home", labelKey: "backToHome" },
    { exact: "/interest-group/manage", target: "/home", labelKey: "backToHome" },
];

export function getPageTitleKey(pathname: string): string {
    for (const rule of PAGE_TITLE_RULES) {
        if (rule.exact && rule.exact === pathname) {
            return rule.titleKey;
        }

        if (rule.pattern?.test(pathname)) {
            return rule.titleKey;
        }
    }

    return "homeTitle";
}

export function formatMmsTitle(title: string): string {
    return `${title} - MMS`;
}

export function getLogicalBackRoute(pathname: string): LogicalBackRoute | null {
    for (const rule of BACK_ROUTE_RULES) {
        if (rule.exact && rule.exact === pathname) {
            return {
                href: typeof rule.target === "function" ? rule.target([pathname] as RegExpMatchArray) : rule.target,
                labelKey: rule.labelKey,
            };
        }

        const match = rule.pattern ? pathname.match(rule.pattern) : null;
        if (match) {
            return {
                href: typeof rule.target === "function" ? rule.target(match) : rule.target,
                labelKey: rule.labelKey,
            };
        }
    }

    return null;
}

export function isFullWidthPage(_pathname: string): boolean {
    return false;
}

export function getHomeSections(): HomeSection[] {
    return HOME_SECTIONS;
}
