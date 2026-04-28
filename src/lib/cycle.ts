import { addMonths, format, differenceInCalendarDays, isAfter, isBefore, isEqual, parseISO } from "date-fns";

export interface Cycle {
  start: Date;
  end: Date;
  key: string; // e.g. "2026-04" — anchored to the salary-month (start)
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function clampDay(year: number, month: number, day: number) {
  // month: 0-indexed
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
}

export function getCycleForDate(date: Date | string, salaryDay: number): Cycle {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  const day = d.getDate();
  let year = d.getFullYear();
  let month = d.getMonth(); // 0-indexed

  if (day < salaryDay) {
    // belongs to previous cycle
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }

  const startDay = clampDay(year, month, salaryDay);
  const start = new Date(year, month, startDay);
  // end = day before salary day of next month
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nextSalaryDay = clampDay(nextYear, nextMonth, salaryDay);
  const end = new Date(nextYear, nextMonth, nextSalaryDay - 1);

  const key = `${year}-${pad(month + 1)}`;
  const label = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  return { start, end, key, label };
}

export function getCurrentCycle(salaryDay: number): Cycle {
  return getCycleForDate(new Date(), salaryDay);
}

export function getPreviousCycle(cycle: Cycle, salaryDay: number): Cycle {
  const prevDate = new Date(cycle.start);
  prevDate.setMonth(prevDate.getMonth() - 1);
  return getCycleForDate(prevDate, salaryDay);
}

export function getLastNCycles(n: number, salaryDay: number, anchor?: Date): Cycle[] {
  const cycles: Cycle[] = [];
  let cur = getCycleForDate(anchor ?? new Date(), salaryDay);
  for (let i = 0; i < n; i++) {
    cycles.unshift(cur);
    cur = getPreviousCycle(cur, salaryDay);
  }
  return cycles;
}

export function isDateInCycle(date: Date | string, cycle: Cycle): boolean {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  return (isEqual(d, cycle.start) || isAfter(d, cycle.start)) &&
         (isEqual(d, cycle.end) || isBefore(d, addMonths(cycle.end, 0)) || isEqual(d, cycle.end));
}

export function cycleLength(cycle: Cycle): number {
  return differenceInCalendarDays(cycle.end, cycle.start) + 1;
}

export function daysElapsedInCycle(cycle: Cycle, today: Date = new Date()): number {
  if (isBefore(today, cycle.start)) return 0;
  if (isAfter(today, cycle.end)) return cycleLength(cycle);
  return differenceInCalendarDays(today, cycle.start) + 1;
}

export function daysLeftInCycle(cycle: Cycle, today: Date = new Date()): number {
  return Math.max(0, cycleLength(cycle) - daysElapsedInCycle(cycle, today));
}

export function cycleKeyFor(date: Date | string, salaryDay: number): string {
  return getCycleForDate(date, salaryDay).key;
}
