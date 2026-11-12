import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#123B72] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#123B72] text-white shadow-xs",
        secondary:
          "border-[#C2CEE0]/60 bg-[#EEF4FC] text-[#0B254B]",
        gold:
          "border-[#EAB308]/40 bg-[#FEF9C3] text-[#854D0E] font-semibold",
        warning:
          "border-amber-300 bg-amber-50 text-amber-800",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        destructive:
          "border-red-200 bg-red-50 text-red-700",
        outline:
          "border-[#D9E1EC] text-[#64748B] bg-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
