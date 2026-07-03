/** EGP number -> integer piasters. */
export function toPiasters(egp: number): number {
  return Math.round(egp * 100);
}
/** integer piasters -> EGP number. */
export function toEgp(piasters: number | null): number | null {
  return piasters === null ? null : piasters / 100;
}
