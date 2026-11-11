export interface VersionRequestGate {
  begin(): number;
  isCurrent(requestId: number): boolean;
  cancel(requestId: number): void;
}

export function createVersionRequestGate(): VersionRequestGate;
