import type { CafeteriaLayout } from "./types";
export type Selection = {
  areaId?: string;
  stallId?: string;
  itemId?: string;
  hoveredArea?: string;
  hoveredStall?: string;
};
export type SelectionAction =
  | { type: "area"; id: string }
  | { type: "stall"; id: string }
  | { type: "item"; id: string }
  | { type: "hover-area"; id?: string }
  | { type: "hover-stall"; id?: string };
export function select(state: Selection, action: SelectionAction, layout: CafeteriaLayout): Selection {
  switch (action.type) {
    case "hover-area":
      return { ...state, hoveredArea: action.id };
    case "hover-stall":
      return { ...state, hoveredStall: action.id };
    case "area": {
      if (!layout.areas.some((a) => a.id === action.id)) return state;
      const compatible = layout.locations.some((l) => l.areaId === action.id && l.stallId === state.stallId);
      return {
        ...state,
        areaId: action.id,
        stallId: compatible ? state.stallId : undefined,
        itemId: compatible ? state.itemId : undefined,
        hoveredStall: undefined,
      };
    }
    case "stall": {
      const location = layout.locations.find((l) => l.stallId === action.id);
      if (!location) return state;
      return {
        ...state,
        areaId: location.areaId,
        stallId: action.id,
        itemId: state.stallId === action.id ? state.itemId : undefined,
        hoveredStall: undefined,
      };
    }
    case "item":
      return state.stallId ? { ...state, itemId: action.id } : state;
  }
}
