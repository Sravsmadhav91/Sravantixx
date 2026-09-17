import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Copy, Download, KeyRound, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

/** Derives the Convex HTTP Actions base URL (*.convex.site) from the deployment's *.convex.cloud URL. */
function getHttpActionsUrl(): string {
  const convexUrl: string = import.meta.env.VITE_CONVEX_URL ?? "";
  return convexUrl.replace(".convex.cloud", ".convex.site");
}

function buildBridgeScript(uploadUrl: string, token: string): string {
  return `#!/usr/bin/env node
/**
 * TallyPrime local bridge script.
 *
 * Run this on the SAME computer as TallyPrime. It talks to Tally over
 * localhost (no port forwarding needed) and pushes ledgers + vouchers to
 * your ERP over a normal outbound internet connection.
 *
 * Requirements in TallyPrime:
 *   F1 (Help) -> Settings -> Connectivity -> Client/Server Configuration
 *   -> "TallyPrime acts as" = Both / Server, Enable ODBC, note the Port (default 9000).
 *
 * Usage:
 *   node tally-bridge.js                          (imports ledgers only)
 *   node tally-bridge.js --vouchers                (also imports last 365 days of vouchers)
 *   node tally-bridge.js --vouchers --from=2024-04-01 --to=2025-03-31
 *
 * Requires Node.js 18+ (for built-in fetch). No npm install needed.
 */

const UPLOAD_URL = ${JSON.stringify(uploadUrl)};
const BRIDGE_TOKEN = ${JSON.stringify(token)};
const TALLY_URL = "http://localhost:9000";

const args = process.argv.slice(2);
const includeVouchers = args.includes("--vouchers");
const fromArg = args.find((a) => a.startsWith("--from="));
const toArg = args.find((a) => a.startsWith("--to="));
const toDate = toArg ? toArg.split("=")[1] : new Date().toISOString().slice(0, 10);
const fromDate = fromArg
  ? fromArg.split("=")[1]
  : new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

function toTallyDate(iso) {
  return iso.replace(/-/g, "");
}

const LIST_COMPANIES_XML = \`<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>List of Companies</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="List of Companies" ISMODIFY="No" ISINITIALIZE="Yes">
      <TYPE>Company</TYPE>
      <NATIVEMETHOD>NAME</NATIVEMETHOD>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>\`;

function ledgerXml(companyName) {
  return \`<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY><EXPORTDATA><REQUESTDESC>
  <REPORTNAME>Collection of Objects</REPORTNAME>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVCURRENTCOMPANY>\${escapeXmlText(companyName)}</SVCURRENTCOMPANY>
  </STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="LedgerCollection" ISMODIFY="No">
    <TYPE>Ledger</TYPE>
    <FETCH>NAME,PARENT,OPENINGBALANCE,GSTIN,INCOMETAXNUMBER,LEDGERPHONE,EMAIL</FETCH>
   </COLLECTION>
  </TDLMESSAGE></TDL>
 </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>\`;
}

function voucherXml(from, to, companyName) {
  return \`<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY><EXPORTDATA><REQUESTDESC>
  <REPORTNAME>Collection of Objects</REPORTNAME>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVFROMDATE>\${toTallyDate(from)}</SVFROMDATE>
   <SVTODATE>\${toTallyDate(to)}</SVTODATE>
   <SVCURRENTCOMPANY>\${escapeXmlText(companyName)}</SVCURRENTCOMPANY>
  </STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="VoucherCollection" ISMODIFY="No">
    <TYPE>Voucher</TYPE>
    <FETCH>DATE,VOUCHERTYPENAME,VOUCHERNUMBER,PARTYLEDGERNAME,NARRATION,ALLLEDGERENTRIES.LIST</FETCH>
   </COLLECTION>
  </TDLMESSAGE></TDL>
 </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>\`;
}

function escapeXmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function tallyRequest(xml) {
  const res = await fetch(TALLY_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xml,
  });
  if (!res.ok) throw new Error(\`Tally responded with HTTP \${res.status}\`);
  return await res.text();
}

// Minimal XML -> JS walker, just enough to pull out repeated tags with text children.
function findTags(xmlText, tagName) {
  const results = [];
  const re = new RegExp(\`<\${tagName}(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)</\${tagName}>\`, "g");
  let match;
  while ((match = re.exec(xmlText)) !== null) results.push(match[1]);
  return results;
}

function textTag(block, tagName) {
  const re = new RegExp(\`<\${tagName}(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)</\${tagName}>\`);
  const match = re.exec(block);
  if (!match) return "";
  return match[1]
    .replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

// Reads a tag's own attribute, e.g. attrTag(xml, "COMPANY", "NAME") for <COMPANY NAME="...">.
function attrTag(block, tagName, attrName) {
  const re = new RegExp(\`<\${tagName}\\\\s[^>]*\\\\b\${attrName}="([^"]*)"\`);
  const match = re.exec(block);
  if (!match) return "";
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function parseLedgers(xmlText) {
  return findTags(xmlText, "LEDGER").map((block) => ({
    name: textTag(block, "NAME") || textTag(block, "OLDNAME"),
    parent: textTag(block, "PARENT"),
    openingBalance: parseFloat((textTag(block, "OPENINGBALANCE") || "0").replace(/[^0-9.-]/g, "")) || 0,
    gstin: textTag(block, "GSTIN") || undefined,
    pan: textTag(block, "INCOMETAXNUMBER") || undefined,
    phone: textTag(block, "LEDGERPHONE") || undefined,
    email: textTag(block, "EMAIL") || undefined,
  })).filter((l) => l.name);
}

function fromTallyDate(d) {
  if (!d || d.length !== 8) return new Date().toISOString().slice(0, 10);
  return \`\${d.slice(0, 4)}-\${d.slice(4, 6)}-\${d.slice(6, 8)}\`;
}

function parseVouchers(xmlText) {
  return findTags(xmlText, "VOUCHER").map((block) => {
    const entries = findTags(block, "ALLLEDGERENTRIES.LIST").map((e) => ({
      ledgerName: textTag(e, "LEDGERNAME"),
      amount: parseFloat((textTag(e, "AMOUNT") || "0").replace(/[^0-9.-]/g, "")) || 0,
    })).filter((e) => e.ledgerName);
    return {
      date: fromTallyDate(textTag(block, "DATE")),
      voucherType: textTag(block, "VOUCHERTYPENAME"),
      voucherNumber: textTag(block, "VOUCHERNUMBER"),
      partyLedgerName: textTag(block, "PARTYLEDGERNAME"),
      narration: textTag(block, "NARRATION"),
      entries,
    };
  }).filter((v) => v.date && v.entries.length > 0);
}

function parseCompanyName(xmlText) {
  return textTag(xmlText, "COMPANY") || attrTag(xmlText, "COMPANY", "NAME");
}

async function main() {
  console.log("Connecting to TallyPrime at " + TALLY_URL + " ...");
  const companiesXmlText = await tallyRequest(LIST_COMPANIES_XML);
  const companyName = parseCompanyName(companiesXmlText);
  if (!companyName) {
    console.error("Could not detect an open company in TallyPrime. Make sure a company is open, then try again.");
    process.exit(1);
  }
  console.log(\`Using company: \${companyName}\`);

  const ledgerXmlText = await tallyRequest(ledgerXml(companyName));
  const ledgers = parseLedgers(ledgerXmlText);
  console.log(\`Found \${ledgers.length} ledgers.\`);

  let vouchers = [];
  if (includeVouchers) {
    console.log(\`Fetching vouchers from \${fromDate} to \${toDate} ...\`);
    const voucherXmlText = await tallyRequest(voucherXml(fromDate, toDate, companyName));
    vouchers = parseVouchers(voucherXmlText);
    console.log(\`Found \${vouchers.length} vouchers.\`);
  }

  if (ledgers.length === 0 && vouchers.length === 0) {
    console.error(
      "Nothing was found. Double check: TallyPrime is open with the correct company loaded, " +
      "the gateway is enabled (F1 > Settings > Connectivity > Client/Server Configuration), and try again.",
    );
    process.exit(1);
  }

  console.log("Uploading to your ERP ...");
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tally-Bridge-Token": BRIDGE_TOKEN,
    },
    body: JSON.stringify({ ledgers, vouchers }),
  });
  const result = await res.json();
  if (!res.ok) {
    console.error("Upload failed:", result.error || res.statusText);
    process.exit(1);
  }
  console.log("Done!");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Bridge failed:", err.message || err);
  process.exit(1);
});
`;
}

export default function TallyBridgePanel() {
  const settings = useQuery(api.tallyImport.getSettings, {});
  const generateBridgeToken = useMutation(api.tallyImport.generateBridgeToken);
  const revokeBridgeToken = useMutation(api.tallyImport.revokeBridgeToken);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [fromDate, setFromDate] = useState(() =>
    new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [includeVouchers, setIncludeVouchers] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const uploadUrl = `${getHttpActionsUrl()}/tally-bridge/upload`;
  const hasToken = !!settings?.bridgeToken || !!generatedToken;
  const command = includeVouchers
    ? `node tally-bridge.js --vouchers --from=${fromDate} --to=${toDate}`
    : "node tally-bridge.js";

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = await generateBridgeToken({});
      setGeneratedToken(token);
      toast.success("Bridge token generated — download the script below");
    } catch {
      toast.error("Could not generate a bridge token");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    await revokeBridgeToken({});
    setGeneratedToken(null);
    toast.success("Bridge token revoked. Old copies of the script can no longer upload.");
  };

  const handleDownload = () => {
    if (!generatedToken) {
      toast.error("Generate a new token first — the script embeds it and it's only shown once");
      return;
    }
    const script = buildBridgeScript(uploadUrl, generatedToken);
    const blob = new Blob([script], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tally-bridge.js";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCommand = () => {
    void navigator.clipboard.writeText(command);
    toast.success("Command copied");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
        <ShieldCheck className="size-4 shrink-0 mt-0.5 text-primary" />
        <span>
          Recommended: this runs a small script on the same computer as TallyPrime. It talks to
          Tally on <code className="font-mono">localhost</code> (always works, no router setup)
          and pushes data to your ERP over a normal outbound connection. No port forwarding,
          public IP, or DDNS needed.
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4" /> 1. Get the Bridge Script
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>
              In TallyPrime: F1 (Help) → Settings → Connectivity → Client/Server Configuration →
              set &quot;TallyPrime acts as&quot; to Both/Server, Enable ODBC. Leave the port at
              9000 (default).
            </li>
            <li>Generate a bridge token below, then download the script.</li>
            <li>
              Copy <code className="font-mono">tally-bridge.js</code> to the computer running
              Tally. You&apos;ll need{" "}
              <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="underline">
                Node.js
              </a>{" "}
              installed there (free, one-time install).
            </li>
          </ol>

          <div className="flex items-center gap-2">
            <Button onClick={() => void handleGenerate()} disabled={generating}>
              <RefreshCw className={generating ? "size-4 animate-spin" : "size-4"} />
              {hasToken ? "Regenerate Token" : "Generate Token"}
            </Button>
            <Button onClick={handleDownload} disabled={!generatedToken}>
              <Download className="size-4" /> Download tally-bridge.js
            </Button>
            {hasToken && (
              <Button variant="destructive" onClick={() => void handleRevoke()}>
                Revoke
              </Button>
            )}
          </div>
          {generatedToken && (
            <p className="text-xs text-muted-foreground">
              The token is embedded in the downloaded file — it won&apos;t be shown again. Keep
              the file private; anyone with it can push data into your ERP.
            </p>
          )}
          {!generatedToken && settings?.bridgeToken && (
            <Badge variant="secondary">
              A bridge token already exists. Regenerate to download a fresh script.
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TerminalSquare className="size-4" /> 2. Run It
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeVouchers}
                onChange={(e) => setIncludeVouchers(e.target.checked)}
                className="size-4 accent-primary"
              />
              Also import vouchers
            </label>
          </div>
          {includeVouchers && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="bridge-from" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="bridge-from"
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bridge-to" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="bridge-to"
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={today}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Open a terminal / command prompt on the Tally computer, in the folder where you saved
            the file, and run:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono overflow-x-auto">
              {command}
            </code>
            <Button size="icon" variant="secondary" onClick={handleCopyCommand}>
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Purchase vouchers become draft Purchase Invoices; everything else becomes posted
            Journal Entries. Pick the period above, then copy the command — it always imports
            ledgers and vendors too. Re-running is safe — already-imported records are skipped.
          </p>
          {settings?.bridgeLastUploadAt && (
            <p className="text-xs text-muted-foreground">
              Last upload received {new Date(settings.bridgeLastUploadAt).toLocaleString("en-IN")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
