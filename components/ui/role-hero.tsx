import type { Role } from "../../lib/types";
export function RoleHero({ role, artworkOnly = false }: { role: Role; artworkOnly?: boolean }) {
  const copy = {
    student: ["APFoods", "Order ahead, pick up on time,", "beat the campus queues."],
    vendor: ["Your kitchen, in sync.", "Prepare with confidence.", "Keep every pickup moving."],
    admin: ["A clearer campus day.", "Keep your cafeteria connected,", "from first order to final pickup."],
  }[role];
  const image = (
    <img
      src={"/illustrations/" + role + ".webp"}
      alt={
        role === "student"
          ? "Illustrated plate of chicken curry, rice and vegetables"
          : role === "vendor"
            ? "Illustrated chef hat, apron and takeaway meal"
            : "Illustrated operations clipboard and calculator"
      }
      width="400"
      height="300"
    />
  );
  return artworkOnly ? (
    <div className="ap-auth-art">{image}</div>
  ) : (
    <section className="ap-role-hero">
      <div>
        <h2>{copy[0]}</h2>
        <p>
          {copy[1]}
          <br />
          {copy[2]}
        </p>
      </div>
      <div className="ap-role-hero-art">{image}</div>
    </section>
  );
}
