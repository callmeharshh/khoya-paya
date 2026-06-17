// Real geography for Simhastha Kumbh 2027 (Nashik–Trimbakeshwar, Maharashtra).
// Used to ground report intake (which sector) and reunion routing (which center).

export const SECTORS = [
  "Ramkund / Panchavati",
  "Tapovan",
  "Kapila Sangam",
  "Trimbakeshwar / Kushavarta",
  "Saadhugram (sadhu camp)",
  "Gandhi Talav",
  "Tapovan Parking",
  "Nashik Road Station",
] as const;

export type Sector = (typeof SECTORS)[number];

// The ~Khoya-Paya Kendras (lost-and-found centers) staffed across the mela.
export const CENTERS: { name: string; sector: Sector }[] = [
  { name: "Khoya-Paya Kendra — Ramkund", sector: "Ramkund / Panchavati" },
  { name: "Khoya-Paya Kendra — Tapovan", sector: "Tapovan" },
  { name: "Khoya-Paya Kendra — Kapila Sangam", sector: "Kapila Sangam" },
  { name: "Khoya-Paya Kendra — Trimbakeshwar", sector: "Trimbakeshwar / Kushavarta" },
  { name: "Khoya-Paya Kendra — Saadhugram", sector: "Saadhugram (sadhu camp)" },
  { name: "Main Control Room — Tapovan HQ", sector: "Tapovan" },
];

export const SECTOR_LIST_TEXT = SECTORS.join(", ");
export const CENTER_LIST_TEXT = CENTERS.map((c) => `${c.name} (${c.sector})`).join(
  "; "
);
