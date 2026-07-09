// <input type="datetime-local"> works in local time with no timezone info, in the
// "YYYY-MM-DDTHH:mm" format. These convert to/from a real Date at the value's
// local-time meaning (new Date(...) already parses that format as local time).
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
