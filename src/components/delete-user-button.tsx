"use client";

export function DeleteUserButton({
  id,
  name,
  action,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete ${name}? This cannot be undone.`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-md border border-destructive/50 bg-destructive/10 px-3 text-sm font-medium text-destructive hover:bg-destructive/20"
      >
        Delete this account
      </button>
    </form>
  );
}
