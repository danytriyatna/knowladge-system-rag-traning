"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const PromptInput = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col rounded-2xl border border-[#D9E1EC] bg-white p-2.5 shadow-sm transition-all focus-within:border-[#123B72] focus-within:ring-2 focus-within:ring-[#123B72]/15",
      className
    )}
    {...props}
  />
));
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: () => void;
}

export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  PromptInputTextareaProps
>(({ className, value, onChange, onSubmit, onKeyDown, rows = 1, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

  // Auto-resize textarea height
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyDown) onKeyDown(e);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (onSubmit) onSubmit();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      rows={rows}
      className={cn(
        "w-full resize-none border-0 bg-transparent px-2.5 py-1 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-0 max-h-[180px] leading-relaxed",
        className
      )}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = "PromptInputTextarea";

export const PromptInputActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F4FA] pt-2 px-1",
      className
    )}
    {...props}
  />
));
PromptInputActions.displayName = "PromptInputActions";

interface PromptInputSubmitProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export const PromptInputSubmit = React.forwardRef<
  HTMLButtonElement,
  PromptInputSubmitProps
>(({ className, loading = false, disabled, children, ...props }, ref) => (
  <Button
    ref={ref}
    type="submit"
    size="sm"
    disabled={disabled || loading}
    className={cn(
      "gap-1.5 rounded-full px-4 text-xs font-bold shadow-xs transition-all",
      className
    )}
    {...props}
  >
    {loading ? (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Menganalisis...</span>
      </>
    ) : (
      children || (
        <>
          <Send className="h-3.5 w-3.5" />
          <span>Kirim</span>
        </>
      )
    )}
  </Button>
));
PromptInputSubmit.displayName = "PromptInputSubmit";
