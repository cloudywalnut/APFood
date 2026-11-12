const pickupTime = new Intl.DateTimeFormat("en-MY", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});
const pickupDate = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });

export function pickupWindow(timestamp: string) {
  const start = new Date(timestamp);
  return (
    pickupDate.format(start) +
    " · " +
    pickupTime.format(start) +
    "–" +
    pickupTime.format(new Date(start.getTime() + 900_000)) +
    " MYT"
  );
}
