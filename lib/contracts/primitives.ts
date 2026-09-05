/**
 * Shared scalar types.
 *
 * Owned jointly — see SHARED-CONTRACT.md §2. Changes need both of us.
 */

/** ISO-8601 date or date-time, e.g. "2026-07-15" or "2026-07-15T09:30:00Z". */
export type ISODate = string;

export type Id = string;

/**
 * Money in minor units (cents).
 *
 * FR08's amount calculation is deterministic arithmetic over confirmed facts.
 * Floats round badly and the draft has to reconcile to the cent, so nothing in
 * the codebase stores an amount as a number of dollars.
 */
export interface Money {
  readonly currencyCode: "SGD";
  readonly minorUnits: number;
}

export function sgd(dollars: number): Money {
  return { currencyCode: "SGD", minorUnits: Math.round(dollars * 100) };
}

export function addMoney(...amounts: Money[]): Money {
  return {
    currencyCode: "SGD",
    minorUnits: amounts.reduce((sum, m) => sum + m.minorUnits, 0),
  };
}

export function formatMoney(m: Money): string {
  const sign = m.minorUnits < 0 ? "-" : "";
  const abs = Math.abs(m.minorUnits);
  const dollars = Math.floor(abs / 100).toLocaleString("en-SG");
  return `${sign}S$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * How precisely a date is known.
 *
 * FR06: uncertainty about the relevant event date must stay visible. We never
 * collapse an approximate date to an exact one to make a rule fire.
 */
export type DatePrecision =
  | "exact"
  | "month"
  | "year"
  | "approximate"
  | "unknown";

export interface ImpreciseDate {
  /** Null when precision is "unknown". */
  readonly value: ISODate | null;
  readonly precision: DatePrecision;
  /** Plain-language qualifier shown to the user, e.g. "sometime after CNY". */
  readonly note?: string;
}

export const DATE_PRECISION_LABEL: Record<DatePrecision, string> = {
  exact: "Exact date",
  month: "Month known",
  year: "Year known",
  approximate: "Approximate",
  unknown: "Not known",
};
