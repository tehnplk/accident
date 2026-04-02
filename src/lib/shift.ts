const SHIFT_LABELS = {
  morning: "\u0E40\u0E27\u0E23\u0E40\u0E0A\u0E49\u0E32",
  afternoon: "\u0E40\u0E27\u0E23\u0E1A\u0E48\u0E32\u0E22",
  night: "\u0E40\u0E27\u0E23\u0E14\u0E36\u0E01",
} as const;

function isBrokenLabel(value: string | null | undefined) {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || /^\?+$/.test(trimmed);
}

function parseVisitTime(value: string | null | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return hour * 60 + minute;
}

export function deriveShiftNameFromTime(visitTime: string | null | undefined) {
  const minutes = parseVisitTime(visitTime);
  if (minutes === null) return null;

  if (minutes >= 8 * 60 && minutes < 16 * 60) {
    return SHIFT_LABELS.morning;
  }

  if (minutes >= 16 * 60 && minutes <= 23 * 60 + 59) {
    return SHIFT_LABELS.afternoon;
  }

  return SHIFT_LABELS.night;
}

export function normalizeShiftName(
  visitTime: string | null | undefined,
  shiftName: string | null | undefined,
) {
  if (!isBrokenLabel(shiftName)) return shiftName?.trim() ?? null;
  return deriveShiftNameFromTime(visitTime);
}
