export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const failures: Record<string, [number, string]> = {
  INVALID_PROFILE: [400, "Review the account details."],
  ACCOUNT_NOT_FOUND: [404, "Account unavailable."],
  LAST_ADMIN: [409, "Keep at least one active administrator."],
  CART_CHANGED: [409, "Your cart changed in another window. Review the latest cart."],
  PAYMENT_UNAVAILABLE: [409, "QR payment is unavailable. Choose pay at counter."],
  PAYMENT_REQUIRED: [409, "Payment is required before this order can be prepared."],
  PAYMENT_EXPIRED: [409, "The payment window expired. Check your order and start a new checkout."],
  UNAUTHENTICATED: [401, "Sign in to continue."],
  FORBIDDEN: [403, "This action is unavailable for your account."],
  ORDER_NOT_FOUND: [404, "Order unavailable."],
  STALL_UNAVAILABLE: [409, "This stall is unavailable."],
  INVALID_CART: [400, "Review the items in your cart."],
  INVALID_CHECKOUT: [400, "Review your checkout selections."],
  ITEM_UNAVAILABLE: [409, "An item is no longer available."],
  OUT_OF_STOCK: [409, "An item is out of stock. Update your cart."],
  STOCK_CHANGED: [409, "Stock has changed. Reload the item before editing."],
  PRICE_CHANGED: [409, "The cart changed. Refresh your quote."],
  QUOTE_EXPIRED: [409, "Your quote expired. Choose a new pickup window."],
  QUOTE_USED: [409, "This quote already created an order. Check your order history."],
  SLOT_UNAVAILABLE: [409, "That pickup window is unavailable. Choose another."],
  IDEMPOTENCY_KEY_REUSED: [409, "Start a new checkout attempt for a changed order."],
  CANCELLATION_CLOSED: [409, "The cancellation window has closed."],
  INVALID_TRANSITION: [409, "This order is no longer in the required stage."],
  REASON_REQUIRED: [400, "Enter a reason for this change."],
  PICKUP_ALREADY_USED: [409, "This order was already collected."],
  PICKUP_CODE_INVALID: [409, "The pickup code is invalid or expired."],
  COUNTER_CONFIRMATION_REQUIRED: [400, "Confirm the counter payment first."],
  INVALID_EXPENSE: [400, "Enter a valid paid expense."],
  EXPENSE_UNAVAILABLE: [409, "The expense is unavailable or already reversed."],
};

export function databaseError(error: { code?: string; message: string }) {
  const match = error.code === "P0001" && failures[error.message];
  if (match) return new BackendError(match[0], error.message, match[1]);
  if (error.code === "42501") return new BackendError(403, "FORBIDDEN", failures.FORBIDDEN[1]);
  if (["23503", "23505", "23514"].includes(error.code ?? "")) {
    return new BackendError(409, "CONFLICT", "The requested change conflicts with current data.");
  }
  return new BackendError(500, "DATABASE_ERROR", "The service could not complete this request.");
}

export function unwrap<T>(result: { data: T; error: { code?: string; message: string } | null }) {
  if (result.error) throw databaseError(result.error);
  return result.data;
}
