/**
 * Canonical workflow values for Topic (TopicItem) and Todo2D — not editable via project settings.
 * Use these in gatekeeping (publish, resolve topic) instead of TopicStatus collection rows.
 */

/** TopicItem.status values that allow Shared→Published (no unresolved discussion) */
export const TOPIC_TERMINAL_STATUSES_FOR_PUBLISH = [
  "Done",
  "Resolved",
  "Closed",
] as const;

export function isTopicStatusUnresolvedForPublish(status: string): boolean {
  return !(TOPIC_TERMINAL_STATUSES_FOR_PUBLISH as readonly string[]).includes(
    status,
  );
}

/** Todo2D child must reach one of these before parent topic can be Done/Resolved/Closed */
export const TODO_TERMINAL_STATUSES = ["Done", "Closed"] as const;

export function isTodoBlockingParentTopicResolution(status: string): boolean {
  return !(TODO_TERMINAL_STATUSES as readonly string[]).includes(status);
}
