// English string catalog. All user-facing strings live here so they can be
// translated later without refactoring the UI. When adding a new locale,
// duplicate this file (e.g. bn.ts) and wire it up in the i18n loader.

export const en = {
  common: {
    appName: "Life Energy Centre",
    tagline: "Pranic Healing — New Town, Kolkata",
    signIn: "Sign in",
    signOut: "Sign out",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    submit: "Submit",
    submitting: "Submitting…",
    loading: "Loading…",
    search: "Search",
    backHome: "Back to home",
    thankYou: "Thank you",
  },
  signIn: {
    title: "Staff sign in",
    subtitle: "Please enter your credentials to continue.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    invalid: "That email and password don't match any active account.",
  },
  enquiry: {
    title: "New enquiry",
    subtitle:
      "Share a few details and a coordinator will reach out within 24 hours to schedule an online counselling session.",
    name: "Full name",
    phone: "Phone (WhatsApp preferred)",
    age: "Age",
    area: "Area / locality",
    issue: "What brings you to us?",
    issuePlaceholder: "Tell us briefly — physical, emotional, or spiritual concern.",
    duration: "How long have you had this?",
    durationPlaceholder: "e.g. 2 weeks, 6 months, several years",
    submit: "Submit enquiry",
    success: "Your enquiry has been received. Namaste 🙏",
    successDetails:
      "A coordinator will message you on WhatsApp shortly. You're welcome to call us at the centre anytime.",
  },
  roles: {
    ADMIN: "Admin",
    COORDINATOR: "Coordinator",
    COUNSELLOR: "Counsellor",
    HEALER: "Healer",
  },
  stages: {
    NEW: "New lead",
    CONTACTED: "Contacted",
    COUNSELING_SCHEDULED: "Counselling scheduled",
    COUNSELING_DONE: "Counselling done",
    VISIT_SCHEDULED: "Visit scheduled",
    VISIT_DONE: "Visit done",
    HEALING_ACTIVE: "Healing active",
    CONVERTED: "Converted",
    ON_HOLD: "On hold",
    LOST: "Lost",
  },
} as const;

export type Messages = typeof en;
