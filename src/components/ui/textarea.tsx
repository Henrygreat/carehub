import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#237E78] focus-visible:ring-2 focus-visible:ring-[#237E78]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}
