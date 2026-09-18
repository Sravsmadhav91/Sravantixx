import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";

type LogoProps = {
  className?: string;
  /** Use the light text treatment for dark surfaces like the sidebar. */
  onDark?: boolean;
  src?: string;
  alt?: string;
};

export default function Logo({ className, onDark = false, src, alt = "Sravantix Real Estate ERP" }: LogoProps) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <img
        src={src ?? "https://hercules-cdn.com/file_9CAFltf4bEqLfW2JPJAWafGP"}
        alt={alt}
        className="h-14 w-auto object-contain"
      />
    </Link>
  );
}
