"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/auth";
import { runSyncPull } from "@/sync/runSync";
import { runPush } from "@/sync/runPush";
import { approveOutbound, rejectOutbound, resolveConflict, acknowledgeRemoved } from "@/sync/resolve";

export async function pullAction() {
  await requireSession();
  await runSyncPull();
  revalidatePath("/sync");
}

export async function pushAction() {
  await requireSession();
  await runPush();
  revalidatePath("/sync");
}

export async function approveOutboundAction(id: string) {
  await requireSession();
  await approveOutbound(id);
  revalidatePath("/sync");
}

export async function rejectOutboundAction(id: string) {
  await requireSession();
  await rejectOutbound(id);
  revalidatePath("/sync");
}

export async function resolveConflictKeepAppAction(id: string) {
  await requireSession();
  await resolveConflict(id, "keep_app");
  revalidatePath("/sync");
}

export async function resolveConflictKeepSheetAction(id: string) {
  await requireSession();
  await resolveConflict(id, "keep_sheet");
  revalidatePath("/sync");
}

export async function resolveConflictCustomAction(id: string, formData: FormData) {
  await requireSession();
  const value = String(formData.get("customValue") ?? "").trim();
  if (!value) return;
  await resolveConflict(id, { custom: value });
  revalidatePath("/sync");
}

export async function acknowledgeRemovedAction(id: string) {
  await requireSession();
  await acknowledgeRemoved(id);
  revalidatePath("/sync");
}
