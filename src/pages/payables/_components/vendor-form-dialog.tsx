import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { PAN_REGEX } from "@/lib/pan.ts";
import { VENDOR_CATEGORIES } from "@/lib/vendors.ts";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  category: z.string().min(1, "Category required"),
  gstin: z.string().optional(),
  pan: z.string().optional().refine((v) => !v || PAN_REGEX.test(v), "Enter a valid PAN (e.g. ABCDE1234F)"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Doc<"vendors"> | null;
};

export default function VendorFormDialog({ open, onOpenChange, editing }: Props) {
  const createVendor = useMutation(api.vendors.createVendor);
  const updateVendor = useMutation(api.vendors.updateVendor);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editing?.name ?? "",
      category: editing?.category ?? "contractor",
      gstin: editing?.gstin ?? "",
      pan: editing?.pan ?? "",
      phone: editing?.phone ?? "",
      email: editing?.email ?? "",
      address: editing?.address ?? "",
      city: editing?.city ?? "",
      state: editing?.state ?? "",
      pincode: editing?.pincode ?? "",
      bankAccount: editing?.bankAccount ?? "",
      bankIfsc: editing?.bankIfsc ?? "",
      bankName: editing?.bankName ?? "",
      notes: editing?.notes ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        email: values.email || undefined,
        gstin: values.gstin || undefined,
        pan: values.pan || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        pincode: values.pincode || undefined,
        bankAccount: values.bankAccount || undefined,
        bankIfsc: values.bankIfsc || undefined,
        bankName: values.bankName || undefined,
        notes: values.notes || undefined,
      };

      if (editing) {
        await updateVendor({ vendorId: editing._id, ...payload });
        toast.success("Vendor updated");
      } else {
        await createVendor(payload);
        toast.success("Vendor created");
      }
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error("Failed to save vendor");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Vendor" : "New Vendor"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic">
              <TabsList className="mb-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="bank">Bank Details</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Vendor Name *</FormLabel>
                      <FormControl><Input placeholder="ABC Constructions Pvt Ltd" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {VENDOR_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="vendor@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gstin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl><Input placeholder="29AAAAA0000A1Z5" className="uppercase" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pan" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          className="uppercase font-mono"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea rows={2} placeholder="Internal notes about this vendor…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Street Address</FormLabel>
                      <FormControl><Textarea rows={2} placeholder="Building, Street…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input placeholder="Bengaluru" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input placeholder="Karnataka" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pincode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl><Input placeholder="560001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="bank" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="bankName" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl><Input placeholder="HDFC Bank" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bankAccount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl><Input placeholder="50100000000000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bankIfsc" render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFSC Code</FormLabel>
                      <FormControl><Input placeholder="HDFC0001234" className="uppercase" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Save Changes" : "Create Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
