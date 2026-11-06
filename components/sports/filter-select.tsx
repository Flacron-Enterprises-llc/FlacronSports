"use client"

/** Submits its GET form on change. Without scripts the form's own button does the same. */
export function FilterSelect({ id, name, value, className, children }: { id: string; name: string; value: string; className?: string; children: React.ReactNode }) {
  return <select id={id} name={name} defaultValue={value} key={value} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={className}>{children}</select>
}
