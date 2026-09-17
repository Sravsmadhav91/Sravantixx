import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  designation: z.string().min(1, "Designation required"),
  dateOfJoining: z.string().min(1, "Required"),
  pan: z.string().optional(),
  uan: z.string().optional(),
  esiNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
  costCenterId: z.string().optional(),
  basic: z.string().min(1, "Required"),
  hra: z.string().optional(),
  conveyance: z.string().optional(),
  specialAllowance: z.string().optional(),
  otherAllowances: z.string().optional(),
  pfApplicable: z.boolean(),
  esiApplicable: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Doc<"employees">;
};

export default function EmployeeFormDialog({ open, onOpenChange, editing }: Props) {
  const createEmployee = useMutation(api.payroll.createEmployee);
  const updateEmployee = useMutation(api.payroll.updateEmployee);
  const costCenters = useQuery(api.accounting.listCostCenters, { activeOnly: true });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", designation: "", dateOfJoining: new Date().toISOString().slice(0, 10),
      pan: "", uan: "", esiNumber: "", phone: "", email: "", bankAccount: "", bankIfsc: "", bankName: "",
      costCenterId: "", basic: "", hra: "0", conveyance: "0", specialAllowance: "0", otherAllowances: "0",
      pfApplicable: true, esiApplicable: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? "",
        designation: editing?.designation ?? "",
        dateOfJoining: editing?.dateOfJoining ?? new Date().toISOString().slice(0, 10),
        pan: editing?.pan ?? "",
        uan: editing?.uan ?? "",
        esiNumber: editing?.esiNumber ?? "",
        phone: editing?.phone ?? "",
        email: editing?.email ?? "",
        bankAccount: editing?.bankAccount ?? "",
        bankIfsc: editing?.bankIfsc ?? "",
        bankName: editing?.bankName ?? "",
        costCenterId: editing?.costCenterId ?? "",
        basic: editing ? String(editing.basic) : "",
        hra: editing ? String(editing.hra) : "0",
        conveyance: editing ? String(editing.conveyance) : "0",
        specialAllowance: editing ? String(editing.specialAllowance) : "0",
        otherAllowances: editing ? String(editing.otherAllowances) : "0",
        pfApplicable: editing?.pfApplicable ?? true,
        esiApplicable: editing?.esiApplicable ?? false,
      });
    }
  }, [open, editing, form]);

  const basic = parseFloat(form.watch("basic") || "0") || 0;
  const hra = parseFloat(form.watch("hra") || "0") || 0;
  const conveyance = parseFloat(form.watch("conveyance") || "0") || 0;
  const specialAllowance = parseFloat(form.watch("specialAllowance") || "0") || 0;
  const otherAllowances = parseFloat(form.watch("otherAllowances") || "0") || 0;
  const gross = basic + hra + conveyance + specialAllowance + otherAllowances;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      designation: values.designation,
      dateOfJoining: values.dateOfJoining,
      pan: values.pan || undefined,
      uan: values.uan || undefined,
      esiNumber: values.esiNumber || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      bankAccount: values.bankAccount || undefined,
      bankIfsc: values.bankIfsc || undefined,
      bankName: values.bankName || undefined,
      costCenterId: values.costCenterId && values.costCenterId !== "none" ? (values.costCenterId as Doc<"costCenters">["_id"]) : undefined,
      basic: parseFloat(values.basic) || 0,
      hra: parseFloat(values.hra || "0") || 0,
      conveyance: parseFloat(values.conveyance || "0") || 0,
      specialAllowance: parseFloat(values.specialAllowance || "0") || 0,
      otherAllowances: parseFloat(values.otherAllowances || "0") || 0,
      pfApplicable: values.pfApplicable,
      esiApplicable: values.esiApplicable,
    };
    try {
      if (editing) {
        await updateEmployee({ employeeId: editing._id, ...payload });
        toast.success("Employee updated");
      } else {
        await createEmployee(payload);
        toast.success("Employee added");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save employee");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Employee" : "New Employee"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="e.g. Ramesh Kumar" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="designation" render={({ field }) => (
                <FormItem><FormLabel>Designation *</FormLabel><FormControl><Input placeholder="e.g. Site Engineer" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dateOfJoining" render={({ field }) => (
                <FormItem><FormLabel>Date of Joining *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="costCenterId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Center</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={[{ value: "none", label: "None" }, ...(costCenters ?? []).map((c) => ({ value: c._id, label: c.name }))]}
                      placeholder="None"
                      searchPlaceholder="Search…"
                      allowClear
                    />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="pan" render={({ field }) => (
                <FormItem><FormLabel>PAN</FormLabel><FormControl><Input placeholder="ABCDE1234F" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="uan" render={({ field }) => (
                <FormItem><FormLabel>UAN</FormLabel><FormControl><Input placeholder="PF UAN number" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="9999999999" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="bankAccount" render={({ field }) => (
                <FormItem><FormLabel>Bank Account No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="bankIfsc" render={({ field }) => (
                <FormItem><FormLabel>IFSC</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl></FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Monthly Salary Structure</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <FormField control={form.control} name="basic" render={({ field }) => (
                  <FormItem><FormLabel>Basic *</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="hra" render={({ field }) => (
                  <FormItem><FormLabel>HRA</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="conveyance" render={({ field }) => (
                  <FormItem><FormLabel>Conveyance</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="specialAllowance" render={({ field }) => (
                  <FormItem><FormLabel>Special Allowance</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="otherAllowances" render={({ field }) => (
                  <FormItem><FormLabel>Other Allowances</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Monthly Salary</span>
                <span className="font-semibold tabular-nums">{formatCompactInr(gross)}</span>
              </div>
            </div>

            <div className="flex gap-6">
              <FormField control={form.control} name="pfApplicable" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">PF Applicable</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="esiApplicable" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">ESI Applicable</FormLabel>
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{editing ? "Save changes" : "Add employee"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
