const SEMVER_PARTS_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(version: string): [number, number, number] | null {
  const match = SEMVER_PARTS_REGEX.exec(version.trim());
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return null;
  }
  return [major, minor, patch];
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    return a.localeCompare(b);
  }
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return pa[2] - pb[2];
}

export function suggestNextMinorSemver(current: string | null | undefined): string {
  const parsed = current ? parseSemver(current) : null;
  if (!parsed) {
    return "1.1.0";
  }
  return `${parsed[0]}.${parsed[1] + 1}.0`;
}
