/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounting from "../accounting.js";
import type * as banking from "../banking.js";
import type * as bookings from "../bookings.js";
import type * as buyers from "../buyers.js";
import type * as construction from "../construction.js";
import type * as crm from "../crm.js";
import type * as documents from "../documents.js";
import type * as emailActions from "../emailActions.js";
import type * as emails from "../emails.js";
import type * as financialReports from "../financialReports.js";
import type * as gst from "../gst.js";
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as inventory from "../inventory.js";
import type * as invoiceScan from "../invoiceScan.js";
import type * as labour from "../labour.js";
import type * as leads from "../leads.js";
import type * as lib_accountCodes from "../lib/accountCodes.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_defaultAccounts from "../lib/defaultAccounts.js";
import type * as lib_gst from "../lib/gst.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_vendorMatch from "../lib/vendorMatch.js";
import type * as loans from "../loans.js";
import type * as materialRequests from "../materialRequests.js";
import type * as payments from "../payments.js";
import type * as payroll from "../payroll.js";
import type * as portal from "../portal.js";
import type * as projects from "../projects.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as reports from "../reports.js";
import type * as schema_accounting from "../schema/accounting.js";
import type * as schema_banking from "../schema/banking.js";
import type * as schema_crm from "../schema/crm.js";
import type * as schema_documents from "../schema/documents.js";
import type * as schema_gst from "../schema/gst.js";
import type * as schema_inventory from "../schema/inventory.js";
import type * as schema_labour from "../schema/labour.js";
import type * as schema_loans from "../schema/loans.js";
import type * as schema_payroll from "../schema/payroll.js";
import type * as schema_procurement from "../schema/procurement.js";
import type * as schema_realEstate from "../schema/realEstate.js";
import type * as schema_tally from "../schema/tally.js";
import type * as schema_tds from "../schema/tds.js";
import type * as schema_vendors from "../schema/vendors.js";
import type * as subcontracts from "../subcontracts.js";
import type * as tallyImport from "../tallyImport.js";
import type * as tds from "../tds.js";
import type * as team from "../team.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounting: typeof accounting;
  banking: typeof banking;
  bookings: typeof bookings;
  buyers: typeof buyers;
  construction: typeof construction;
  crm: typeof crm;
  documents: typeof documents;
  emailActions: typeof emailActions;
  emails: typeof emails;
  financialReports: typeof financialReports;
  gst: typeof gst;
  http: typeof http;
  import: typeof import_;
  inventory: typeof inventory;
  invoiceScan: typeof invoiceScan;
  labour: typeof labour;
  leads: typeof leads;
  "lib/accountCodes": typeof lib_accountCodes;
  "lib/auth": typeof lib_auth;
  "lib/defaultAccounts": typeof lib_defaultAccounts;
  "lib/gst": typeof lib_gst;
  "lib/rbac": typeof lib_rbac;
  "lib/validators": typeof lib_validators;
  "lib/vendorMatch": typeof lib_vendorMatch;
  loans: typeof loans;
  materialRequests: typeof materialRequests;
  payments: typeof payments;
  payroll: typeof payroll;
  portal: typeof portal;
  projects: typeof projects;
  purchaseOrders: typeof purchaseOrders;
  reports: typeof reports;
  "schema/accounting": typeof schema_accounting;
  "schema/banking": typeof schema_banking;
  "schema/crm": typeof schema_crm;
  "schema/documents": typeof schema_documents;
  "schema/gst": typeof schema_gst;
  "schema/inventory": typeof schema_inventory;
  "schema/labour": typeof schema_labour;
  "schema/loans": typeof schema_loans;
  "schema/payroll": typeof schema_payroll;
  "schema/procurement": typeof schema_procurement;
  "schema/realEstate": typeof schema_realEstate;
  "schema/tally": typeof schema_tally;
  "schema/tds": typeof schema_tds;
  "schema/vendors": typeof schema_vendors;
  subcontracts: typeof subcontracts;
  tallyImport: typeof tallyImport;
  tds: typeof tds;
  team: typeof team;
  units: typeof units;
  users: typeof users;
  vendors: typeof vendors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
