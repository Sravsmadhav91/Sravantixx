import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  Plus,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { VENDOR_CATEGORIES } from "@/lib/vendors.ts";

type Stage = "upload" | "scanning" | "review" | "creating";

type ReviewLine = {
  description: string;
  quantity: string;
  rate: string;
};

const ACCEPT = "image/*,application/pdf";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (invoiceId: Id<"purchaseInvoices">) => void;
};

export default function ScanInvoiceDialog({ open, onOpenChange, onCreated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<"image" | "pdf" | null>(null);

  // Review form state
  const [vendorName, setVendorName] = useState("");
  const [vendorChoice, setVendorChoice] = useState(""); // existing vendor id, or "new"
  const [newVendorCategory, setNewVendorCategory] = useState("material_supplier");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [cgst, setCgst] = useState("0");
  const [sgst, setSgst] = useState("0");
  const [igst, setIgst] = useState("0");
  const [tds, setTds] = useState("0");
  const [lowConfidence, setLowConfidence] = useState(false);

  const scanInvoice = useAction(api.invoiceScan.scanInvoice);
  const createInvoice = useMutation(api.vendors.createPurchaseInvoice);
  const createVendor = useMutation(api.vendors.createVendor);
  const vendors = useQuery(api.vendors.listVendors, { active: true });

  const reset = () => {
    setStage("upload");
    setPreviewUrl(null);
    setFileKind(null);
    setVendorName("");
    setVendorChoice("");
    setNewVendorCategory("material_supplier");
    setInvoiceNumber("");
    setDate("");
    setDueDate("");
    setLines([]);
    setCgst("0");
    setSgst("0");
    setIgst("0");
    setTds("0");
    setLowConfidence(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File must be smaller than 15 MB");
      return;
    }
    const isPdf = file.type === "application/pdf";
    if (!isPdf && !file.type.startsWith("image/")) {
      toast.error("Please upload an image or PDF file");
      return;
    }

    setStage("scanning");
    setFileKind(isPdf ? "pdf" : "image");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreviewUrl(isPdf ? null : dataUrl);

      const result = await scanInvoice({ fileDataUrl: dataUrl });

      setVendorName(result.vendorName);
      // Try to auto-match an existing vendor by exact (case-insensitive) name
      const match = vendors?.find(
        (v) => v.name.trim().toLowerCase() === result.vendorName.trim().toLowerCase(),
      );
      setVendorChoice(match ? match._id : result.vendorName ? "new" : "");
      setInvoiceNumber(result.invoiceNumber);
      setDate(result.date || new Date().toISOString().slice(0, 10));
      setDueDate(result.dueDate);
      setLines(
        result.lines.length > 0
          ? result.lines.map((l) => ({
              description: l.description,
              quantity: String(l.quantity || 1),
              rate: String(l.rate || l.amount || 0),
            }))
          : [{ description: "", quantity: "1", rate: "0" }],
      );
      setCgst(String(result.cgst));
      setSgst(String(result.sgst));
      setIgst(String(result.igst));
      setTds(String(result.tds));
      setLowConfidence(result.lowConfidence);
      setStage("review");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Failed to scan invoice — please try again",
      );
      setStage("upload");
    }
  };

  const subtotal = lines.reduce(
    (s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0),
    0,
  );
  const total =
    subtotal +
    (parseFloat(cgst) || 0) +
    (parseFloat(sgst) || 0) +
    (parseFloat(igst) || 0) -
    (parseFloat(tds) || 0);

  const updateLine = (idx: number, patch: Partial<ReviewLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handleConfirm = async () => {
    if (!vendorChoice) {
      toast.error("Select or create a vendor");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    if (lines.every((l) => !l.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }

    setStage("creating");
    try {
      let vendorId: Id<"vendors">;
      if (vendorChoice === "new") {
        vendorId = await createVendor({
          name: vendorName.trim() || "Unknown Vendor",
          category: newVendorCategory,
        });
      } else {
        vendorId = vendorChoice as Id<"vendors">;
      }

      const invoiceId = await createInvoice({
        vendorId,
        invoiceNumber: invoiceNumber.trim(),
        date: date || new Date().toISOString().slice(0, 10),
        dueDate: dueDate || undefined,
        lines: lines
          .filter((l) => l.description.trim())
          .map((l) => ({
            description: l.description,
            quantity: parseFloat(l.quantity) || 1,
            rate: parseFloat(l.rate) || 0,
            amount: (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0),
          })),
        cgst: parseFloat(cgst) || 0,
        sgst: parseFloat(sgst) || 0,
        igst: parseFloat(igst) || 0,
        tds: parseFloat(tds) || 0,
      });

      toast.success("Purchase invoice created from scan");
      onCreated?.(invoiceId);
      handleClose(false);
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Failed to create invoice",
      );
      setStage("review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" />
            Scan Purchase Invoice
          </DialogTitle>
        </DialogHeader>

        {/* Upload stage */}
        {stage === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Take a photo of a vendor invoice, or upload a PDF/image. AI will read it and pre-fill
              the invoice for your review.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer hover:border-primary hover:bg-muted/40"
              >
                <Camera className="size-7 text-muted-foreground" />
                <span className="text-sm font-medium">Take a photo</span>
                <span className="text-xs text-muted-foreground">Mobile camera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer hover:border-primary hover:bg-muted/40"
              >
                <FileUp className="size-7 text-muted-foreground" />
                <span className="text-sm font-medium">Upload file</span>
                <span className="text-xs text-muted-foreground">Image or PDF · max 15 MB</span>
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {/* Scanning stage */}
        {stage === "scanning" && (
          <div className="flex flex-col items-center gap-3 py-10">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Invoice preview"
                className="max-h-40 rounded-lg border object-contain"
              />
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Reading invoice with AI…
            </div>
          </div>
        )}

        {/* Review stage */}
        {(stage === "review" || stage === "creating") && (
          <div className="space-y-4">
            {lowConfidence && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  The AI wasn't fully confident reading this document — please double-check every
                  field before creating the invoice.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Vendor *</Label>
                <SearchableSelect
                  value={vendorChoice}
                  onValueChange={setVendorChoice}
                  options={[
                    { value: "new", label: vendorName ? `+ Create "${vendorName}"` : "+ Create new vendor" },
                    ...(vendors ?? []).map((v) => ({ value: v._id, label: v.name })),
                  ]}
                  placeholder="Select or create vendor…"
                  searchPlaceholder="Search vendors…"
                  triggerClassName="w-full"
                />
                {vendorChoice === "new" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input
                      placeholder="Vendor name"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                    />
                    <SearchableSelect
                      value={newVendorCategory}
                      onValueChange={setNewVendorCategory}
                      options={VENDOR_CATEGORIES.map((c) => ({
                        value: c.value,
                        label: c.label,
                      }))}
                      placeholder="Category…"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Number *</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Line Items</Label>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs font-medium text-muted-foreground">
                      <th className="px-2 py-1.5 text-left min-w-[160px]">Description</th>
                      <th className="px-2 py-1.5 text-right w-16">Qty</th>
                      <th className="px-2 py-1.5 text-right w-24">Rate (₹)</th>
                      <th className="px-2 py-1.5 text-right w-24">Amount (₹)</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1">
                          <Input
                            className="h-7 text-xs"
                            value={line.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-7 text-xs text-right"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            className="h-7 text-xs text-right"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            onChange={(e) => updateLine(idx, { rate: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-xs pr-3 tabular-nums">
                          {formatCompactInr(
                            (parseFloat(line.quantity) || 0) * (parseFloat(line.rate) || 0),
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setLines((prev) => [...prev, { description: "", quantity: "1", rate: "0" }])}
              >
                <Plus className="size-3.5" /> Add Line
              </Button>
            </div>

            {/* Tax & totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tax &amp; Deductions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "cgst", value: cgst, set: setCgst },
                    { key: "sgst", value: sgst, set: setSgst },
                    { key: "igst", value: igst, set: setIgst },
                    { key: "tds", value: tds, set: setTds },
                  ].map(({ key, value, set }) => (
                    <div key={key} className="space-y-1">
                      <Label className="uppercase text-xs">{key}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm self-start">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono tabular-nums">{formatCompactInr(subtotal)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCompactInr(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === "upload" && (
            <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
          {stage === "scanning" && (
            <Button type="button" variant="ghost" onClick={() => setStage("upload")}>
              <X className="size-4" /> Cancel
            </Button>
          )}
          {(stage === "review" || stage === "creating") && (
            <>
              <Button type="button" variant="ghost" onClick={reset}>
                Rescan
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} disabled={stage === "creating"}>
                {stage === "creating" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Create Invoice
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
