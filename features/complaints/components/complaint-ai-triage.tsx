"use client"

import React, { useState, useEffect } from "react"
import {
  Sparkles,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"

interface ComplaintAiTriageProps {
  complaint: {
    id: string
    title?: string | null
    subject?: string | null
    description?: string | null
    category?: string | null
    priority?: string | null
  }
}

interface AiTriageResult {
  requestId: string
  priority: string
  category: string
  summary: string
  suggestedResolution: string[] | string
}

export function ComplaintAiTriageSection({ complaint }: ComplaintAiTriageProps) {
  const [triageData, setTriageData] = useState<AiTriageResult | null>(null)
  const [userRating, setUserRating] = useState<"up" | "down" | null>(null)

  // Reset AI state when switching between different complaints in the sheet
  useEffect(() => {
    setTriageData(null)
    setUserRating(null)
  }, [complaint.id])

  const triageMutation = trpc.ai.triageComplaint.useMutation({
    onSuccess: (data) => {
      setTriageData(data as AiTriageResult)
      setUserRating(null)
    },
  })

  const rateMutation = trpc.ai.rateReply.useMutation()

  const descriptionText = complaint.description?.trim() ?? ""
  const isDescriptionValid = descriptionText.length >= 5

  const handleRunTriage = () => {
    if (!isDescriptionValid || triageMutation.isPending) return

    triageMutation.mutate({
      subject: complaint.title || complaint.subject || "Complaint",
      description: descriptionText,
    })
  }

  const handleRate = (rating: "up" | "down") => {
    if (!triageData?.requestId || userRating || rateMutation.isPending) return

    setUserRating(rating)
    rateMutation.mutate(
      {
        requestId: triageData.requestId,
        rating,
      },
      {
        onError: () => {
          // Revert optimistic state if network call fails
          setUserRating(null)
        },
      }
    )
  }

  const getPriorityBadgeStyle = (priority: string) => {
    const normalized = priority.toLowerCase()
    if (normalized.includes("high") || normalized.includes("urgent") || normalized.includes("critical")) {
      return "bg-rose-500/15 text-rose-300 border-rose-500/30"
    }
    if (normalized.includes("medium") || normalized.includes("normal")) {
      return "bg-amber-500/15 text-amber-300 border-amber-500/30"
    }
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  }

  // Normalize resolution steps whether backend returns string[] or newline-delimited string
  const resolutionSteps = React.useMemo(() => {
    if (!triageData?.suggestedResolution) return []
    if (Array.isArray(triageData.suggestedResolution)) {
      return triageData.suggestedResolution.filter(Boolean)
    }
    return triageData.suggestedResolution
      .split(/\n+/)
      .map((step) => step.replace(/^\d+[\.\)]\s*|^-\s*/, "").trim())
      .filter(Boolean)
  }, [triageData?.suggestedResolution])

  return (
    <div className="my-4 space-y-3">
      {/* Trigger Button (shown when no triage result yet) */}
      {!triageData && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleRunTriage}
            disabled={!isDescriptionValid || triageMutation.isPending}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-600/90 to-violet-600/90 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:border-slate-800 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500"
          >
            {triageMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-indigo-200" />
                <span>Analyzing complaint with Coarena AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-indigo-200 transition-transform group-hover:scale-110" />
                <span>AI Triage & Assist</span>
              </>
            )}
          </button>

          {!isDescriptionValid && (
            <p className="text-xs text-slate-500">
              Requires a description of at least 5 characters to run AI triage.
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {triageMutation.isError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="flex-1">
            <p className="font-medium text-rose-200">AI Triage Failed</p>
            <p className="mt-0.5 text-rose-300/80">
              {triageMutation.error?.message || "Unable to generate suggestions right now. Please try again."}
            </p>
          </div>
        </div>
      )}

      {/* AI Recommendation Card */}
      {triageData && (
        <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 p-4 shadow-lg ring-1 ring-inset ring-violet-500/10">
          {/* Subtle top highlight bar */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

          {/* Card Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-100">
                    AI Triage & Resolution Suggestion
                  </h4>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    Coarena AI
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunTriage}
              disabled={triageMutation.isPending}
              title="Regenerate AI Triage"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${triageMutation.isPending ? "animate-spin text-indigo-400" : ""}`}
              />
            </button>
          </div>

          {/* Predicted Priority & Category Badges */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium ${getPriorityBadgeStyle(
                triageData.priority
              )}`}
            >
              <span className="opacity-75">Predicted Priority:</span>
              <span className="font-semibold capitalize">{triageData.priority}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs font-medium text-slate-300">
              <span className="text-slate-400">Category:</span>
              <span className="font-semibold text-indigo-300">{triageData.category}</span>
            </span>
          </div>

          {/* 1-Sentence Concise Summary */}
          <div className="mt-3.5 rounded-lg border border-slate-800/90 bg-slate-800/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Executive Summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-200">
              {triageData.summary}
            </p>
          </div>

          {/* Step-by-Step Suggested Resolution */}
          {resolutionSteps.length > 0 && (
            <div className="mt-3.5 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Suggested Resolution Steps
              </p>
              <ol className="space-y-2">
                {resolutionSteps.map((step, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-300"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/15 text-xs font-semibold text-indigo-300">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Feedback Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
            {userRating ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Thanks for your feedback!</span>
              </div>
            ) : (
              <>
                <span className="text-xs text-slate-400">
                  Was this triage suggestion helpful?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRate("up")}
                    disabled={rateMutation.isPending || !triageData.requestId}
                    aria-label="Helpful"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate("down")}
                    disabled={rateMutation.isPending || !triageData.requestId}
                    aria-label="Not helpful"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    <span>No</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
