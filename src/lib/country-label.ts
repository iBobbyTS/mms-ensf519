import type { Locale } from "$lib/paraglide/runtime";

export const FEATURED_COUNTRY_VALUES = [
    "China",
    "Hong Kong",
    "Macau",
    "Canada",
] as const;

const FEATURED_COUNTRY_SET = new Set<string>(FEATURED_COUNTRY_VALUES);

export function orderCountryValues(values: readonly string[]): string[] {
    const availableValues = new Set(values);
    return [
        ...FEATURED_COUNTRY_VALUES.filter((value) => availableValues.has(value)),
        ...values.filter((value) => !FEATURED_COUNTRY_SET.has(value)),
    ];
}

// FSII stores the historical English country names.  Keep those values as the
// stable option values, but resolve their display text through CLDR so every
// locale gets a translated label without duplicating a 200+ item message list.
const REGION_CODES: Record<string, string> = {
    Afghanistan: "AF", Albania: "AL", Algeria: "DZ", Andorra: "AD", Angola: "AO",
    Anguilla: "AI", Argentina: "AR", Armenia: "AM", Aruba: "AW", Australia: "AU",
    Austria: "AT", Azerbaijan: "AZ", Bahamas: "BS", Bahrain: "BH", Bangladesh: "BD",
    Barbados: "BB", Belarus: "BY", Belgium: "BE", Belize: "BZ", Benin: "BJ",
    Bermuda: "BM", Bhutan: "BT", Bolivia: "BO", Botswana: "BW", "Bouvet Island": "BV",
    Brazil: "BR", "British Virgin Islands": "VG", Brunei: "BN", Bulgaria: "BG",
    "Burkina Faso": "BF", Burundi: "BI", Cambodia: "KH", Cameroon: "CM", Canada: "CA",
    "Cape Verde": "CV", "Cayman Islands": "KY", Chad: "TD", Chile: "CL", China: "CN",
    "Christmas Island": "CX", "Cocos (Keeling) Islands": "CC", Colombia: "CO", Comoros: "KM",
    "Congo, Democratic Republic Of The (Zaire)": "CD", "Congo, Republic Of": "CG", "Cook Islands": "CK",
    "Costa Rica": "CR", Croatia: "HR", Cuba: "CU", Cyprus: "CY", "Czech Republic": "CZ",
    Denmark: "DK", Djibouti: "DJ", Dominica: "DM", "Dominican Republic": "DO", Ecuador: "EC",
    Egypt: "EG", "El Salvador": "SV", "Equatorial Guinea": "GQ", Eritrea: "ER", Estonia: "EE",
    Ethiopia: "ET", "Falkland Islands": "FK", "Faroe Islands": "FO", Fiji: "FJ", Finland: "FI",
    France: "FR", "French Guiana": "GF", Gabon: "GA", Gambia: "GM", Georgia: "GE", Germany: "DE",
    Ghana: "GH", Gibraltar: "GI", Greece: "GR", Greenland: "GL", Grenada: "GD", Guam: "GU",
    Guatemala: "GT", Guinea: "GN", "Guinea Bissau": "GW", Guyana: "GY", Haiti: "HT", Honduras: "HN",
    "Hong Kong": "HK", Hungary: "HU", Iceland: "IS", India: "IN", Indonesia: "ID", Iran: "IR",
    Iraq: "IQ", Ireland: "IE", Israel: "IL", Italy: "IT", Jamaica: "JM", Japan: "JP", Jordan: "JO",
    Kazakhstan: "KZ", Kenya: "KE", Kiribati: "KI", Kuwait: "KW", Kyrgyzstan: "KG", Laos: "LA", Latvia: "LV",
    Lebanon: "LB", Lesotho: "LS", Liberia: "LR", Libya: "LY", Liechtenstein: "LI", Lithuania: "LT",
    Luxembourg: "LU", Macau: "MO", Madagascar: "MG", Malawi: "MW", Malaysia: "MY", Maldives: "MV", Mali: "ML",
    Malta: "MT", "Marshall Islands": "MH", Mauritania: "MR", Mauritius: "MU", Mayotte: "YT", Mexico: "MX",
    Micronesia: "FM", Moldova: "MD", Monaco: "MC", Mongolia: "MN", Montenegro: "ME", Montserrat: "MS",
    Morocco: "MA", Mozambique: "MZ", Myanmar: "MM", Namibia: "NA", Nauru: "NR", Nepal: "NP", Netherlands: "NL",
    "New Caledonia (French)": "NC", "New Zealand": "NZ", Nicaragua: "NI", Niger: "NE", Nigeria: "NG", Niue: "NU",
    "Norfolk Island": "NF", "North Korea": "KP", "Northern Mariana Islands": "MP", Norway: "NO", Oman: "OM",
    Pakistan: "PK", Palau: "PW", Panama: "PA", "Papua New Guinea": "PG", Paraguay: "PY", Peru: "PE", Philippines: "PH",
    Pitcairn: "PN", Poland: "PL", "Polynesia (French)": "PF", Portugal: "PT", "Puerto Rico": "PR", Qatar: "QA",
    Reunion: "RE", Romania: "RO", Russia: "RU", Rwanda: "RW", "Saint Helena": "SH", "Saint Kitts And Nevis": "KN",
    "Saint Lucia": "LC", "Saint Pierre And Miquelon": "PM", "Saint Vincent And Grenadines": "VC", Samoa: "WS",
    "San Marino": "SM", "Sao Tome And Principe": "ST", "Saudi Arabia": "SA", Senegal: "SN", Serbia: "RS", Seychelles: "SC",
    Singapore: "SG", Slovakia: "SK", Slovenia: "SI", "Solomon Islands": "SB", Somalia: "SO", "South Africa": "ZA",
    "South Georgia And South Sandwich Islands": "GS", "South Korea": "KR", "South Sudan": "SS", Spain: "ES", "Sri Lanka": "LK",
    Sudan: "SD", Suriname: "SR", "Svalbard And Jan Mayen Islands": "SJ", Sweden: "SE", Switzerland: "CH", Syria: "SY", Taiwan: "TW",
    Tajikistan: "TJ", Tanzania: "TZ", Thailand: "TH", "Timor-Leste (East Timor)": "TL", Togo: "TG", Tokelau: "TK", Tonga: "TO",
    "Trinidad And Tobago": "TT", Tunisia: "TN", Turkey: "TR", Turkmenistan: "TM", "Turks And Caicos Islands": "TC", Tuvalu: "TV",
    Uganda: "UG", Ukraine: "UA", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US", Uruguay: "UY",
    Uzbekistan: "UZ", Vanuatu: "VU", Venezuela: "VE", Vietnam: "VN", "Virgin Islands": "VI", "Wallis And Futuna Islands": "WF",
    Yemen: "YE", Zambia: "ZM", Zimbabwe: "ZW", "American Samoa": "AS", "Antigua And Barbuda": "AG", "Bosnia-Herzegovina": "BA",
    "Central African Republic": "CF", "Guadeloupe (French)": "GP", "Holy See": "VA", "Ivory Coast (Cote D`Ivoire)": "CI", Kosovo: "XK",
    Macedonia: "MK", "Martinique (French)": "MQ", "Netherlands Antilles": "AN", "Palestinian Authority": "PS", "Pitcairn Island": "PN",
    Swaziland: "SZ", Unknown: "ZZ",
};

export function localizedCountryLabel(value: string, locale: Locale | string): string {
    const regionalNames: Record<string, Record<string, string>> = {
        "Hong Kong": { en: "Hong Kong, China", "zh-cn": "中国香港", "zh-tw": "中國香港" },
        Macau: { en: "Macao, China", "zh-cn": "中国澳门", "zh-tw": "中國澳門" },
        Taiwan: { en: "Taiwan, China", "zh-cn": "中国台湾", "zh-tw": "中國台灣" },
    };
    const explicitLabel = regionalNames[value]?.[locale];
    if (explicitLabel) return explicitLabel;
    const code = REGION_CODES[value];
    if (!code) return value;
    try {
        return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? value;
    } catch {
        return value;
    }
}
