import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B72] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#123B72] text-white shadow-sm hover:bg-[#0E3161] active:scale-[0.98]",
        secondary:
          "bg-[#EEF4FC] text-[#0B254B] border border-[#C2CEE0]/60 hover:bg-[#E0ECFA] active:scale-[0.98]",
        outline:
          "border border-[#D9E1EC] bg-white text-[#1C1917] shadow-xs hover:bg-[#EEF4FC] hover:text-[#123B72] hover:border-[#123B72]/30 active:scale-[0.98]",
        destructive:
          "bg-red-600 text-white shadow-xs hover:bg-red-700 active:scale-[0.98]",
        gold:
          "bg-[#EAB308] text-[#081A36] font-semibold shadow-xs hover:bg-[#CA8A04] active:scale-[0.98]",
        ghost:
          "text-[#1C1917] hover:bg-[#EEF4FC] hover:text-[#123B72]",
        link:
          "text-[#123B72] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size, className }), child.props?.className),
        ref,
        ...props,
      } as React.HTMLAttributes<HTMLElement>);
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
