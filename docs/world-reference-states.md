# World reference states

These are versioned, near-surface **approximations** for the local experiment model. Gravity is held constant, and atmospheric density is held constant at the listed surface reference. They are teaching presets, not full atmospheric profiles. The `gasDensityKgM3` field means atmospheric density; it does not mean the solid body's bulk density.

| World | Gravity (m/s²) | Atmosphere density (kg/m³) | Pressure (Pa) | Temperature (K) | Reference and limits |
| --- | ---: | ---: | ---: | ---: | --- |
| Mercury | 3.70 | 0 | 0 | 440 | NASA lists mean surface gravity 3.70 m/s² and black-body temperature 439.6 K. The zero-pressure/density values are a near-vacuum approximation; 440 K is not a uniform ground temperature. |
| Venus | 8.87 | 65 | 9,200,000 | 730 | NASA fact sheets give 8.87 m/s², about 65 kg/m³ surface atmospheric density, about 92 bar, and about 730 K. This is an extreme dense-CO₂ reference. The simulator's constant-Cd quadratic drag is only a simple approximation: no CFD, buoyancy, heat transfer, or material survival is simulated. |
| Titan | 1.35 | 5.43 | 150,000 | 94 | NASA material gives surface gravity about 1.35 m/s², density 5.43 kg/m³, pressure about 1.5 bar, and temperature about 94 K. The atmosphere is mostly nitrogen with methane. The same constant-Cd drag simplification applies; buoyancy, thermal effects, and material survival are excluded. |

## Sources

- Mercury: [NASA NSSDC Mercury Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html); [NASA Mercury facts](https://science.nasa.gov/mercury/facts/).
- Venus: [NASA NSSDC Venus Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html); [NASA Venus-Earth-Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/ves.html); [NASA Venus facts](https://science.nasa.gov/venus/venus-facts/).
- Titan: [NASA Titan facts](https://science.nasa.gov/saturn/moons/titan/facts/) for nitrogen/methane composition and surface environment; [NASA Voyager Fact Sheet](https://science.nasa.gov/mission/voyager/fact-sheet/) for 94 K and 1.5-atmosphere surface values; [NASA technical report](https://ntrs.nasa.gov/api/citations/20220016292/downloads/TM-20220016292.pdf) for 1.35 m/s² gravity and 5.43 kg/m³ surface atmospheric density.

## Activity references

**Free fall** releases an ideal sphere from rest at a configurable height. It measures total flight time and impact speed. Parameters are height 0.5–10 m, mass 0.1–20 kg, and an atmospheric-drag toggle. Mass affects drag response, while ideal vacuum free-fall acceleration is independent of mass.

**Bounce** drops an ideal vertical sphere with no drag and records its first impact and first rebound. Parameters are height 0.5–5 m, restitution 0–0.95, and mass 0.1–10 kg. The ideal prediction is `h′ = e²h`; measured motion may differ because of the simulation's contact and observation step.
