"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageScrollerContextType {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  onScroll: () => void;
}

const MessageScrollerContext = React.createContext<MessageScrollerContextType | null>(null);

export function useMessageScroller() {
  const context = React.useContext(MessageScrollerContext);
  if (!context) {
    throw new Error("useMessageScroller must be used within a MessageScrollerProvider");
  }
  return context;
}

interface MessageScrollerProviderProps {
  children: React.ReactNode;
  autoScroll?: boolean;
}

export function MessageScrollerProvider({
  children,
  autoScroll = true,
}: MessageScrollerProviderProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  const checkIsAtBottom = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return true;
    const threshold = 60; // px margin of error
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  const handleScroll = React.useCallback(() => {
    setIsAtBottom(checkIsAtBottom());
  }, [checkIsAtBottom]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  }, []);

  // When autoScroll is enabled and user is already at bottom, scroll on resize/mutation
  React.useEffect(() => {
    if (!autoScroll) return;
    const el = viewportRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (isAtBottom) {
        scrollToBottom("instant");
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [autoScroll, isAtBottom, scrollToBottom]);

  return (
    <MessageScrollerContext.Provider
      value={{
        viewportRef,
        isAtBottom,
        scrollToBottom,
        onScroll: handleScroll,
      }}
    >
      {children}
    </MessageScrollerContext.Provider>
  );
}

export const MessageScroller = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="message-scroller"
    className={cn("relative flex flex-1 flex-col min-h-0 w-full overflow-hidden", className)}
    {...props}
  />
));
MessageScroller.displayName = "MessageScroller";

export const MessageScrollerViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { viewportRef, onScroll } = useMessageScroller();

  React.useImperativeHandle(ref, () => viewportRef.current as HTMLDivElement);

  return (
    <div
      ref={viewportRef}
      data-slot="message-scroller-viewport"
      onScroll={onScroll}
      className={cn(
        "h-full w-full overflow-y-auto overscroll-contain scroll-smooth focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
MessageScrollerViewport.displayName = "MessageScrollerViewport";

export const MessageScrollerContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="message-scroller-content"
    className={cn("flex flex-col gap-4 p-4 sm:p-5", className)}
    {...props}
  />
));
MessageScrollerContent.displayName = "MessageScrollerContent";

export interface MessageScrollerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  messageId?: string;
  scrollAnchor?: boolean;
}

export const MessageScrollerItem = React.forwardRef<
  HTMLDivElement,
  MessageScrollerItemProps
>(({ className, messageId, scrollAnchor, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="message-scroller-item"
    data-message-id={messageId}
    data-scroll-anchor={scrollAnchor}
    className={cn("chat-bubble-enter w-full", className)}
    {...props}
  />
));
MessageScrollerItem.displayName = "MessageScrollerItem";

export function MessageScrollerButton({
  className,
  label = "Ke bawah",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  const { isAtBottom, scrollToBottom } = useMessageScroller();

  if (isAtBottom) return null;

  return (
    <button
      type="button"
      data-slot="message-scroller-button"
      onClick={() => scrollToBottom("smooth")}
      aria-label="Gulir ke pesan terbaru"
      className={cn(
        "absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-[#C7D8EE] bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#123B72] shadow-md backdrop-blur-xs transition-all hover:bg-[#EEF4FC] hover:shadow-lg active:scale-95 animate-in fade-in-0 slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      <ChevronDown className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
