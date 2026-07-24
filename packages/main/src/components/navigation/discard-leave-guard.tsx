"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DiscardLeaveGuardApi {
  readonly requestLeave: (href: string) => void;
  readonly dialog: ReactNode;
}

/**
 * Confirms before leaving a dirty form via the in-app Back control.
 * Does not intercept global browser history.
 */
export function useDiscardLeaveGuard(isDirty: boolean): DiscardLeaveGuardApi {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const requestLeave = useCallback(
    (href: string) => {
      if (!isDirty) {
        router.push(href);
        return;
      }
      setPendingHref(href);
    },
    [isDirty, router],
  );

  const dialog = (
    <Dialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPendingHref(null);
        }
      }}
    >
      <DialogContent
        className="border border-[var(--tl-border)] bg-[var(--tl-surface)] text-[var(--tl-ink)]"
        data-testid="discard-leave-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-lg uppercase tracking-wide">
            Discard unsaved changes?
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[var(--tl-ink-muted)]">
            Changes made on this page have not been saved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 text-sm font-semibold"
            data-testid="discard-keep-editing"
            onClick={() => setPendingHref(null)}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-md)] bg-[var(--tl-danger,var(--tl-primary))] px-4 text-sm font-semibold text-white"
            data-testid="discard-and-leave"
            onClick={() => {
              const href = pendingHref;
              setPendingHref(null);
              if (href) {
                router.push(href);
              }
            }}
          >
            Discard and leave
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestLeave, dialog };
}
