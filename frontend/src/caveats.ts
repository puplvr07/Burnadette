// Draft caveats text from the team guide (section 8). E refines it.
export const CAVEATS: string[] = [
  "Before 2012, values come from the older MODIS instrument only, scaled to match the newer VIIRS instrument. The scaling is calibrated on 2012 to 2025 and assumes the relationship was the same earlier.",
  "In areas with small fires, the older instrument sees only a fraction of what the newer one sees, so scaled values there are less certain.",
  "A quiet week does not always mean no fire. The data contains no cloud or missing-data information, so cloud cover or no satellite pass can look the same as no burning.",
  "Known gaps: Aqua satellite outage (16 Aug to 2 Sep 2020) and S-NPP VIIRS outage (27 Jul to 10 Aug 2022).",
  "Static heat sources such as industrial sites are removed with NASA's classification plus an extra rule we added, so a few may remain or be removed in error.",
  "Data for the current year may come from near-real-time processing and can be revised later.",
];
