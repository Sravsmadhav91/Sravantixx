/**
 * Generates a Sale Agreement Word document (.docx) matching the real, legally
 * executed Mighty Homes template found in Sale_Agreements/*.docx (Sale
 * Agreement 110 / 201 / 217 / G01) for the "MIGHTY YUVA" project.
 *
 * Those documents follow a three-party structure — the original landowners
 * ("VENDOR/OWNER", represented by a registered Power of Attorney holder), the
 * developer ("DEVELOPERS/BUILDERS/CONFIRMING PARTY") and the "PURCHASER/S" —
 * because the developer builds under a Joint Development Agreement rather
 * than owning the land outright. The land-history recitals, JDA/RERA
 * references and Schedules A/C/D/E/F/G are identical, word-for-word, across
 * every unit sold in that project, so they are kept here as static
 * boilerplate (overridable via the optional `*Paragraphs` fields below for a
 * future project with a different land title). Only the purchaser details,
 * unit/flat description, sale consideration and payment breakdown vary per
 * booking and are generated from `SaleAgreementData`.
 *
 * Structure:
 *   - Title & opening recital
 *   - Vendor/Owner (landowner) block, Developer block, Purchaser/s block
 *   - WHEREAS clauses (land history, RERA, JDA)
 *   - Numbered agreement clauses (1–15)
 *   - Schedule A – Land property (Item I / Item II / Composite)
 *   - Schedule B – Apartment / flat
 *   - Schedule C – Specifications
 *   - Schedule D – Restrictions on Purchaser
 *   - Schedule E – Rights of Purchaser
 *   - Schedule F – Shared expenses
 *   - Schedule G – Owner/Promoter covenants
 *   - Witness / signature block
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  UnderlineType,
} from "docx";

// ─── Public data shape ────────────────────────────────────────────────────────

export type SaleAgreementPerson = {
  name: string;
  /** e.g. "S/o", "D/o", "W/o", "C/o" */
  relation?: string;
  /** Name of the father/husband/guardian referenced by `relation`. */
  relatedName?: string;
  age?: number;
  pan?: string;
  aadhar?: string;
  phone?: string;
  address?: string;
};

export type SaleAgreementPayment = {
  amount: number;
  date: string;
  mode?: string;
  reference?: string;
};

export type SaleAgreementData = {
  // Developer / project
  developerName: string;           // e.g. "M/s. MIGHTY HOMES"
  developerAddress?: string;       // e.g. "Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067"
  developerPartner?: string;       // e.g. "Mr. SRINIVAS.P, aged about 51 years, S/o. Sri.Ranga Rao"
  projectName: string;             // e.g. "MIGHTY YUVA"
  projectAddress: string;
  reraNumber?: string;
  /** City where the agreement is executed, e.g. "Bangalore". Defaults to the last comma-segment of projectAddress. */
  executionCity?: string;

  // Primary buyer
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerPan?: string;
  buyerAadhar?: string;
  buyerAddress?: string;
  buyerAge?: number;
  buyerFatherName?: string;
  /** e.g. "S/o", "D/o", "W/o" */
  buyerRelation?: string;

  // Co-buyers / joint purchasers
  coBuyers?: SaleAgreementPerson[];

  // Unit
  unitNumber: string;
  block?: string;
  floor?: number;
  configuration?: string;
  superBuiltUpAreaSqft: number;
  superBuiltUpAreaSqm?: number;
  carpetAreaSqft?: number;
  carpetAreaSqm?: number;
  balconyAreaSqft?: number;
  balconyAreaSqm?: number;
  udsSqft?: number;
  udsSqm?: number;
  ratePerSqft: number;
  facing?: string;

  // Financials
  agreementValue: number;
  bookingAmount?: number;
  bookingDate: string;
  gstPercent?: number;
  gstAmount?: number;
  carParkingCharges?: number;
  maintenanceFund?: number;
  corpusFund?: number;

  /** Payments actually received so far, rendered as the Clause 2 advance-consideration breakdown. */
  payments?: SaleAgreementPayment[];

  // Possession date
  possessionDate?: string;  // e.g. "March 2027"

  // ── Boilerplate overrides (defaults match the "MIGHTY YUVA" project) ──────
  /** Opening landowner ("VENDOR/OWNER") recital paragraphs. Pass `[]` to omit the 3-party structure entirely. */
  vendorOwnerParagraphs?: string[];
  /** Land-title / JDA / RERA WHEREAS recital paragraphs (excludes the flat-specific JDA paragraph, which is generated). */
  landHistoryParagraphs?: string[];
  /** Schedule 'A' property description paragraphs (Item I / Item II / Composite). */
  scheduleAParagraphs?: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inr(n: number): string {
  return "Rs." + n.toLocaleString("en-IN") + "/-";
}

/** Converts a 0-99 integer to words. */
function twoDigitWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n < 20) return ones[n];
  return (tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")).trim();
}

/** Indian numbering (Crore/Lakh/Thousand) to words, e.g. 12156400 -> "One Crore Twenty One Lakh Fifty Six Thousand and Four Hundred". */
function numToWords(n: number): string {
  let value = Math.abs(Math.round(n));
  if (value === 0) return "Zero Only";

  const crore = Math.floor(value / 10000000); value %= 10000000;
  const lakh = Math.floor(value / 100000); value %= 100000;
  const thousand = Math.floor(value / 1000); value %= 1000;
  const hundred = Math.floor(value / 100); value %= 100;
  const remainder = value;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh${lakh > 1 ? "s" : ""}`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(`${twoDigitWords(hundred)} Hundred`);
  if (remainder) parts.push(twoDigitWords(remainder));

  if (parts.length === 0) return "Zero Only";
  if (parts.length === 1) return `Rupees ${parts[0]} Only`;
  const last = parts.pop();
  return `Rupees ${parts.join(" ")} and ${last} Only`;
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d);
    const day = dt.getDate();
    const month = dt.toLocaleString("en-IN", { month: "long" });
    const year = dt.getFullYear();
    // "14th day of March 2026"
    const suffix = day === 1 || day === 21 || day === 31 ? "st"
      : day === 2 || day === 22 ? "nd"
      : day === 3 || day === 23 ? "rd" : "th";
    return `${day}${suffix} day of ${month} ${year}`;
  } catch {
    return d;
  }
}

function formatShortDate(d?: string): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
  } catch {
    return d;
  }
}

const FLOOR_NAMES = ["Ground", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
function floorName(floor?: number): string {
  if (floor === undefined || floor === null) return "—";
  if (floor >= 0 && floor < FLOOR_NAMES.length) return `${FLOOR_NAMES[floor]} Floor`;
  return `${floor}th Floor`;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const FONT = "Times New Roman";
const SIZE = 22; // 11pt in half-points

function t(text: string, opts?: { bold?: boolean; underline?: boolean; size?: number }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size ?? SIZE,
    bold: opts?.bold,
    underline: opts?.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function p(
  runs: TextRun[],
  opts?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    indent?: number;
  }
): Paragraph {
  return new Paragraph({
    children: runs,
    alignment: opts?.align ?? AlignmentType.BOTH,
    spacing: { before: opts?.before ?? 80, after: opts?.after ?? 80, line: 320, lineRule: "auto" as const },
    indent: opts?.indent ? { left: convertInchesToTwip(opts.indent) } : undefined,
  });
}

/** Plain paragraph built from a static boilerplate string. */
function bp(text: string): Paragraph {
  return p([t(text)]);
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [t(text, { bold: true, underline: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 280, after: 120 },
  });
}

function clause(num: string | number, text: string): Paragraph {
  return new Paragraph({
    children: [t(`${num}.\t${text}`)],
    alignment: AlignmentType.BOTH,
    spacing: { before: 80, after: 80, line: 320, lineRule: "auto" as const },
    indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.3) },
  });
}

function subClause(num: string, text: string): Paragraph {
  return new Paragraph({
    children: [t(`${num}\t${text}`)],
    alignment: AlignmentType.BOTH,
    spacing: { before: 60, after: 60, line: 320, lineRule: "auto" as const },
    indent: { left: convertInchesToTwip(0.6), hanging: convertInchesToTwip(0.3) },
  });
}

function blank(): Paragraph {
  return new Paragraph({ children: [t("")], spacing: { before: 80, after: 80 } });
}

// ─── Boilerplate (identical across every unit sold in the "MIGHTY YUVA" project) ──

const DEFAULT_VENDOR_OWNER_PARAGRAPHS: string[] = [
  "Smt. D.T.GOWRAMMA, aged about 67 years, W/o Late Sri.M.Muniyappa, Aadhar No.7150 9475 2596",
  "Sri.M.SHIVAKUMARA, aged about 49 years, S/o Late Sri.M.Muniyappa, Aadhar No.4220 7406 3530",
  "Sri.M.PRABHAKAR, aged about 43 years, S/o Late Sri.M.Muniyappa, Aadhar No.4644 3634 6841",
  "All are R/at No.340, Madduramma Temple Street, A K Colony, Near Madduramma Temple, Old Byappanahalli, Maruthi Sevanagar Post, Bangalore – 560 033.",
  "Represented by his registered Power of Attorney Holder Mr. SRINIVAS.P, Managing Partner of M/s. MIGHTY HOMES,",
];

const DEFAULT_LAND_HISTORY_PARAGRAPHS: string[] = [
  "WHEREAS, the vendors are the absolute joint owners of all that piece and parcel of property bearing Present Property E-PID No.150200401300522743, converted Sy.No.113/3, (converted from Agriculture to Non-Agriculture Residential purpose vide conversion order bearing No.332968, dated 20/05/2022, issued by the Deputy Commissioner, Bangalore District, Bangalore) situated at Doddabanahalli Village, Bidarahalli Hobil, Bangalore East Taluk, measuring about 0-38.75 Guntas (out of 1 Acre 6½ Guntas), which Property is more fully described in Item I of the Schedule hereunder and hereinafter referred to as Item I of the \u201cSCHEDULE PROPERTY\u201d for brevity.",
  "Originally the property was acquired by Sri.Muniyappa S/o Late Sri.Munishamappa during his lifetime vide registered Deed of Sale dated 22/10/1975, registered as document No.2670/1975-76, Volume No.1467, Pages 4 to 5, Book-I, registered before the Office of the Sub-Registrar, Hoskote, Bangalore Rural District. Later the said Late Sri.Muniyappa deceased intestate on 09/07/2017, after which Sri.M.Narasimhamurthy S/o Late Sri.Muniyappa released his right by entering into a registered Deed of Release and Relinquishment dated 25/06/2024, registered as document No.2046/2024-25, Book-I, registered before the office of the Sub-Registrar, Shivaji Nagar (Bidarahalli), Bangalore, including Item I of the Schedule Property. Thus, presently the parties herein are the absolute joint owners of Item I of the Schedule Property.",
  "WHEREAS, the Vendor at Sl.No.1 is the absolute owner of all that piece and parcel of property bearing Present Property E-PID No.150200401300522744, converted Sy.No.113/4, (converted from Agriculture to Non-Agriculture Residential purpose vide conversion order bearing No.ALN(EBK) SR 115/2022-23, (420943), dated 10/01/2023, issued by the Deputy Commissioner, Bangalore District, Bangalore) situated at Doddabanahalli Village, Bidarahalli Hobil, Bangalore East Taluk, measuring about 3 Guntas, which Property is more fully described in the Schedule hereunder and hereinafter referred to as the \u201cSCHEDULE PROPERTY\u201d for brevity. She had acquired the same vide order dated 16/08/2021, in RRT(BE)CR:176/2021-22, passed by the Assistant Commissioner Bangalore, North Taluk, as per the order passed by the Deputy Director of Land Records (DDLR).",
  "WHEREAS, both the aforesaid Properties referred to above are situated adjacent to each other at Doddabanahalli Village, Bidarahalli Hobil, Bangalore East Taluk, and both the properties totally measure 1 Acre and 1.75 Guntas, which Property is more fully described in the Composite Schedule hereunder and hereinafter referred to as the Composite Schedule Property.",
  "AND WHEREAS, the Vendors/Developer have obtained a plan sanction for the Development Scheme from the concerned authority, vide its order bearing No.BDA/NM/AS/AA-1/TS-4/58/2024-25, dated 03/03/2025, for the construction of a multi-storied Residential Building consisting of Stilt, Ground plus Three upper floors, and after having credited the requisite fee, have accordingly commenced construction of the multi-storied building over the Schedule \u201cA\u201d Property.",
  "AND WHEREAS, the Vendor/Developer have also registered the project with the Real Estate (Regulation and Development) Act, 2016, Karnataka Real Estate (Regulation and Development) Rules – 2017 vide registered Number: {{RERA}}, for the multi-storied residential building complex known as \u201c{{PROJECT}}\u201d over the Schedule \u201cA\u201d Property.",
];

const DEFAULT_SCHEDULE_A_PARAGRAPHS: string[] = [
  "Item I",
  "All that piece and parcel of property bearing Present Property E-PID No.150200401300522743, converted Sy.No.113/3, (converted from Agriculture to Non-Agriculture Residential purpose vide conversion order bearing No.332968, dated 20/05/2022, issued by the Deputy Commissioner, Bangalore District, Bangalore) situated at Doddabanahalli Village, Bidarahalli Hobil, Bangalore East Taluk, measuring about 0-38.75 Guntas (out of 1 Acre 6½ Guntas) and bounded on the:",
  "East by : Road formed in Sy.No.113;\nWest by : Item II Property (Sy.No.113/4) & Land in Sy.No.115;\nNorth by : Land in Sy.No.114;\nSouth by : Land in Sy.No.113/1;",
  "Item II",
  "All that piece and parcel of property bearing Present Property E-PID No.150200401300522744, converted Sy.No.113/4, (converted from Agriculture to Non-Agriculture Residential purpose vide conversion order bearing No.ALN(EBK) SR 115/2022-23, (420943), dated 10/01/2023, issued by the Deputy Commissioner, Bangalore District, Bangalore) situated at Doddabanahalli Village, Bidarahalli Hobil, Bangalore East Taluk, measuring about 3 Guntas and bounded on the:",
  "East by : Item I Property thereafter Road;\nWest by : Land in Sy.No.115;\nNorth by : Land in Sy.No.114;\nSouth by : Land in Sy.No.113/3;",
  "COMPOSITE SCHEDULE PROPERTY",
  "All that piece and parcel of the immovable Property Sy.No.113/3 (converted from Agriculture to Non-Agriculture Residential purpose vide conversion order bearing No.332968, dated 20/05/2022, issued by the Deputy Commissioner, Bangalore District, Bangalore), measuring about 0-38.75 Guntas (out of 1 Acre 6½ Guntas), and converted Sy.No.113/4 (converted from Agriculture to Non-Agriculture Residential purpose vide conversion order bearing No.ALN(EBK) SR 115/2022-23, (420943), dated 10/01/2023, issued by the Deputy Commissioner, Bangalore District, Bangalore) situated at Doddabanahalli Village, Bidarahalli Hobil, Bangalore East Taluk, measuring about 3 Guntas, together totally measuring 1 Acre and 1.75 Guntas, with all rights and appurtenances whatsoever hereunder or underneath or above the surface, and bounded on the:",
  "East by : Road;\nWest by : Land in Sy.No.115;\nNorth by : Land in Sy.No.114;\nSouth by : Land in Sy.No.113/1;",
];

const SCHEDULE_C_ITEMS: [string, string][] = [
  ["1. Structure", "RCC Framed structure."],
  ["2. Walls", "6\u201d Solid external walls with 4\u201d Solid Blocks for internal walls."],
  ["3. Plastering", "Internal walls with lime rendering and external walls with sponge finish."],
  ["4. Doors", "Honne wooden door frames for all rooms, main door frame with teak wood shutter and other doors with waterproof flush shutters."],
  ["5. Windows", "UPVC Sliding windows, MS Grills and mosquito mesh for bedroom windows."],
  ["6. Electrical Work", "Concealed 1 phase copper wiring with all necessary points like TV, Telephone, Geyser, AC etc., with Anchor or equivalent switches & sockets."],
  ["7. Flooring", "Combination of Vitrified/Semi Vitrified/Ceramic tiles for living, bedroom and dining, and Ceramic tiles for the remaining area."],
  ["8. Common Area", "Anti-skid tiles for common areas such as staircase and lobbies etc."],
  ["9. Toilets", "Glazed tiles up to door level, all standard or equivalent CP fittings, WC with wash basins."],
  ["10. Paints", "Internal walls with Birla wall care putty finish with OBD paint, external in waterproof paint, enamel paint for doors, windows and grills, natural polish for main doors as per architectural drawing."],
  ["11. Lift", "Kone elevators / Equivalent."],
  ["12. Generator", "Generator back up for lifts, common area lighting and 1 KVA for each flat."],
  ["13. Gym", "Gym with treadmills, cycles, weight lifts and other basic needs."],
  ["14. Amenities", "Swimming Pool and Children\u2019s Play Area."],
];

const SCHEDULE_D_INTRO =
  "The Purchasers so as to bind himself/herself/themselves, his/her/their successors-in-interest, heirs, representatives and assigns, with the consideration of promoting and protecting his/her/their rights, and in consideration of the covenants of the Seller being binding on him/them and the owners of the other undivided interest in the Property described in Schedule 'A' hereto, agree to be bound by the following terms and conditions:";
const SCHEDULE_D_ITEMS: string[] = [
  "Not to raise any construction in addition to that mentioned in Schedule \u201cB\u201d above.",
  "Not to use or permit the use of the construction referred to in Schedule \u201cB\u201d above in a manner which would diminish the value or utility of the property described in Schedule \u201cA\u201d above or any construction made thereon.",
  "Not to use the space in the land described in Schedule A above, left after the construction referred to in Schedule B above, for parking any heavy vehicles or in any manner which might cause hindrance to free ingress to or from any other part of the construction.",
  "Not to default in the payment of any taxes or levies to be shared by the other Apartment Owners of the property described in Schedule A above, or expenses to be shared by the owners of the constructions thereon, provided such taxes or levies become leviable from the date his/her/their respective apartment is ready for occupation.",
  "Not to decorate the exterior of the property constructed by the Developer for the Purchaser other than in the manner agreed to by at least two-third majority of owners of constructions in the land described under Schedule A above.",
  "Not to make any arrangement for maintaining the building referred to in Schedule B above and the common amenities therein, other than that agreed to by two-third majority of all apartment owners.",
  "The covered or uncovered parking lot for the respective owner/s will be used by them for parking their four wheelers or two wheelers.",
  "The PURCHASERS shall have no objection whatsoever for construction of covered/open car parking space for other Purchaser/s, and such spaces shall always remain the property of the respective purchaser/s.",
];

const SCHEDULE_E_ITEMS: string[] = [
  "Full right and liberty for the PURCHASERS, in common with all other persons entitled, permitted or authorised to the like rights, at all times of the day or night and for all purposes, to go, pass and repass over all open spaces, lobbies, parking spaces, terraces, staircases and passages inside and outside the building and constructions described in the Schedule hereto.",
  "Full right and liberty for the PURCHASERS, in common with all other persons, with or without motor cars or other permitted vehicles, at all times day and night and for all purposes, to go and pass over the land appurtenant to the building constructed on the land described in Schedule A above.",
  "The right to subjacent and lateral support, shelter and protection from the other parts of the aforesaid building from the side and roof thereof.",
  "The free and uninterrupted passage of running water, soil, gas and electricity to and from the construction through sewers, drains, cables, pipes and wires which now are, or may at any time hereafter be, in, under or passing through the building or any part thereof.",
  "Right of passage for the PURCHASERS and their agents or workmen to the other parts of the building at all reasonable times (on notice) to where the water tanks are situated, for the purpose of cleaning, repairing or maintaining the same.",
  "Right of passage for the PURCHASERS or their agents or workmen to the other parts of the building at all times (on notice) to enter into and upon such parts for the purpose of repairing, cleaning, maintaining or renewing any sewers, drains, water courses, cables, pipes and wires, causing as little disturbance as possible and making good any damage caused.",
  "To lay cables or wires through common walls or passages for telephone installations, respecting the equal rights of others.",
  "The right for the PURCHASERS' servants, workmen and others, at all reasonable times (on notice), to enter into and upon other parts of the building for the purpose of repairing, maintaining, renewing, altering or rebuilding the construction referred to in Schedule B hereto or any part of the building giving support, shelter or protection to the construction thereof.",
  "The right to mortgage/transfer the Property to any individual Bank or financial institution for raising funds, under the Karnataka Apartments Ownership Act.",
  "Right to deal with any of the acts aforesaid without notice in case of emergency.",
  "Any dispute regarding any right of use of space, way of entry or use of common premises shall be settled by the Association to be formed, and pending its formation, by the OWNERS/PROMOTER on the basis of the majority of votes of the other PURCHASERS of the premises.",
];

const SCHEDULE_F_INTRO =
  "The PURCHASERS, in proportion of his/her/their share along with other Purchaser/s in proportion of their shares, shall be deemed to have accepted the following conditions and to have contracted to bear the following expenses.";
const SCHEDULE_F_ITEMS: string[] = [
  "All the rates and outgoings payable, if any, in respect of the land described in Schedule A hereto and the building thereon; till registration of the absolute sale deed such expenses shall be borne by the Owners/Promoter.",
  "The expenses of routine maintenance including painting, whitewashing, cleaning etc., and provision of common services to the building as set out below:",
];
const SCHEDULE_F_SUBITEMS: string[] = [
  "a. Maintenance of pump sets and other machinery, sanitary and electrical lines common to the building.",
  "b. Payment of electrical and water charges for common services.",
  "c. Replacement of bulbs in corridors.",
  "d. Maintenance of garden and potted plants in the building.",
  "e. Provision of (night) watchman and other security etc.,",
];
const SCHEDULE_F_CLOSING =
  "Till the formation of the Association, the services mentioned above will be carried out by the OWNERS/PROMOTER. Thereafter, decisions shall be taken by the majority of the PURCHASERS (OWNERS), and repairs/maintenance work shall be carried out against payment of such sums as may be determined by them from time to time. Should a PURCHASER default in payment due for any common expenses, benefits or amenities, the First Party or the Association of Apartment Owners shall have the right to remove such common benefits or amenities, including electricity and water connection, from his/her/their enjoyment. If at any time development and/or other charges are levied by the Municipal Corporation of Bangalore City and/or any Government department or public authority in respect of the said land and/or construction, after completion of the building and handing over possession, the same shall be borne by all the Purchaser/s among themselves in proportion to the respective floor areas of such flats; however, the Purchasers shall not be responsible for charges pertaining to the period prior to handing over possession of the flats.";

const SCHEDULE_G_ITEMS: string[] = [
  "The OWNERS/PROMOTER will require every person for whom they shall hereafter construct any construction in the said building to covenant and observe the restrictions set forth in the Schedule above.",
  "The OWNERS/PROMOTER and their assignees, claiming under, through or in trust for the OWNERS/PROMOTER, will always respect the rights of the PURCHASERS mentioned in this agreement and in Schedule E in particular.",
  "The OWNERS/PROMOTER, in constructing any flats/apartments hereafter, shall sincerely follow the covenants herein contained and shall not confer any right reserved for the PURCHASERS herein, nor exclude for other PURCHASERS any burden expressed to be shared by the PURCHASER/S herein.",
  "The OWNERS/PROMOTER shall give inspection of all title deeds relating to the property, retained with them, at the request of the PURCHASERS or their nominees at all reasonable times, and hand over the same to the Apartment Owners Association on its formation.",
  "The OWNERS/PROMOTER shall provide required papers/documents (certified copy) at the request of the Purchasers for raising funds from any individual Banks, financial institutions etc.,",
  "PROVIDED further, the OWNERS/PROMOTER shall not be liable to set right any structural defects discovered after one year from the date of announcing possession of the apartment and making it ready for delivery to the PURCHASER/S.",
  "PROVIDED always, the OWNERS/PROMOTER shall not be liable, and the PURCHASERS shall be liable, for charges for common amenities and meter rent, electricity and water from the date of communication by the OWNERS/PROMOTER to the PURCHASERS of the readiness to hand over possession of the property referred to in Schedule \u201cB\u201d above.",
  "Any delay or indulgence by the OWNERS/PROMOTER in enforcing the terms of this Agreement, or any forbearance or giving of time to the Purchaser/s, shall not be construed as a waiver by the OWNERS/PROMOTER of any breach or non-compliance of any of the terms, conditions and covenants of this Agreement by the Purchaser/s, nor shall it in any manner prejudice the right of the OWNERS/PROMOTER, and shall also fully and effectually discharge the OWNERS/PROMOTER.",
];

// ─── Person block rendering ───────────────────────────────────────────────────

function personBlock(idx: number | null, person: SaleAgreementPerson): Paragraph[] {
  const lines: Paragraph[] = [];
  const prefix = idx !== null ? `${idx}). ` : "";
  const ageText = person.age ? `, aged about ${person.age} years,` : ",";
  lines.push(p([t(`${prefix}${person.name.toUpperCase()}${ageText}`, { bold: true })]));
  if (person.relation && person.relatedName) {
    lines.push(p([t(`${person.relation}. ${person.relatedName},`)]));
  }
  if (person.pan) lines.push(p([t(`PAN No: ${person.pan}`)]));
  if (person.aadhar) lines.push(p([t(`Aadhar No: ${person.aadhar}`)]));
  return lines;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateSaleAgreement(data: SaleAgreementData): Promise<Blob> {
  const developerName = data.developerName || "M/s. MIGHTY HOMES";
  const developerAddress = data.developerAddress || "Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067";
  const developerPartner = data.developerPartner || "Mr. SRINIVAS.P, aged about 51 years, S/o. Sri.Ranga Rao";
  const possessionDate = data.possessionDate || "March 2027";
  const executionCity = data.executionCity || data.projectAddress.split(",").pop()?.trim() || data.projectAddress;

  const allBuyers: SaleAgreementPerson[] = [
    {
      name: data.buyerName,
      relation: data.buyerRelation,
      relatedName: data.buyerFatherName,
      age: data.buyerAge,
      pan: data.buyerPan,
      aadhar: data.buyerAadhar,
      phone: data.buyerPhone,
      address: data.buyerAddress,
    },
    ...(data.coBuyers ?? []),
  ];

  const totalConsideration =
    data.agreementValue +
    (data.gstAmount ?? 0) +
    (data.carParkingCharges ?? 0) +
    (data.maintenanceFund ?? 0) +
    (data.corpusFund ?? 0);

  const totalConsiderationText = `${inr(totalConsideration)} (${numToWords(totalConsideration)})`;

  // ── Purchaser block (numbered only when there is more than one buyer) ───────
  const purchaserLines: Paragraph[] = [];
  allBuyers.forEach((buyer, idx) => {
    purchaserLines.push(...personBlock(allBuyers.length > 1 ? idx + 1 : null, buyer));
  });
  const addresses = [...new Set(allBuyers.map((b) => b.address).filter((a): a is string => !!a))];
  if (addresses.length > 0) {
    const leadIn = allBuyers.length > 1 ? (addresses.length > 1 ? "Above are" : "Both/All are") : "";
    purchaserLines.push(blank());
    purchaserLines.push(p([t(`${leadIn ? leadIn + " " : ""}R/at ${addresses.join(" and ")}`)]));
  }

  // ── Vendor/Owner recital (3-party JDA structure; omit entirely if overridden with []) ──
  const vendorOwnerParagraphs = data.vendorOwnerParagraphs ?? DEFAULT_VENDOR_OWNER_PARAGRAPHS;
  const hasVendorOwner = vendorOwnerParagraphs.length > 0;

  // ── Land-history WHEREAS recitals, with RERA/project name substituted in ────
  const landHistoryParagraphs = (data.landHistoryParagraphs ?? DEFAULT_LAND_HISTORY_PARAGRAPHS).map((text) =>
    text.replace("{{RERA}}", data.reraNumber || "the applicable RERA registration number").replace("{{PROJECT}}", data.projectName),
  );

  const scheduleAParagraphs = data.scheduleAParagraphs ?? DEFAULT_SCHEDULE_A_PARAGRAPHS;

  // ── Clause 2 — advance consideration payment breakdown ──────────────────────
  const payments = data.payments && data.payments.length > 0
    ? data.payments
    : data.bookingAmount
      ? [{ amount: data.bookingAmount, date: data.bookingDate, mode: "online transfer" }]
      : [];
  const advancePaid = payments.reduce((sum, pmt) => sum + pmt.amount, 0);
  const paymentLines = payments.map((pmt) =>
    p([t(
      `A sum of ${inr(pmt.amount)} (${numToWords(pmt.amount)}) paid through way of ${pmt.mode || "online transfer"}, dated: ${formatShortDate(pmt.date)}` +
      (pmt.reference ? `, Ref. No. ${pmt.reference}.` : "."),
    )]),
  );

  // ── Schedule B — flat description paragraph ─────────────────────────────────
  const areaBits: string[] = [
    `measuring about ${data.superBuiltUpAreaSqft.toLocaleString("en-IN")} Sq.feet${data.superBuiltUpAreaSqm ? ` or ${data.superBuiltUpAreaSqm} Sq.Mtrs` : ""} super built up area`,
  ];
  if (data.balconyAreaSqft) areaBits.push(`which includes balcony & utility area ${data.balconyAreaSqft.toLocaleString("en-IN")} Sq.feet${data.balconyAreaSqm ? ` or ${data.balconyAreaSqm} Sq.Mtrs` : ""}`);
  if (data.carpetAreaSqft) areaBits.push(`(Carpet area of ${data.carpetAreaSqft.toLocaleString("en-IN")} Sq.feet${data.carpetAreaSqm ? ` or ${data.carpetAreaSqm} Sq.Mtrs` : ""})`);
  const scheduleBText =
    `Apartment bearing No.${data.unitNumber}${data.block ? ` (Block: ${data.block})` : ""}, in ${floorName(data.floor)}, ${areaBits.join(", ")}` +
    `${data.configuration ? `, containing ${data.configuration} configuration` : ""}, together with one covered car parking space, including proportionate share in common areas such as passages, lobbies, staircase etc., in the multi-storied residential building known as \u201c${data.projectName}\u201d constructed over Schedule \u201cA\u201d Property` +
    `${data.udsSqft ? `, together with ${data.udsSqft.toLocaleString("en-IN")} Sq.feet${data.udsSqm ? ` or ${data.udsSqm} Sq.Mtrs` : ""} undivided share of the land comprised in Schedule \u201cA\u201d Property` : ""}.`;

  // ─── Document assembly ────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        children: [

          // ── Title ───────────────────────────────────────────────────────────
          new Paragraph({
            children: [t("AGREEMENT OF SALE", { bold: true, underline: true, size: 32 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // ── Opening recital ─────────────────────────────────────────────────
          p([
            t("THIS AGREEMENT OF SALE is made and executed on this "),
            t(formatDate(data.bookingDate), { bold: true }),
            t(" at "),
            t(executionCity, { bold: true }),
            t(" BETWEEN:"),
          ], { before: 160, after: 160 }),

          blank(),

          // ── Vendor/Owner block (3-party JDA structure) ───────────────────────
          ...(hasVendorOwner ? [
            ...vendorOwnerParagraphs.map(bp),
            blank(),
            p([t("hereinafter referred to as the "), t("VENDOR/OWNER", { bold: true, underline: true })]),
            blank(),
            p([t("AND", { bold: true })], { align: AlignmentType.CENTER }),
            blank(),
          ] : []),

          // ── Developer / Confirming Party block ───────────────────────────────
          p([t(developerName + ",", { bold: true })]),
          p([t("a Partnership firm having its office at")]),
          p([t(developerAddress + ".")]),
          p([t("Represented by it's Managing Partner")]),
          blank(),
          p([t(developerPartner + ",", { bold: true })]),
          blank(),
          p([t("hereinafter called the "), t("DEVELOPERS/BUILDERS/CONFIRMING PARTY", { bold: true, underline: true })]),
          blank(),
          p([t("AND", { bold: true })], { align: AlignmentType.CENTER }),
          blank(),

          // ── Purchaser block ─────────────────────────────────────────────────
          ...purchaserLines,
          blank(),
          p([t("hereinafter referred to as the "), t("PURCHASER/S", { bold: true, underline: true })]),
          blank(),
          p([
            t(`The expressions "${hasVendorOwner ? "VENDOR" : "DEVELOPER"}", "PURCHASER/S" and "DEVELOPERS/BUILDERS/CONFIRMING PARTY" wherever they appear in this context shall mean and include their respective heirs, executors, administrators, legal representatives and assigns.`),
          ]),
          blank(),

          // ── Land-history / JDA / RERA WHEREAS clauses ────────────────────────
          ...(hasVendorOwner ? landHistoryParagraphs.map(bp) : [
            bp("AND WHEREAS, the Developer/Promoter has obtained a plan sanction and has commenced construction of a multi-storied residential building over the Schedule 'A' Property."),
            ...(data.reraNumber ? [bp(`AND WHEREAS, the Developer/Promoter has also registered the project with the Real Estate (Regulation and Development) Act, 2016, Karnataka Real Estate (Regulation and Development) Rules – 2017 vide registered Number: ${data.reraNumber}, for the multi-storied residential building complex known as "${data.projectName}" over the Schedule 'A' Property.`)] : []),
          ]),
          blank(),

          // ── Flat allocation (JDA) paragraph ──────────────────────────────────
          p([
            t(hasVendorOwner
              ? `AND WHEREAS, the Vendor has entered into a Joint Development Agreement with ${developerName}, hereinafter referred to as the Developer/Promoter/Builder, and as per the registered Joint Development Agreement entered into between the Developer and Owner of Schedule "A" Property, inter alia the flat bearing No.${data.unitNumber}, in ${floorName(data.floor)}, ${areaBits.join(", ")}, along with${data.udsSqft ? ` ${data.udsSqft.toLocaleString("en-IN")} Sq.feet${data.udsSqm ? ` or ${data.udsSqm} Sq.Mtrs` : ""} of` : ""} undivided share of land comprised in Schedule A property, has been allocated to the share of the builder herein towards his share, which flat is more fully described in Schedule B hereunder and hereinafter referred to as Schedule B property. As per the Development Agreement, the Vendor is entitled to receive sale consideration towards the sale of Schedule B Property.`
              : `AND WHEREAS, the Developer has agreed to sell Schedule B Property, being flat bearing No.${data.unitNumber}, in ${floorName(data.floor)}, ${areaBits.join(", ")}, more fully described in Schedule B hereunder.`),
          ]),
          blank(),

          p([t("WHEREAS, the Purchasers herein approached the "), t(hasVendorOwner ? "Vendor" : "Developer"), t(" herein offering to purchase Schedule \u201cB\u201d Property, on certain terms and conditions to which the "), t(hasVendorOwner ? "Vendor" : "Developer"), t(" agreed to procure to such purchasers such rights and obligations mentioned herein below:")]),
          blank(),
          p([t("WHEREAS, the parties hereto decided to have the aforesaid terms and conditions reduced to writing under this agreement as follows:")]),
          blank(),
          p([
            t(`AND WHEREAS, the ${hasVendorOwner ? "Vendor/Builder" : "Developer"} have agreed to sell Schedule B Property and the Purchaser/s has/have agreed to purchase the said property for a sale consideration of `),
            t(totalConsiderationText, { bold: true }),
            t(" including car parking space, KEB, taxes etc., excluding registration and stamp duty fees and free from encumbrances."),
          ]),
          blank(),
          p([t("NOW THIS AGREEMENT OF SALE WITNESSETH AS FOLLOWS:")], { align: AlignmentType.CENTER, before: 160, after: 160 }),

          // ── Numbered clauses ─────────────────────────────────────────────────
          clause("1", `That in pursuance of the agreement, the ${hasVendorOwner ? "Vendor/Builder" : "Developer/Builder"} has agreed to sell and the Purchasers have agreed to purchase the Schedule B property for a sale consideration of ${totalConsiderationText} and has agreed to pay the said sale consideration in the following manner.`),
          blank(),

          ...(payments.length > 0 ? [
            clause("2", `The PURCHASER/S has/have paid a sum of ${inr(advancePaid)} (${numToWords(advancePaid)}) in the following manner,`),
            ...paymentLines,
            p([t(`as advance sale consideration, the ${hasVendorOwner ? "Vendor/Builder" : "Developer/Builder"} hereby acknowledges the said amount before the undersigned witnesses. On payment of the aforesaid amounts in full by the PURCHASER/S, the latter shall execute a Deed of Absolute Sale duly conveying the aforesaid fraction of undivided share, right, title and interest in the Schedule A Property along with the flat in question. Time shall be the essence of this Agreement.`)]),
            blank(),
          ] : []),

          clause("3", `The ${hasVendorOwner ? "Vendor/Builder" : "Developer/Builder"} hereby covenants and assures the PURCHASER/S that the ${hasVendorOwner ? "Vendor" : "Developer"} is the absolute owner of the Schedule B Property and the same is free from all kinds of encumbrances, charges and mortgages whatsoever, and is not the subject matter of any attachment or other legal proceedings before any Court of Law, Taxation or other statutory authorities, and is in actual possession and enjoyment of the project wherein construction of the flat is going on, and is competent to enter into this agreement and to effect sale of the Schedule B Property as per the terms of this agreement.`),
          blank(),

          clause("4", "All expenses relating to Stamp Duty, registration and other incidental expenses shall be borne by the Purchaser only."),
          blank(),

          clause("4a", `The ${hasVendorOwner ? "Vendor/Builder" : "Developer/Builder"} shall, under normal conditions, complete the construction of the building and agree to hand over possession of the Schedule B property on or before ${possessionDate} from this agreement date, with a grace period of 1 month, subject to availability of cement, steel and other essential items of construction and also subject to unforeseen events such as Acts of God, Earthquake, Floods, War or other local disturbances, changes in laws of the state, corporation or any other cause beyond the control of the ${hasVendorOwner ? "Vendor/Builder" : "Developer/Builder"}.`),
          blank(),

          clause("5", "The Purchaser shall not use the flat or permit the same to be used for any purpose whatsoever other than as a private dwelling house, or for any purpose which may or is likely, in the opinion of the VENDOR/PROMOTER and/or managing committee of the Association, to cause nuisance or annoyance to occupiers of the other flats/garages in the said building or to owners or occupiers of neighbouring properties, and shall not use the garage for any purpose except for keeping a motor car."),
          blank(),

          clause("6", `It is hereby agreed that the name of the multi-storied building constructed on Schedule "A" Property shall be "${data.projectName}" and the Purchasers shall not seek a change of name at any point of time.`),
          blank(),

          clause("7", "It is hereby further agreed that the PURCHASERS shall become members of the Apartment Owners Association to be constituted in accordance with the provisions of the Karnataka Apartments Ownership Act 1972 and rules framed thereunder, after the Purchaser becomes the owner of the flat in question. The PURCHASER/S shall execute such declarations, affidavits, undertakings and papers as may be required under the said Act and other papers required by the Electricity Board (KPTCL)/BESCOM and other authorities."),
          blank(),

          clause("8", "It is hereby agreed by the PURCHASERS that from the date the Apartment is ready for occupation, whether possession is taken or not, he/she/they shall pay maintenance regularly every month on or before the 5th day of each month to the PROMOTERS, until formation of the Apartment Owners Association, the proportionate share decided by the PROMOTERS towards all outgoings on general expenses in respect of the Property such as insurance, municipal or other taxes/cesses, electric and water charges or deposits, maintenance and management of the building, common lighting, sanitation, repairs, salary of watchman/sweepers/lift operators and all other costs connected with the building."),
          blank(),

          clause("9", "It is hereby agreed that the Purchasers shall get the parking space allotted for parking of a light motor vehicle, and the PURCHASER/S, their tenants or licensees occupying the Apartment through them, will have the right to park light motor vehicles in the Schedule A Property."),
          blank(),

          clause("10", "The PURCHASERS shall pay such deposit, costs, share association fee, cost of stamp papers, registration fee, legal fee and such other expenses as may be required for formation of the Association and the transfer of undivided share, right, title and interest in favour of the PURCHASER, and other formalities for obtaining completion and handing over possession of the Apartment."),
          blank(),

          clause("11", "It is specifically agreed between the Vendor and the PURCHASERS that the PURCHASERS shall be entitled only to the Schedule B Property agreed to be sold to them, and shall have no interest, claim or objection whatsoever regarding use by other owners of apartments, covered or uncovered parking space specifically built, assigned, allotted, sold or disposed of otherwise. The common amenities stated in Schedule B alone shall be used as common amenities along with other owners, and the PURCHASERS shall not lay claim to amenities provided specifically to other owners."),
          blank(),

          clause("12", `Whereas all municipal taxes in respect of the Schedule B property till the date of registration shall be borne and paid by the ${hasVendorOwner ? "Vendor" : "Developer"}. Expenses and deposits, if any, such as electric service connection charges, cost of transformer, BESCOM deposit etc., other than construction, shall be paid by the Purchaser, which is included in the aforesaid sale consideration.`),
          blank(),

          clause("13", `Whereas the ${hasVendorOwner ? "Vendor" : "Developer"} covenants with and assures the Purchaser that there is no manner of private, public or revenue claim, such as property tax or valuation duties, outstanding in respect of the Schedule B property.`),
          blank(),

          clause("14", `Whereas the ${hasVendorOwner ? "Vendor" : "Developer"} further covenants with the Purchasers and assures that they have absolute marketable title to the Schedule B Property, and hereby undertake to indemnify the Purchaser/s from any defect of title, claims or liens from anyone claiming through or under them.`),
          blank(),

          clause("15", `Whereas the ${hasVendorOwner ? "Vendor" : "Developer"} has agreed to hand over vacant possession of the Schedule B property to the Purchaser/s on the date of registration of the Deed of Sale.`),
          blank(),

          // ── Schedule A ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'A' PROPERTY"),
          ...(hasVendorOwner
            ? scheduleAParagraphs.flatMap((text) => text.split("\n").map(bp))
            : [bp(`All that piece and parcel of the property situated at ${data.projectAddress}, on which the multi-storied residential building "${data.projectName}" is being constructed, together with all rights and appurtenances whatsoever hereunder or underneath or above the surface.`)]),
          blank(),

          // ── Schedule B ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'B' PROPERTY"),
          bp(scheduleBText),
          blank(),

          // ── Schedule C ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'C' — SPECIFICATIONS"),
          ...SCHEDULE_C_ITEMS.map(([label, value]) => p([t(label + ": ", { bold: true }), t(value)])),
          blank(),

          // ── Schedule D ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'D' — RESTRICTIONS ON THE RIGHT OF THE PURCHASERS"),
          bp(SCHEDULE_D_INTRO),
          ...SCHEDULE_D_ITEMS.map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Schedule E ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'E' — RIGHTS OF THE PURCHASERS"),
          ...SCHEDULE_E_ITEMS.map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Schedule F ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'F' — SHARED EXPENSES"),
          bp(SCHEDULE_F_INTRO),
          ...SCHEDULE_F_ITEMS.map((text, i) => subClause(`${i + 1}.`, text)),
          ...SCHEDULE_F_SUBITEMS.map((text) => subClause("", text)),
          bp(SCHEDULE_F_CLOSING),
          blank(),

          // ── Schedule G ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'G' — OWNER/PROMOTER COVENANTS"),
          bp(`The ${hasVendorOwner ? "OWNERS/PROMOTER" : "DEVELOPERS/PROMOTER"} hereby covenant with the PURCHASERS as follows:`),
          ...SCHEDULE_G_ITEMS.map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Witness / Execution ─────────────────────────────────────────────
          p([t("IN WITNESS WHEREOF, the parties hereto have signed this Agreement of Sale on the day, month and year first above written.")], { before: 200, after: 200 }),
          blank(),
          p([t("WITNESSES:", { bold: true })]),
          blank(),
          p([t("1.")]),
          blank(),
          ...(hasVendorOwner ? [
            p([t("VENDOR", { bold: true })], { align: AlignmentType.CENTER }),
            p([t("(represented by registered Power of Attorney Holder)")], { align: AlignmentType.CENTER }),
          ] : []),
          blank(),
          p([t("2.")]),
          blank(),
          p([t("BUILDERS/CONFIRMING PARTY", { bold: true })], { align: AlignmentType.CENTER }),
          blank(),
          p([t("PURCHASER/S", { bold: true })], { align: AlignmentType.CENTER }),
          ...allBuyers.map((b) => p([t(b.name.toUpperCase())], { align: AlignmentType.CENTER })),

        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadSaleAgreement(blob: Blob, buyerName: string, unitNumber: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sale_Agreement_${buyerName.replace(/\s+/g, "_")}_${unitNumber}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
