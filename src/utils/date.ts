export function formatDate(date: string): string {
  if (!date) return 'Not scheduled'

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
