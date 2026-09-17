import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Mail, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import BuyerFormDialog from "./buyer-form-dialog.tsx";

type BuyerCardProps = { buyer: Doc<"buyers">; readOnly?: boolean };

export default function BuyerCard({ buyer, readOnly = false }: BuyerCardProps) {
  if (readOnly) {
    return <ReadOnlyBuyerCard buyer={buyer} />;
  }
  return <EditableBuyerCard buyer={buyer} />;
}

function ReadOnlyBuyerCard({ buyer }: { buyer: Doc<"buyers"> }) {
  const initials = buyer.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <Card><CardContent className="space-y-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials}</span><Link to={`/buyers/${buyer._id}`} className="truncate font-medium hover:text-primary">{buyer.name}</Link></div><div className="space-y-1 text-sm text-muted-foreground"><p className="flex items-center gap-1.5"><Phone className="size-3.5" />{buyer.phone}</p>{buyer.email && <p className="flex items-center gap-1.5"><Mail className="size-3.5" />{buyer.email}</p>}</div><Button asChild variant="secondary" size="sm" className="w-full"><Link to={`/buyers/${buyer._id}`}>View bookings</Link></Button></CardContent></Card>;
}

function EditableBuyerCard({ buyer }: { buyer: Doc<"buyers"> }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeBuyer = useMutation(api.buyers.remove);

  const initials = buyer.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleDelete = async () => {
    try {
      await removeBuyer({ buyerId: buyer._id });
      toast.success("Buyer removed");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not remove buyer",
      );
    }
  };

  return (
    <>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </span>
              <div className="min-w-0">
                <Link
                  to={`/buyers/${buyer._id}`}
                  className="block truncate font-medium hover:text-primary"
                >
                  {buyer.name}
                </Link>
                {buyer.pan && (
                  <p className="text-xs text-muted-foreground">PAN: {buyer.pan}</p>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" />
              <span className="truncate">{buyer.phone}</span>
            </p>
            {buyer.email && (
              <p className="flex items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{buyer.email}</span>
              </p>
            )}
          </div>

          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link to={`/buyers/${buyer._id}`}>View bookings</Link>
          </Button>
        </CardContent>
      </Card>

      <BuyerFormDialog open={editOpen} onOpenChange={setEditOpen} buyer={buyer} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this buyer?</AlertDialogTitle>
            <AlertDialogDescription>
              Buyers with active bookings cannot be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
