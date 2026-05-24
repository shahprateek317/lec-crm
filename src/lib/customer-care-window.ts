// Meta WhatsApp's "customer-care window": free-text replies are allowed
// only within 24 hours of the client's most recent inbound message.
// Outside the window, the centre may only send approved templates.
//
// The window resets every time the client sends another inbound. Surfaced
// in the inbox UI as a banner so coordinators know whether they can type
// free text or must pick a template.

export const CUSTOMER_CARE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WindowStatus = {
  /** True iff free-text replies are allowed right now. */
  open: boolean;
  /** Milliseconds until the window closes. 0 if closed. */
  remainingMs: number;
  /** Friendly label for the banner. */
  label: string;
};

export function customerCareWindow(lastInboundAt: Date | null | undefined): WindowStatus {
  if (!lastInboundAt) {
    return { open: false, remainingMs: 0, label: "No inbound message yet — only templates can be sent." };
  }
  const elapsed = Date.now() - lastInboundAt.getTime();
  const remaining = CUSTOMER_CARE_WINDOW_MS - elapsed;
  if (remaining <= 0) {
    return { open: false, remainingMs: 0, label: "Window closed — use a template to re-engage." };
  }
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const label = hours > 0
    ? `Free reply: ${hours}h ${minutes}m left`
    : `Free reply: ${minutes}m left`;
  return { open: true, remainingMs: remaining, label };
}
