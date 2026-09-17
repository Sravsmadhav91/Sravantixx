import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { integerString, numericString } from "@/lib/form-schema.ts";

const schema = z
  .object({
    block: z.string().trim().optional(),
    fromFloor: integerString("Enter a whole number"),
    toFloor: integerString("Enter a whole number"),
    unitsPerFloor: integerString("Enter a whole number"),
    areaSqft: numericString("Enter the Super Built-Up Area in sq ft"),
    ratePerSqft: numericString("Enter the rate per sq ft"),
    configuration: z.string().trim().optional(),
  })
  .refine((values) => Number(values.toFloor) >= Number(values.fromFloor), {
    path: ["toFloor"],
    message: "Last floor must not be below the first floor",
  })
  .refine(
    (values) =>
      Number(values.unitsPerFloor) >= 1 && Number(values.unitsPerFloor) <= 20,
    { path: ["unitsPerFloor"], message: "Enter between 1 and 20" },
  );

type FormValues = z.infer<typeof schema>;

type BulkUnitsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
};

export default function BulkUnitsDialog({
  open,
  onOpenChange,
  projectId,
}: BulkUnitsDialogProps) {
  const bulkCreate = useMutation(api.units.bulkCreate);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      block: "A",
      fromFloor: "1",
      toFloor: "10",
      unitsPerFloor: "4",
      areaSqft: "",
      ratePerSqft: "",
      configuration: "",
    },
  });

  const from = Number(form.watch("fromFloor")) || 0;
  const to = Number(form.watch("toFloor")) || 0;
  const perFloor = Number(form.watch("unitsPerFloor")) || 0;
  const estimate = to >= from ? (to - from + 1) * perFloor : 0;

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await bulkCreate({
        projectId,
        block: values.block || undefined,
        fromFloor: Number(values.fromFloor),
        toFloor: Number(values.toFloor),
        unitsPerFloor: Number(values.unitsPerFloor),
        superBuiltUpAreaSqft: Number(values.areaSqft),
        ratePerSqft: Number(values.ratePerSqft),
        configuration: values.configuration || undefined,
      });
      toast.success(
        result.skipped > 0
          ? `Added ${result.created} units, skipped ${result.skipped} that already existed`
          : `Added ${result.created} units`,
      );
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not generate units";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate units</DialogTitle>
          <DialogDescription>
            Create a whole block at once. Numbers follow the pattern A-101,
            A-102 and so on.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="block"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Block or wing</FormLabel>
                  <FormControl>
                    <Input placeholder="A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="configuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Configuration</FormLabel>
                  <FormControl>
                    <Input placeholder="2 BHK" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fromFloor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First floor</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toFloor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last floor</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unitsPerFloor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Units per floor</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>
                    {estimate} units will be created
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="areaSqft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Super Built-Up Area — SBA (sq ft)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1200"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ratePerSqft"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Rate per sq ft</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="6500"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Generate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
