export function dateFmt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function monthFmt(month: string): string {
  const [y, m] = month.split("-");
  const names = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return month;
  return `${names[idx]} ${y}`;
}

export function weekdayLabel(weekday: number): string {
  return ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][weekday] ?? "?";
}

export function fmtDateLong(iso: string | null): string {
  if (!iso) return "—";
  return dateFmt(iso);
}
