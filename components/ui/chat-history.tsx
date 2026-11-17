"use client";

import * as React from "react";
import {
  History,
  MessageSquareQuote,
  Plus,
  Trash2,
  Search,
  X,
  Loader2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type HistoryQueryMode = "chat" | "kajian";
export type HistoryEvidenceStrength = "kuat" | "sedang" | "lemah";

export interface ChatHistoryRecord {
  id: string;
  question: string;
  created_at: string;
  mode?: HistoryQueryMode;
  evidence_strength?: HistoryEvidenceStrength | null;
}

export interface GroupedChatHistory<T> {
  label: string;
  items: T[];
}

/* -------------------------------------------------------------------------- */
/*                              Date Group Helper                             */
/* -------------------------------------------------------------------------- */

export function groupChatHistoryByDate<T extends { created_at: string }>(
  items: T[]
): GroupedChatHistory<T>[] {
  if (!items || items.length === 0) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const sevenDaysAgoStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoStart = todayStart - 29 * 24 * 60 * 60 * 1000;

  const groups: Record<string, T[]> = {
    "Hari Ini": [],
    "Kemarin": [],
    "7 Hari Terakhir": [],
    "Bulan Ini": [],
    "Lebih Lama": [],
  };

  for (const item of items) {
    const itemTime = new Date(item.created_at).getTime();
    if (isNaN(itemTime)) {
      groups["Lebih Lama"].push(item);
    } else if (itemTime >= todayStart) {
      groups["Hari Ini"].push(item);
    } else if (itemTime >= yesterdayStart) {
      groups["Kemarin"].push(item);
    } else if (itemTime >= sevenDaysAgoStart) {
      groups["7 Hari Terakhir"].push(item);
    } else if (itemTime >= thirtyDaysAgoStart) {
      groups["Bulan Ini"].push(item);
    } else {
      groups["Lebih Lama"].push(item);
    }
  }

  const result: GroupedChatHistory<T>[] = [];
  const order = ["Hari Ini", "Kemarin", "7 Hari Terakhir", "Bulan Ini", "Lebih Lama"];

  for (const label of order) {
    if (groups[label].length > 0) {
      result.push({ label, items: groups[label] });
    }
  }

  return result;
}

export function formatHistoryTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return timeStr;

    const dateStr = date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });

    return `${dateStr}, ${timeStr}`;
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/*                               Root Component                               */
/* -------------------------------------------------------------------------- */

export const ChatHistory = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="chat-history"
    className={cn(
      "flex flex-col h-[700px] max-h-[78vh] rounded-2xl border border-[#D9E1EC] bg-white shadow-xs overflow-hidden w-full md:w-64 lg:w-72 shrink-0 gap-0",
      className
    )}
    {...props}
  />
));
ChatHistory.displayName = "ChatHistory";

/* -------------------------------------------------------------------------- */
/*                                   Header                                   */
/* -------------------------------------------------------------------------- */

export const ChatHistoryHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="chat-history-header"
    className={cn(
      "p-3 border-b border-[#E6ECF5] bg-white flex items-center justify-between gap-2 shrink-0",
      className
    )}
    {...props}
  />
));
ChatHistoryHeader.displayName = "ChatHistoryHeader";

/* -------------------------------------------------------------------------- */
/*                                    Title                                   */
/* -------------------------------------------------------------------------- */

interface ChatHistoryTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

export const ChatHistoryTitle = React.forwardRef<
  HTMLDivElement,
  ChatHistoryTitleProps
>(({ className, children, count, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="chat-history-title"
    className={cn("flex items-center gap-2 min-w-0", className)}
    {...props}
  >
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FC] text-[#123B72]">
      <History className="h-3.5 w-3.5" />
    </div>
    <span className="text-xs font-bold text-stone-800 truncate">
      {children ?? "Riwayat Percakapan"}
    </span>
    {typeof count === "number" && count > 0 && (
      <span className="rounded-full bg-[#EEF4FC] px-1.5 py-0.2 text-[10px] font-bold text-[#123B72] shrink-0">
        {count}
      </span>
    )}
  </div>
));
ChatHistoryTitle.displayName = "ChatHistoryTitle";

/* -------------------------------------------------------------------------- */
/*                                 New Button                                 */
/* -------------------------------------------------------------------------- */

interface ChatHistoryNewButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export const ChatHistoryNewButton = React.forwardRef<
  HTMLButtonElement,
  ChatHistoryNewButtonProps
>(({ className, label = "Baru", ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    size="sm"
    data-slot="chat-history-new-button"
    className={cn(
      "h-7 gap-1 px-2.5 text-xs font-bold text-[#123B72] border border-[#D9E1EC] hover:bg-[#EEF4FC] hover:border-[#123B72]/30 rounded-lg shadow-2xs transition-all shrink-0 cursor-pointer",
      className
    )}
    {...props}
  >
    <Plus className="h-3.5 w-3.5" />
    <span>{label}</span>
  </Button>
));
ChatHistoryNewButton.displayName = "ChatHistoryNewButton";

/* -------------------------------------------------------------------------- */
/*                                Search Filter                               */
/* -------------------------------------------------------------------------- */

interface ChatHistorySearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

export const ChatHistorySearch = React.forwardRef<
  HTMLInputElement,
  ChatHistorySearchProps
>(({ className, value, onChange, onClear, placeholder = "Cari riwayat...", ...props }, ref) => (
  <div
    data-slot="chat-history-search"
    className="relative px-3 py-2 border-b border-[#E6ECF5] bg-[#F8FAFD]/70 shrink-0"
  >
    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-7 w-full rounded-lg border border-[#D9E1EC] bg-white pl-7 pr-7 text-xs text-stone-800 placeholder:text-stone-400 outline-none transition-colors focus:border-[#123B72] focus:ring-1 focus:ring-[#123B72]/20",
        className
      )}
      {...props}
    />
    {value && (
      <button
        type="button"
        onClick={() => {
          onChange("");
          if (onClear) onClear();
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-md"
        aria-label="Hapus pencarian"
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </div>
));
ChatHistorySearch.displayName = "ChatHistorySearch";

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

export const ChatHistoryContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="chat-history-content"
    className={cn(
      "flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-stone-200 hover:scrollbar-thumb-stone-300",
      className
    )}
    {...props}
  />
));
ChatHistoryContent.displayName = "ChatHistoryContent";

/* -------------------------------------------------------------------------- */
/*                                Group & Label                               */
/* -------------------------------------------------------------------------- */

export const ChatHistoryGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="chat-history-group"
    className={cn("space-y-1", className)}
    {...props}
  />
));
ChatHistoryGroup.displayName = "ChatHistoryGroup";

export const ChatHistoryGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="chat-history-group-label"
    className={cn(
      "px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 select-none",
      className
    )}
    {...props}
  />
));
ChatHistoryGroupLabel.displayName = "ChatHistoryGroupLabel";

/* -------------------------------------------------------------------------- */
/*                                    Item                                    */
/* -------------------------------------------------------------------------- */

interface ChatHistoryItemProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
  isLoading?: boolean;
  title: string;
  timestamp?: string;
  mode?: HistoryQueryMode;
  evidenceStrength?: HistoryEvidenceStrength | null;
  onSelect?: () => void;
  onDelete?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  deleteTitle?: string;
}

export const ChatHistoryItem = React.forwardRef<
  HTMLDivElement,
  ChatHistoryItemProps
>(
  (
    {
      className,
      isActive = false,
      isLoading = false,
      title,
      timestamp,
      mode,
      evidenceStrength,
      onSelect,
      onDelete,
      deleteTitle = "Hapus riwayat percakapan",
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        data-slot="chat-history-item"
        data-active={isActive}
        className={cn(
          "group relative flex items-center rounded-xl transition-all border",
          isActive
            ? "border-[#123B72]/20 bg-[#EEF4FC] text-[#0B254B] shadow-2xs"
            : "border-transparent text-stone-700 hover:bg-[#F6F9FD] hover:text-[#0B254B]",
          className
        )}
        {...props}
      >
        {/* Active Indicator Accent Bar */}
        <div
          className={cn(
            "w-1 h-5 rounded-full ml-1 shrink-0 transition-colors",
            isActive ? "bg-[#123B72]" : "bg-transparent"
          )}
          aria-hidden="true"
        />

        {/* Main Selectable Button */}
        <button
          type="button"
          onClick={onSelect}
          disabled={isLoading}
          className="min-w-0 flex-1 px-2 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B72] rounded-lg"
          title={title}
        >
          <div className="flex items-center gap-1.5">
            {mode === "kajian" && (
              <Badge
                variant="gold"
                className="shrink-0 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider"
              >
                Kajian
              </Badge>
            )}
            {evidenceStrength && (
              <span
                className={cn(
                  "shrink-0 rounded px-1 text-[9px] font-semibold uppercase",
                  evidenceStrength === "kuat"
                    ? "bg-emerald-100 text-emerald-800"
                    : evidenceStrength === "sedang"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                )}
              >
                {evidenceStrength}
              </span>
            )}
            <span
              className={cn(
                "truncate text-xs leading-snug flex-1",
                isActive ? "font-bold text-[#0B254B]" : "font-medium"
              )}
            >
              {isLoading ? "Memuat..." : title}
            </span>
            {isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-[#123B72] shrink-0" />
            )}
          </div>

          {timestamp && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-stone-400">
              <span>{formatHistoryTimestamp(timestamp)}</span>
            </div>
          )}
        </button>

        {/* Delete Action Button */}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title={deleteTitle}
            aria-label={deleteTitle}
            className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity text-stone-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 mr-1.5 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }
);
ChatHistoryItem.displayName = "ChatHistoryItem";

/* -------------------------------------------------------------------------- */
/*                                 Empty State                                */
/* -------------------------------------------------------------------------- */

interface ChatHistoryEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const ChatHistoryEmpty = React.forwardRef<
  HTMLDivElement,
  ChatHistoryEmptyProps
>(
  (
    {
      className,
      icon,
      title = "Belum Ada Riwayat",
      description = "Pertanyaan dan kajian ilmiah akan tersimpan di sini.",
      action,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      data-slot="chat-history-empty"
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center text-stone-500 my-auto",
        className
      )}
      {...props}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F9FD] border border-[#D9E1EC] text-[#123B72] mb-2.5">
        {icon ?? <MessageSquareQuote className="h-5 w-5 text-[#123B72]" />}
      </div>
      <p className="text-xs font-bold text-stone-700">{title}</p>
      {description && (
        <p className="mt-1 text-[11px] leading-relaxed text-stone-400 max-w-[180px]">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
);
ChatHistoryEmpty.displayName = "ChatHistoryEmpty";

/* -------------------------------------------------------------------------- */
/*                 Centralized High-Level ChatHistoryPanel                    */
/* -------------------------------------------------------------------------- */

interface CentralizedChatHistoryProps {
  items: ChatHistoryRecord[];
  activeId?: string | null;
  loadingId?: string | null;
  onSelect: (id: string) => void;
  onDelete?: (e: React.MouseEvent<HTMLButtonElement>, id: string) => void;
  onNewChat: () => void;
  className?: string;
  enableSearch?: boolean;
  enableDateGrouping?: boolean;
}

export function CentralizedChatHistory({
  items,
  activeId,
  loadingId,
  onSelect,
  onDelete,
  onNewChat,
  className,
  enableSearch = true,
  enableDateGrouping = true,
}: CentralizedChatHistoryProps) {
  const [search, setSearch] = React.useState("");

  const filteredItems = React.useMemo(() => {
    if (!search.trim()) return items;
    const lower = search.toLowerCase();
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(lower) ||
        (item.mode && item.mode.toLowerCase().includes(lower))
    );
  }, [items, search]);

  const grouped = React.useMemo(() => {
    if (!enableDateGrouping) return null;
    return groupChatHistoryByDate(filteredItems);
  }, [filteredItems, enableDateGrouping]);

  return (
    <ChatHistory className={className}>
      <ChatHistoryHeader>
        <ChatHistoryTitle count={items.length}>Riwayat</ChatHistoryTitle>
        <ChatHistoryNewButton onClick={onNewChat} />
      </ChatHistoryHeader>

      {enableSearch && items.length > 3 && (
        <ChatHistorySearch
          value={search}
          onChange={setSearch}
          placeholder="Cari topik riwayat..."
        />
      )}

      <ChatHistoryContent>
        {items.length === 0 ? (
          <ChatHistoryEmpty
            title="Belum Ada Riwayat"
            description="Pertanyaan dan hasil kajian Anda akan muncul di sini."
          />
        ) : filteredItems.length === 0 ? (
          <ChatHistoryEmpty
            title="Tidak Ditemukan"
            description={`Tidak ada riwayat yang cocok dengan "${search}".`}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearch("")}
                className="h-7 text-xs font-semibold text-[#123B72]"
              >
                Hapus pencarian
              </Button>
            }
          />
        ) : enableDateGrouping && grouped ? (
          grouped.map((group) => (
            <ChatHistoryGroup key={group.label}>
              <ChatHistoryGroupLabel>{group.label}</ChatHistoryGroupLabel>
              {group.items.map((item) => (
                <ChatHistoryItem
                  key={item.id}
                  title={item.question}
                  timestamp={item.created_at}
                  mode={item.mode}
                  evidenceStrength={item.evidence_strength}
                  isActive={activeId === item.id}
                  isLoading={loadingId === item.id}
                  onSelect={() => onSelect(item.id)}
                  onDelete={
                    onDelete ? (e) => onDelete(e, item.id) : undefined
                  }
                />
              ))}
            </ChatHistoryGroup>
          ))
        ) : (
          filteredItems.map((item) => (
            <ChatHistoryItem
              key={item.id}
              title={item.question}
              timestamp={item.created_at}
              mode={item.mode}
              evidenceStrength={item.evidence_strength}
              isActive={activeId === item.id}
              isLoading={loadingId === item.id}
              onSelect={() => onSelect(item.id)}
              onDelete={
                onDelete ? (e) => onDelete(e, item.id) : undefined
              }
            />
          ))
        )}
      </ChatHistoryContent>
    </ChatHistory>
  );
}
