import { z } from "zod";

const observation = z.object({
  current: z.object({
    temperature_2m: z.number().finite().min(-50).max(60),
    precipitation: z.number().finite().nonnegative(),
    weather_code: z.number().int().min(0).max(99),
  }),
});

export function parseCampusWeather(payload: unknown) {
  const current = observation.parse(payload).current;
  const temperatureC = Math.round(current.temperature_2m * 10) / 10;
  const rainy = current.precipitation > 0 || current.weather_code >= 51;
  return {
    weather: (rainy ? "rainy" : "hot") as "rainy" | "hot",
    weatherLabel: `${rainy ? (current.weather_code >= 95 ? "Thunderstorm" : "Rainy") : temperatureC >= 30 ? "Warm & humid" : "Clear"} · ${temperatureC}°C`,
    temperatureC,
    fetchedLive: true,
  };
}

type CampusWeather = Omit<ReturnType<typeof parseCampusWeather>, "temperatureC"> & { temperatureC?: number };
let cache: { expires: number; value: CampusWeather } | undefined;

export async function fetchCampusWeather(fetcher: typeof fetch = fetch) {
  if (cache && cache.expires > Date.now()) return cache.value;
  try {
    const response = await fetcher(
      "https://api.open-meteo.com/v1/forecast?latitude=3.0554&longitude=101.7006&current=temperature_2m,precipitation,weather_code&timezone=Asia%2FKuala_Lumpur",
      { signal: AbortSignal.timeout(2500) },
    );
    if (!response.ok) throw new Error("Weather unavailable");
    const value = parseCampusWeather(await response.json());
    cache = { expires: Date.now() + 10 * 60_000, value };
    return value;
  } catch {
    const value = {
      weather: "hot" as const,
      weatherLabel: "Weather unavailable · warm-weather assumption",
      temperatureC: undefined,
      fetchedLive: false,
    };
    cache = { expires: Date.now() + 2 * 60_000, value };
    return value;
  }
}
