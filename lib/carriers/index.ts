/**
 * Carrier registry. Adding a carrier is one folder under lib/carriers/ and one line here.
 */
import type { CarrierAdapter } from "@/lib/types";
import { harborAdapter } from "./harbor/adapter";

export const carriers: Readonly<Record<string, CarrierAdapter>> = {
  [harborAdapter.id]: harborAdapter,
};

export const carrierIds: readonly string[] = Object.keys(carriers);

export function getCarrier(id: string): CarrierAdapter {
  const adapter = carriers[id];
  if (!adapter) throw new Error(`Unknown carrier "${id}"`);
  return adapter;
}
