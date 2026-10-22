import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700",
        primary: "bg-[#237E78]/10 text-[#237E78]",
        secondary: "bg-[#182F42]/10 text-[#182F42]",
        success: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-700",
        error: "bg-rose-50 text-rose-700",
        info: "bg-blue-50 text-blue-700",
        gold: "bg-[#E3AD63]/20 text-[#b38a3e]",
        outline: "border border-slate-200 text-slate-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
