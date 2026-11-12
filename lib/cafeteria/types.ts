export type Bounds = { x: number; y: number; width: number; height: number };
export type CafeteriaArea = Bounds & { id: string; name: string; subtitle: string; fill: string };
export type StallLocation = Bounds & {
  id: string;
  stallId: string;
  areaId: string;
  label: string;
  photo: string;
  photoAlt: string;
};
export type CafeteriaLayout = {
  id: string;
  name: string;
  sample: boolean;
  width: number;
  height: number;
  areas: CafeteriaArea[];
  locations: StallLocation[];
};

/** Stall fields the cafeteria map and previews display. */
export type Vendor = {
  id: string;
  name: string;
  zone: string;
  category: string;
  description: string;
  image: string;
  status: "approved" | "suspended";
  paused: boolean;
  capacity: number;
  lead: number;
  hours: string;
};
