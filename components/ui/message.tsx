"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageContextValue {
  align: "start" | "end";
}

const MessageContext = React.createContext<MessageContextValue>({ align: "start" });

export function useMessage() {
  return React.useContext(MessageContext);
}

const messageVariants = cva("flex w-full gap-3 py-1", {
  variants: {
    align: {
      start: "flex-row justify-start items-start",
      end: "flex-row-reverse justify-start items-end",
    },
  },
  defaultVariants: {
    align: "start",
  },
});

export interface MessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof messageVariants> {
  align?: "start" | "end";
}

export const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, align = "start", children, ...props }, ref) => (
    <MessageContext.Provider value={{ align }}>
      <div
        ref={ref}
        data-slot="message"
        data-align={align}
        className={cn(messageVariants({ align }), className)}
        {...props}
      >
        {children}
      </div>
    </MessageContext.Provider>
  )
);
Message.displayName = "Message";

export interface MessageGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageGroup = React.forwardRef<HTMLDivElement, MessageGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="message-group"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
);
MessageGroup.displayName = "MessageGroup";

export interface MessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  role?: "user" | "assistant";
  initials?: string;
  src?: string;
  alt?: string;
}

export const MessageAvatar = React.forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ className, role = "assistant", initials, children, ...props }, ref) => {
    const { align } = useMessage();

    if (children) {
      return (
        <div
          ref={ref}
          data-slot="message-avatar"
          className={cn(
            "flex shrink-0 select-none items-end mb-1",
            align === "end" ? "self-end" : "self-start",
            className
          )}
          {...props}
        >
          {children}
        </div>
      );
    }

    if (role === "user") {
      return (
        <div
          ref={ref}
          data-slot="message-avatar"
          className={cn(
            "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#123B72] text-xs font-bold text-white shadow-xs self-end mb-1",
            className
          )}
          {...props}
        >
          {initials ? initials.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-slot="message-avatar"
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-[#123B72] via-[#0E3161] to-[#0B254B] text-white shadow-xs ring-1 ring-[#EAB308]/60 self-start mt-0.5",
          className
        )}
        title="JP-Insight AI Assistant"
        {...props}
      >
        <Sparkles className="h-4 w-4 text-[#EAB308]" />
      </div>
    );
  }
);
MessageAvatar.displayName = "MessageAvatar";

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, align: alignProp, ...props }, ref) => {
    const { align: contextAlign } = useMessage();
    const align = alignProp ?? contextAlign;

    return (
      <div
        ref={ref}
        data-slot="message-content"
        className={cn(
          "flex max-w-[85%] flex-col gap-2 sm:max-w-[78%]",
          align === "end" ? "items-end text-right" : "items-start text-left",
          className
        )}
        {...props}
      />
    );
  }
);
MessageContent.displayName = "MessageContent";

export interface MessageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export const MessageHeader = React.forwardRef<HTMLDivElement, MessageHeaderProps>(
  ({ className, align: alignProp, ...props }, ref) => {
    const { align: contextAlign } = useMessage();
    const align = alignProp ?? contextAlign;

    return (
      <div
        ref={ref}
        data-slot="message-header"
        className={cn(
          "flex items-center gap-2 text-xs font-medium text-stone-500",
          align === "end" ? "justify-end" : "justify-start",
          className
        )}
        {...props}
      />
    );
  }
);
MessageHeader.displayName = "MessageHeader";

export interface MessageFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export const MessageFooter = React.forwardRef<HTMLDivElement, MessageFooterProps>(
  ({ className, align: alignProp, ...props }, ref) => {
    const { align: contextAlign } = useMessage();
    const align = alignProp ?? contextAlign;

    return (
      <div
        ref={ref}
        data-slot="message-footer"
        className={cn(
          "mt-0.5 flex items-center gap-2 text-[11px] text-stone-500",
          align === "end" ? "justify-end" : "justify-start",
          className
        )}
        {...props}
      />
    );
  }
);
MessageFooter.displayName = "MessageFooter";
