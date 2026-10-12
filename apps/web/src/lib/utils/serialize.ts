/**
 * Server → Client Component serialization helper.
 *
 * Prisma returns `Decimal` instances for `Decimal` columns (prices, amounts…).
 * React Server Components cannot pass class instances to Client Components, so
 * rendering a page that hands a raw Prisma row to a "use client" component
 * throws at runtime ("Decimal objects are not supported").
 *
 * `serialize()` deep-converts every Decimal to a plain `number` (Dates are kept,
 * React supports them) and the `Serialized<T>` type mirrors that conversion.
 */
import { Prisma } from "@bookflow/database";

export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

function walk(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (Array.isArray(value)) return value.map(walk);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
}

export function serialize<T>(value: T): Serialized<T> {
  return walk(value) as Serialized<T>;
}
