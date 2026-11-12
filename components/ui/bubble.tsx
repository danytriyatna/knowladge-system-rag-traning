"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const bubbleVariants = cva(
  "relative whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed transition-all shadow-xs",
  {
    variants: {
      variant: {
        default:
          "rounded-2xl rounded-bl-xs border border-[#D9E1EC] bg-white text-stone-800",
        primary:
          "rounded-2xl rounded-br-xs bg-[#123B72] text-white",
        user:
          "rounded-2xl rounded-br-xs bg-[#123B72] text-white",
        assistant:
          "rounded-2xl rounded-bl-xs border border-[#D9E1EC] bg-white text-stone-800",
        secondary:
          "rounded-2xl border border-[#D9E1EC] bg-[#F4F7FC] text-stone-800",
        muted:
          "rounded-2xl border border-[#D9E1EC] bg-[#F8FAFD] text-stone-700",
        ghost:
          "bg-transparent p-0 shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bubbleVariants> {}

export const Bubble = React.forwardRef<HTMLDivElement, BubbleProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      data-slot="bubble"
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  )
);
Bubble.displayName = "Bubble";

export interface BubbleContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const BubbleContent = React.forwardRef<HTMLDivElement, BubbleContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="bubble-content"
      className={cn("space-y-2", className)}
      {...props}
    />
  )
);
BubbleContent.displayName = "BubbleContent";

export interface BubbleGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const BubbleGroup = React.forwardRef<HTMLDivElement, BubbleGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="bubble-group"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
);
BubbleGroup.displayName = "BubbleGroup";
