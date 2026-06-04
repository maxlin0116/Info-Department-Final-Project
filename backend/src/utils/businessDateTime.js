const DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const ISO_LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;

function getBusinessTimezoneOffsetMinutes() {
  const parsed = Number.parseInt(process.env.BUSINESS_TIMEZONE_OFFSET_MINUTES || "", 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES;
}

function getBusinessTimezoneOffsetMs() {
  return getBusinessTimezoneOffsetMinutes() * MINUTE_MS;
}

function createBusinessDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - getBusinessTimezoneOffsetMs());
}

function createBusinessDateTime(year, month, day, hours, minutes, seconds = 0) {
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds, 0) - getBusinessTimezoneOffsetMs()
  );
}

function shiftToBusinessTimezone(date) {
  return new Date(date.getTime() + getBusinessTimezoneOffsetMs());
}

function padTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function getBusinessDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  const shifted = shiftToBusinessTimezone(date);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

function parseBusinessDateInput(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(ISO_LOCAL_DATE_PATTERN);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return createBusinessDate(Number(year), Number(month), Number(day));
}

function parseBusinessDateTimeInput(value) {
  if (value instanceof Date) {
    return new Date(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const localMatch = trimmedValue.match(ISO_LOCAL_DATE_TIME_PATTERN);
  if (localMatch) {
    const [, year, month, day, hours, minutes, seconds = "0"] = localMatch;
    return createBusinessDateTime(
      Number(year),
      Number(month),
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatBusinessDate(date) {
  const parts = getBusinessDateParts(date);
  return `${parts.year}-${padTwoDigits(parts.month)}-${padTwoDigits(parts.day)}`;
}

function formatBusinessDisplayDate(date) {
  const parts = getBusinessDateParts(date);
  return `${parts.month}/${parts.day}`;
}

function startOfBusinessDay(date) {
  const parts = getBusinessDateParts(date);
  return createBusinessDate(parts.year, parts.month, parts.day);
}

function endOfBusinessDay(date) {
  return new Date(startOfBusinessDay(date).getTime() + DAY_MS - 1);
}

function addBusinessDays(date, days) {
  return new Date(startOfBusinessDay(date).getTime() + days * DAY_MS);
}

function setTimeOnBusinessDate(date, totalMinutes) {
  return new Date(startOfBusinessDay(date).getTime() + totalMinutes * MINUTE_MS);
}

function getBusinessDayOfWeek(date) {
  return getBusinessDateParts(date).dayOfWeek;
}

function getBusinessMinutesOfDay(date) {
  const parts = getBusinessDateParts(date);
  return parts.hours * 60 + parts.minutes;
}

function isSameBusinessDate(left, right) {
  return formatBusinessDate(left) === formatBusinessDate(right);
}

module.exports = {
  addBusinessDays,
  endOfBusinessDay,
  formatBusinessDate,
  formatBusinessDisplayDate,
  getBusinessDateParts,
  getBusinessDayOfWeek,
  getBusinessMinutesOfDay,
  getBusinessTimezoneOffsetMinutes,
  isSameBusinessDate,
  parseBusinessDateInput,
  parseBusinessDateTimeInput,
  setTimeOnBusinessDate,
  startOfBusinessDay,
};
