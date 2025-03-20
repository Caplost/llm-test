"use client"

import { cn } from "@/lib/utils"

interface LoadingDotsProps {
  className?: string
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div className={cn("flex space-x-1.5", className)}>
      <div className="h-2 w-2 animate-[bounce_1s_infinite_0ms] rounded-full bg-muted-foreground/70" />
      <div className="h-2 w-2 animate-[bounce_1s_infinite_200ms] rounded-full bg-muted-foreground/70" />
      <div className="h-2 w-2 animate-[bounce_1s_infinite_400ms] rounded-full bg-muted-foreground/70" />
    </div>
  )
} 