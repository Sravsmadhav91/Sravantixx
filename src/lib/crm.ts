// Shared labels/styles for CRM activity types and task priorities

export const ACTIVITY_TYPE_LABELS = {
  note: "Note",
  call: "Call",
  meeting: "Meeting",
  email: "Email",
  status_change: "Status change",
  booking_created: "Booking created",
  payment_received: "Payment received",
  document_sent: "Document sent",
  task_completed: "Task completed",
} as const;

export const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  note: "📝",
  call: "📞",
  meeting: "🤝",
  email: "✉️",
  status_change: "🔄",
  booking_created: "🏠",
  payment_received: "💸",
  document_sent: "📄",
  task_completed: "✅",
};

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
} as const;

export const PRIORITY_CLASSES = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const;
