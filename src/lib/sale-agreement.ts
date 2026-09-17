/**
 * Generates a Sale Agreement Word document (.docx) matching the Mighty Homes
 * legal template (Sale Agreement G01.docx format).
 *
 * Structure:
 *   - Title & opening recital
 *   - WHEREAS clauses (land history, RERA, JDA)
 *   - Numbered agreement clauses (1–15)
 *   - Schedule A – Land property
 *   - Schedule B – Apartment / flat
 *   - Schedule C – Specifications
 *   - Schedule D – Restrictions on Purchaser
 *   - Schedule E – Rights of Purchaser
 *   - Schedule F – Shared expenses
 *   - Schedule G – Owner/Promoter covenants
 *   - Signature block (Vendor via PoA + Builder + Purchaser/s)
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  convertInchesToTwip,
  UnderlineType,
} from "docx";

// ─── Public data shape ────────────────────────────────────────────────────────

export type SaleAgreementData = {
  // Developer / project
  developerName: string;           // e.g. "M/s. MIGHTY HOMES"
  developerAddress?: string;       // e.g. "Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067"
  developerPartner?: string;       // e.g. "Mr. SRINIVAS.P, aged about 51 years, S/o. Sri.Ranga Rao"
  projectName: string;             // e.g. "MIGHTY YUVA"
  projectAddress: string;
  reraNumber?: string;

  // Primary buyer
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerPan?: string;
  buyerAadhar?: string;
  buyerAddress?: string;
  buyerAge?: number;
  buyerFatherName?: string;

  // Co-buyers / joint purchasers
  coBuyers?: {
    name: string;
    pan?: string;
    phone?: string;
    aadhar?: string;
    age?: number;
    fatherName?: string;
    address?: string;
  }[];

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

  // Payment installments (optional)
  installments?: { milestone: string; amount: number; dueDate?: string }[];

  // Possession date
  possessionDate?: string;  // e.g. "March 2027"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inr(n: number): string {
  return "Rs." + n.toLocaleString("en-IN") + "/-";
}

function numToWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "") + " ";
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred " + convert(num % 100);
    if (num < 100000) return convert(Math.floor(num / 1000)) + "Thousand " + convert(num % 1000);
    if (num < 10000000) return convert(Math.floor(num / 100000)) + "Lakh " + convert(num % 100000);
    return convert(Math.floor(num / 10000000)) + "Crore " + convert(num % 10000000);
  }

  const result = convert(Math.abs(Math.round(n))).trim();
  return result ? "Rupees " + result + " Only" : "Zero Only";
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

// ─── Style helpers ────────────────────────────────────────────────────────────

const FONT = "Times New Roman";
const SIZE = 22; // 11pt in half-points

const noBorder = { style: BorderStyle.NIL };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "999999" };

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

function centeredHeading(text: string): Paragraph {
  return new Paragraph({
    children: [t(text, { bold: true, underline: true, size: 26 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
  });
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

function scheduleItem(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        children: [new Paragraph({ children: [t(label, { bold: true })], spacing: { before: 60, after: 60 } })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        children: [new Paragraph({ children: [t(value)], spacing: { before: 60, after: 60 } })],
      }),
    ],
  });
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateSaleAgreement(data: SaleAgreementData): Promise<Blob> {
  const developerName = data.developerName || "M/s. MIGHTY HOMES";
  const developerAddress = data.developerAddress || "Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067";
  const developerPartner = data.developerPartner || "Mr. SRINIVAS.P, Managing Partner";
  const possessionDate = data.possessionDate || "as per agreed timeline";

  const allBuyers = [
    {
      name: data.buyerName,
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

  // ── Payment table ────────────────────────────────────────────────────────────
  const paymentRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Description", { bold: true })], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Amount", { bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Amount in Words", { bold: true })], spacing: { before: 60, after: 60 } })] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Basic Sale Price")], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(inr(data.agreementValue))], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(numToWords(data.agreementValue))], spacing: { before: 60, after: 60 } })] }),
      ],
    }),
    ...(data.gstAmount ? [new TableRow({
      children: [
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(`GST @ ${data.gstPercent ?? ""}%`)], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(inr(data.gstAmount))], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(numToWords(data.gstAmount))], spacing: { before: 60, after: 60 } })] }),
      ],
    })] : []),
    ...(data.carParkingCharges ? [new TableRow({
      children: [
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Car Parking Charges (included)")], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Included")], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("—")], spacing: { before: 60, after: 60 } })] }),
      ],
    })] : []),
    new TableRow({
      children: [
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("TOTAL SALE CONSIDERATION", { bold: true })], spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(inr(totalConsideration), { bold: true })], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
        new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(numToWords(totalConsideration), { bold: true })], spacing: { before: 60, after: 60 } })] }),
      ],
    }),
  ];

  const paymentTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: paymentRows });

  // ── Payment schedule ──────────────────────────────────────────────────────────
  const schedulePaymentSection: (Paragraph | Table)[] = [];
  if (data.installments && data.installments.length > 0) {
    schedulePaymentSection.push(sectionHeading("PAYMENT SCHEDULE"));
    const instRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Milestone", { bold: true })], spacing: { before: 60, after: 60 } })] }),
          new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Amount (INR)", { bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })] }),
          new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t("Due Date", { bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })] }),
        ],
      }),
    ];
    for (const inst of data.installments) {
      instRows.push(new TableRow({
        children: [
          new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(inst.milestone)], spacing: { before: 60, after: 60 } })] }),
          new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(inr(inst.amount))], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })] }),
          new TableCell({ borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, children: [new Paragraph({ children: [t(inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-IN") : "—")], spacing: { before: 60, after: 60 } })] }),
        ],
      }));
    }
    schedulePaymentSection.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: instRows }));
  }

  // ── Build purchaser listing paragraph ────────────────────────────────────────
  const purchaserLines: (Paragraph)[] = [];
  allBuyers.forEach((buyer, idx) => {
    purchaserLines.push(p([t(`${idx + 1}). ${buyer.name.toUpperCase()}`, { bold: true })]));
    if (buyer.pan) purchaserLines.push(p([t(`\tPAN\t: ${buyer.pan}`)]));
    if (buyer.aadhar) purchaserLines.push(p([t(`\tAadhar No:\t${buyer.aadhar}`)]));
    if (buyer.address) purchaserLines.push(p([t(`\tR/at ${buyer.address}`)]));
  });

  // ─── Document assembly ────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          run: { font: FONT, size: 28, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          run: { font: FONT, size: 24, bold: true },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
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
            t(data.projectAddress.split(",").pop()?.trim() ?? data.projectAddress, { bold: true }),
            t(" BETWEEN:"),
          ], { before: 160, after: 160 }),

          blank(),

          // ── Developer / Vendor block ─────────────────────────────────────────
          p([t(developerName + ",", { bold: true })]),
          p([t("a Partnership firm having its office at")]),
          p([t(developerAddress + ".")]),
          p([t("Represented by its Managing Partner")]),
          blank(),
          p([t(developerPartner + ",", { bold: true })]),
          blank(),
          p([t("hereinafter called the ", { bold: false }), t("DEVELOPERS/BUILDERS/CONFIRMING PARTY", { bold: true, underline: true })]),
          blank(),
          p([t("AND", { bold: true })], { align: AlignmentType.CENTER }),
          blank(),

          // ── Purchaser block ─────────────────────────────────────────────────
          ...purchaserLines,
          blank(),
          p([t("hereinafter referred to as the ", { bold: false }), t("PURCHASER/S", { bold: true, underline: true })]),
          blank(),
          p([
            t('The expressions "DEVELOPER", "PURCHASER/S" and "DEVELOPERS/BUILDERS/CONFIRMING PARTY" wherever they appear in this context shall mean and include their respective heirs, executors, administrators, legal representatives and assigns.'),
          ]),
          blank(),

          // ── WHEREAS clauses ─────────────────────────────────────────────────
          p([
            t("AND WHEREAS, the Developer/Promoter has obtained a plan sanction and has commenced the construction of a multi-storied residential building over the Schedule 'A' Property."),
          ]),
          blank(),
          ...(data.reraNumber ? [
            p([
              t("AND WHEREAS, the Developer/Promoter has also registered the project with the Real Estate (Regulation and Development) Act, 2016, Karnataka Real Estate (Regulation and Development) Rules – 2017 vide registered Number: "),
              t(data.reraNumber, { bold: true }),
              t(", for the multi-storied residential building complex known as "),
              t(`"${data.projectName}"`, { bold: true }),
              t(" over the Schedule 'A' Property."),
            ]),
            blank(),
          ] : []),
          p([
            t("AND WHEREAS, the Developer has agreed to sell Schedule B Property and the Purchaser/s has/have agreed to purchase the said property for a sale consideration of "),
            t(inr(totalConsideration), { bold: true }),
            t(` (${numToWords(totalConsideration)}) `),
            t("including car parking space, KEB, taxes etc., excluding registration and stamp duty fees and free from encumbrances."),
          ]),
          blank(),
          p([t("NOW THIS AGREEMENT OF SALE WITNESSETH AS FOLLOWS:")], { align: AlignmentType.CENTER, before: 160, after: 160 }),

          // ── Numbered clauses ─────────────────────────────────────────────────
          clause("1", `That in pursuance of this agreement, the Developer/Builder has agreed to sell and the Purchasers have agreed to purchase the Schedule B property for a sale consideration of ${inr(totalConsideration)} (${numToWords(totalConsideration)}) and has agreed to pay the said sale consideration as per the payment schedule agreed between the parties.`),
          blank(),

          ...(data.bookingAmount ? [
            clause("2", `The PURCHASER/S has/have paid a sum of ${inr(data.bookingAmount)} (${numToWords(data.bookingAmount)}) as advance sale consideration, the receipt of which the Developer/Builder hereby acknowledges before the undersigned witnesses. On the payment of the aforesaid amounts in full by the PURCHASER/S, the latter shall execute a Deed of Absolute Sale of conveyance to the PURCHASER/S duly conveying the aforesaid fraction of undivided share, right, title and interest in the Schedule A Property along with the flat in question. Time shall be the essence of this Agreement.`),
            blank(),
          ] : []),

          clause("3", "The Developer/Builder hereby covenants and assures the PURCHASER/S that the Developer is the absolute Owner of the Schedule B Property and the same is free from all kinds of encumbrances, charges and mortgages whatsoever and the same is not the subject matter of any attachment or other legal proceedings before any Court of Law, Taxation or other statutory authorities and the Developer is in actual possession and enjoyment of the project, wherein the construction of flat is going on, and is competent to enter into this agreement and to effect sale of the Schedule B Property as per the terms of this agreement."),
          blank(),

          clause("4", "All the expenses relating to the Stamp Duty, registration and other incidental expenses shall be borne by the Purchaser only."),
          blank(),

          clause("4a", `The Developer/Builder shall under normal conditions complete the construction of the building and agree to hand over possession of the Schedule B property on or before ${possessionDate} from this agreement date, grace period of 1 month, however subject to availability of cement, steel and other essential items of construction and also subject to unforeseen events such as Acts of God, Earthquake, Floods, War or other local disturbances, changes in laws of the state, corporation or any other clauses beyond the control of the Developer/Builder.`),
          blank(),

          clause("5", "The Purchaser shall not use the flat or permit the same to be used for any purpose whatsoever other than as a private dwelling house or for any purpose which may or is likely in the opinion of the DEVELOPER/PROMOTER and/or managing committee of the Association would cause nuisance or annoyance to occupiers of the other flats/garages in the said building or to the owners or occupiers of the neighbouring properties and shall not use the garage for any other purpose except for keeping a motor car."),
          blank(),

          clause("6", `It is hereby agreed that the name of the multi-storied building to be constructed on Schedule 'A' Property shall be named as "${data.projectName}" and the Purchasers shall not seek for the change of name at any point of time.`),
          blank(),

          clause("7", "It is hereby further agreed that the PURCHASERS shall become the member of the Apartment Owners Association to be constituted in accordance with the provisions of Karnataka Apartments Ownership Act 1972 and rules framed thereupon, after the Purchaser becomes the Owner of the flat in question."),
          blank(),

          clause("8", "It is hereby agreed by the PURCHASERS that from the date the Apartment is ready for occupation for which a notice has been received by him/her/them from the Promoter whether possession is taken by him/them or not, he/she/they shall pay maintenance regularly every month on or before the 5th day of each month to the PROMOTERS until the formation of the Apartment Owners Association the proportionate share that may be decided by the PROMOTERS in all the outgoings on general expenses in respect of the Property such as insurance, municipal taxes, maintenance and management of the building, common light, sanitation, repairs and all other costs and expenses connected with the building."),
          blank(),

          clause("9", "It is hereby agreed that the Purchasers shall get the parking space allotted for parking of a light motor vehicle, which the PURCHASER/S, their tenants, licensees of those who occupy the Apartment through them will have right to park light motor vehicles."),
          blank(),

          clause("10", "The PURCHASERS shall pay such deposit, costs, share association fee, cost of stamp papers, registration fee, legal fee and such other expenses as may be required for the formation of Association and the transfer of undivided share, right, title and interest in favour of the PURCHASER."),
          blank(),

          clause("11", "It is specifically agreed between the Developer and the PURCHASERS that the PURCHASERS shall be entitled only to the Schedule B Property agreed to be sold to them mentioned in Schedule B and in no way shall have interest or claims for use by the other owners of the apartments, covered or uncovered parking space that has been specifically built, assigned, allotted, sold or disposed off otherwise."),
          blank(),

          clause("12", "Whereas all municipal taxes in respect of the Schedule B property till the date of registration of the Schedule B Property, shall be borne and paid by the Developer. The expenses and deposits if any like electric services, connection charges, cost of transformer, BESCOM deposit etc., other than construction have to be paid by the Purchaser, which is included in the aforesaid sale consideration."),
          blank(),

          clause("13", "Whereas the Developer covenants with and assures the Purchaser that there is no manner of private or public or revenue claims, like property tax, valuation duties, etc., outstanding hitherto in respect of the Schedule B property."),
          blank(),

          clause("14", "Whereas the Developer further covenants with the Purchasers and assures that they have absolute marketable title to the Schedule B Property and hereby undertake to indemnify the Purchaser/s from any defect of title, claims or liens from any one claiming through or under them."),
          blank(),

          clause("15", "Whereas the Developer has agreed to hand over the vacant possession of the Schedule B property to the Purchaser/s on the date of registration of the Deed of Sale."),
          blank(),

          // ── Schedule A ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'A' PROPERTY"),
          p([t(`All that piece and parcel of the property situated at ${data.projectAddress}, on which the multi-storied residential building "${data.projectName}" is being constructed, together with all rights, appurtenances whatsoever hereunder or underneath or above the surface.`)]),
          blank(),

          // ── Schedule B ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'B' PROPERTY"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              scheduleItem("Apartment No.", data.unitNumber + (data.block ? ` (Block: ${data.block})` : "")),
              scheduleItem("Floor", data.floor !== undefined ? `${data.floor}` : "—"),
              ...(data.configuration ? [scheduleItem("Configuration", data.configuration)] : []),
              scheduleItem("Super Built-Up Area", `${data.superBuiltUpAreaSqft.toLocaleString("en-IN")} Sq.ft${data.superBuiltUpAreaSqm ? ` or ${data.superBuiltUpAreaSqm} Sq.Mtrs` : ""}`),
              ...(data.carpetAreaSqft ? [scheduleItem("Carpet Area", `${data.carpetAreaSqft.toLocaleString("en-IN")} Sq.ft${data.carpetAreaSqm ? ` or ${data.carpetAreaSqm} Sq.Mtrs` : ""}`)] : []),
              ...(data.balconyAreaSqft ? [scheduleItem("Balcony & Utility Area", `${data.balconyAreaSqft.toLocaleString("en-IN")} Sq.ft${data.balconyAreaSqm ? ` or ${data.balconyAreaSqm} Sq.Mtrs` : ""}`)] : []),
              ...(data.udsSqft ? [scheduleItem("Undivided Share of Land", `${data.udsSqft.toLocaleString("en-IN")} Sq.ft${data.udsSqm ? ` or ${data.udsSqm} Sq.Mtrs` : ""}`)] : []),
              ...(data.facing ? [scheduleItem("Facing", data.facing)] : []),
              scheduleItem("Project / Building Name", data.projectName),
              ...(data.reraNumber ? [scheduleItem("RERA No.", data.reraNumber)] : []),
              scheduleItem("Rate per Sq.ft", `Rs.${data.ratePerSqft.toLocaleString("en-IN")}/-`),
              scheduleItem("Total Sale Consideration", `${inr(totalConsideration)} (${numToWords(totalConsideration)})`),
            ],
          }),
          blank(),

          // ── Consideration Table ──────────────────────────────────────────────
          sectionHeading("CONSIDERATION & PAYMENT DETAILS"),
          paymentTable,
          blank(),

          // ── Payment Schedule (if any) ────────────────────────────────────────
          ...schedulePaymentSection,

          // ── Schedule C ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'C' — SPECIFICATIONS"),
          ...[
            ["1. Structure", "RCC Framed structure"],
            ["2. Walls", "6\" Solid external walls with 4\" Solid Blocks for internal walls"],
            ["3. Plastering", "Internal walls with lime rendering and external walls with sponge finish"],
            ["4. Doors", "Teak wood/Honne wooden door frames for all rooms, main door frame with teak wood shutter and other doors with waterproof flush shutters"],
            ["5. Windows", "UPVC Sliding windows, MS Grills and mosquito mesh for bedroom windows"],
            ["6. Electrical Work", "Concealed 1 phase copper wiring with all necessary points (TV, Telephone, Geyser, AC etc.) with Anchor or equivalent switches & sockets"],
            ["7. Flooring", "Combination of Vitrified/Semi Vitrified/Ceramic tiles for living, bedroom, dining; Ceramic tiles for remaining areas"],
            ["8. Common Areas", "Anti-skid tiles for staircase and lobbies"],
            ["9. Toilets", "Glazed tiles up to door level, all standard CP fittings, WC with wash basins"],
            ["10. Paints", "Internal walls with Birla wall care putty finish with OBD paint, external in waterproof paint; enamel paint for doors, windows and grills; natural polish for main doors"],
            ["11. Lift", "Kone elevators / Equivalent"],
            ["12. Generator", "Generator backup for lifts, common area lighting and 1 KVA for each flat"],
            ["13. Amenities", "Gym with treadmills, cycles, weight lifts and other basic needs; Swimming Pool and Children's Play Area"],
          ].map(([label, value]) => p([t(label + ": ", { bold: true }), t(value)])),
          blank(),

          // ── Schedule D ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'D' — RESTRICTIONS ON THE RIGHT OF THE PURCHASERS"),
          p([t("The Purchasers agree to be bound by the following terms and conditions:")]),
          ...[
            "Not to raise any construction in addition to that mentioned in Schedule 'B' above.",
            "Not to use or permit the use of the construction referred to in Schedule 'B' above in any manner which would diminish the value or utility of the property.",
            "Not to use the common space for parking heavy vehicles or in any manner which might cause hindrance for free ingress to or from any other part of the construction.",
            "Not to default in the payment of any taxes or levies to be shared by the other Apartment Owners from the date the apartment is ready for occupation.",
            "Not to decorate the exterior of the property other than in the manner agreed to by at least two-third majority of owners of constructions.",
            "Not to make any arrangement for maintaining the building other than that agreed to by two-third majority of all apartment owners.",
            "The covered or uncovered parking lot for the respective owner/s will be used by them for parking their four wheelers or two wheelers.",
            "The PURCHASERS shall have no objection whatsoever for construction of covered/open car parking space for other Purchaser/s.",
          ].map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Schedule E ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'E' — RIGHTS OF THE PURCHASERS"),
          ...[
            "Full rights and liberty for the PURCHASERS in common with all other persons entitled to use at all times the open spaces, lobbies, parking spaces, terraces, staircases and passages inside and outside the building.",
            "Full right and liberty to the PURCHASERS to go and pass over the land appurtenant to the building constructed in Schedule A above.",
            "The right to subjacent and lateral support, shelter and protection from the other parts of the aforesaid building.",
            "The free and uninterrupted passage of running water, soil, gas and electricity through sewers, drains, cables, pipes and wires in the building.",
            "Right of passage at all reasonable times to where the water tanks are situated for the purposes of cleaning or repairing or maintaining the same.",
            "Right of passage to the other parts of the building for the purpose of repairing, cleaning, maintaining or renewing any sewers, drains, cables, pipes and wires.",
            "To lay cables or wires through common walls or passages for telephone installations, respecting the equal rights of others.",
            "The right to mortgage/transfer the Property to any individual Bank or financial institution for raising funds under the Karnataka Apartments Ownership Act.",
            "Right to deal or any of the acts aforesaid without notice in the case of emergency.",
            "Any dispute regarding any right of use of space or common premises shall be settled by the Association to be formed.",
          ].map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Schedule F ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'F' — SHARED EXPENSES"),
          p([t("The PURCHASERS in proportion of their share, shall be deemed to have accepted the following conditions and to have contracted to bear the following expenses after registration of absolute sale deed:")]),
          ...[
            "All the rates and outgoings payable in respect of the land and building thereon.",
            "The expenses of routine maintenance including painting, whitewashing, cleaning etc., and provision of common services.",
            "Maintenance of pump sets and other machinery, sanitary and electrical lines common to the building.",
            "Payment of electrical and water charges for common services.",
            "Replacement of bulbs in corridors.",
            "Maintenance of garden and potted plants in the building.",
            "Provision of night watchman and other security.",
          ].map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Schedule G ──────────────────────────────────────────────────────
          sectionHeading("SCHEDULE 'G' — OWNER/PROMOTER COVENANTS"),
          p([t("The DEVELOPERS/PROMOTER hereby covenant with the PURCHASERS as follows:")]),
          ...[
            "The DEVELOPERS/PROMOTER will require every person for whom they shall hereafter construct any unit in the said building to covenant and observe the restrictions set forth above.",
            "The DEVELOPERS/PROMOTER and their assignees shall always respect the rights of the PURCHASERS mentioned in this agreement.",
            "The DEVELOPERS/PROMOTER shall give inspection of all the title deeds relating to the property at the request of the PURCHASERS at all reasonable times and hand over the same to the Apartment Owners Association on its formation.",
            "The DEVELOPERS/PROMOTER shall provide required papers/documents (certified copy) at the request of the Purchasers for raising funds from any Banks or financial institutions.",
            "PROVIDED further the DEVELOPERS/PROMOTER shall not be liable to set right any structural defects discovered after one year from the date of announcing the possession of the apartment.",
            "PROVIDED always the DEVELOPERS/PROMOTER shall not be liable for charges for common amenities and charges for meter rent, electricity and water from the date of communication to the PURCHASERS of the readiness to hand over possession of the Schedule 'B' property.",
            "Any delay or indulgence by the DEVELOPERS/PROMOTER in enforcing the terms of this Agreement or any forbearance or giving of time to the Purchaser/s shall not be construed as a waiver of any breach or non-compliance of any of the terms and conditions of this Agreement.",
          ].map((text, i) => subClause(`${i + 1}.`, text)),
          blank(),

          // ── Witness / Execution ─────────────────────────────────────────────
          p([t("IN WITNESS WHEREOF, the parties hereto have signed this Agreement of Sale on the day, month and year first above written.")], { before: 200, after: 200 }),
          blank(),

          // Signature table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                    children: [
                      new Paragraph({ children: [t("WITNESSES:", { bold: true })], spacing: { before: 200 } }),
                      blank(),
                      new Paragraph({ children: [t("1.")], spacing: { before: 400, after: 80 } }),
                      new Paragraph({ children: [t("Name: ____________________")], spacing: { after: 60 } }),
                      new Paragraph({ children: [t("Address: _________________")], spacing: { after: 60 } }),
                      blank(),
                      new Paragraph({ children: [t("2.")], spacing: { before: 200, after: 80 } }),
                      new Paragraph({ children: [t("Name: ____________________")], spacing: { after: 60 } }),
                      new Paragraph({ children: [t("Address: _________________")], spacing: { after: 60 } }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                    children: [
                      new Paragraph({ children: [t("DEVELOPER/BUILDER", { bold: true, underline: true })], alignment: AlignmentType.CENTER, spacing: { before: 200 } }),
                      new Paragraph({ children: [t(developerName)], alignment: AlignmentType.CENTER, spacing: { before: 80 } }),
                      new Paragraph({ children: [t(developerPartner)], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } }),
                      new Paragraph({ children: [t("")], spacing: { before: 500, after: 60 } }),
                      new Paragraph({ children: [t("Authorised Signatory")], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [t("Signature: __________________________")], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [t("Date: ______________________________")], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                    children: [
                      new Paragraph({ children: [t("PURCHASER/S", { bold: true, underline: true })], alignment: AlignmentType.CENTER, spacing: { before: 200 } }),
                      ...allBuyers.map((b) =>
                        new Paragraph({ children: [t(b.name.toUpperCase())], alignment: AlignmentType.CENTER, spacing: { before: 60 } })
                      ),
                      new Paragraph({ children: [t("")], spacing: { before: 500, after: 60 } }),
                      new Paragraph({ children: [t("Signature: __________________________")], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [t("Date: ______________________________")], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
                    ],
                  }),
                ],
              }),
            ],
          }),

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
