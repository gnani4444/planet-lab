import type { ActivityDefinition, WorldDefinition } from '@/domain';
import { DEFAULT_PARAMS } from '@/domain';
import type { ActivityId, WorldId } from '@/domain';

/** Versioned near-surface reference states. Gravity is constant in this local model. */
export const WORLDS: Record<WorldId, WorldDefinition> = {
  earth: {
    id: 'earth', name: 'Earth', gravityMps2: 9.80665, gasDensityKgM3: 1.225,
    referenceTemperatureK: 288.15, referencePressurePa: 101325,
    sourceUrls: [
      'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
      'https://nssdc.gsfc.nasa.gov/planetary/factsheet/planetfact_notes.html',
      'https://ntrs.nasa.gov/api/citations/20060053240/downloads/20060053240.pdf',
    ],
    conditions: 'Standard gravity and near sea-level dry air at 15 °C. Reference state; local weather is not modelled.',
    visualPreset: { ground: '#675b4d', sky: '#9ec7e8', rock: '#807568' },
  },
  moon: {
    id: 'moon', name: 'Moon', gravityMps2: 1.62, gasDensityKgM3: 0,
    referenceTemperatureK: 250, referencePressurePa: 0,
    sourceUrls: ['https://science.nasa.gov/moon/by-the-numbers/', 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/moon/'],
    conditions: 'Rounded mean surface gravity. Vacuum approximation; temperature is an illustrative reference, not a global surface state.',
    visualPreset: { ground: '#777873', sky: '#101319', rock: '#a4a59e' },
  },
  mars: {
    id: 'mars', name: 'Mars', gravityMps2: 3.71, gasDensityKgM3: 0.016,
    referenceTemperatureK: 210, referencePressurePa: 636,
    sourceUrls: ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
    conditions: 'Rounded mean surface gravity and representative near-surface CO₂ atmosphere. Pressure and density vary with season, elevation, and weather.',
    visualPreset: { ground: '#8b4a32', sky: '#d9a17f', rock: '#b96946' },
  },
};

const commonFlightAssumptions = [
  'Uniform local gravity; no rotation, terrain slope, or lift.',
  'Launch and peak heights measure collision-proxy clearance above flat ground; trajectory coordinates track body centres.',
  'Drag is disabled unless the recipe enables it; drag uses a fixed reference coefficient.',
];

export const ACTIVITIES: Record<ActivityId, ActivityDefinition> = {
  'rover-ramp': {
    id: 'rover-ramp', name: 'Rover ramp', description: 'A controlled rover launch from a short test ramp.',
    parameters: [
      { key: 'launchSpeedMps', label: 'Launch speed', unit: 'm/s', min: 1, max: 20, step: 0.5 },
      { key: 'launchAngleDeg', label: 'Ramp angle', unit: '°', min: 5, max: 45, step: 1 },
    ], defaults: DEFAULT_PARAMS['rover-ramp'], metricIds: ['flightTimeS', 'rangeM', 'peakHeightM', 'impactSpeedMps'],
    durationLimitS: 30, assumptions: [...commonFlightAssumptions, 'Controlled launch. Suspension, tire grip, and drivetrain are not modelled.'], assetIds: ['authored-rover'],
  },
  projectile: {
    id: 'projectile', name: 'Projectile', description: 'Launch a sphere or brick and compare its measured flight.',
    parameters: [
      { key: 'massKg', label: 'Mass', unit: 'kg', min: 0.1, max: 20, step: 0.1 },
      { key: 'speedMps', label: 'Launch speed', unit: 'm/s', min: 0, max: 30, step: 0.5 },
      { key: 'angleDeg', label: 'Launch angle', unit: '°', min: 0, max: 80, step: 1 },
      { key: 'releaseHeightM', label: 'Release height', unit: 'm', min: 0.5, max: 10, step: 0.1 },
    ], defaults: DEFAULT_PARAMS.projectile, metricIds: ['flightTimeS', 'rangeM', 'peakHeightM', 'impactSpeedMps'],
    durationLimitS: 30, assumptions: commonFlightAssumptions, assetIds: [],
  },
  pendulum: {
    id: 'pendulum', name: 'Pendulum', description: 'Measure repeated crossings of a freely swinging bob.',
    parameters: [
      { key: 'lengthM', label: 'Length', unit: 'm', min: 0.5, max: 3, step: 0.1 },
      { key: 'bobMassKg', label: 'Bob mass', unit: 'kg', min: 0.1, max: 10, step: 0.1 },
      { key: 'initialAngleDeg', label: 'Initial angle', unit: '°', min: 5, max: 30, step: 1 },
    ], defaults: DEFAULT_PARAMS.pendulum, metricIds: ['periodS'], durationLimitS: 45,
    assumptions: ['Fixed pivot with rigid, massless string and small numerical damping.', 'Large-angle period differs from the small-angle reference. Bob mass does not set ideal period.'], assetIds: [],
  },
  'wind-tunnel': {
    id: 'wind-tunnel', name: 'Wind tunnel', description: 'Calculate reference drag on a restrained object in a steady flow.',
    parameters: [
      { key: 'windSpeedMps', label: 'Wind speed', unit: 'm/s', min: 0, max: 30, step: 0.5 },
      { key: 'areaM2', label: 'Reference area', unit: 'm²', min: 0.01, max: 1, step: 0.01 },
    ], defaults: DEFAULT_PARAMS['wind-tunnel'], metricIds: ['dragN', 'dynamicPressurePa'], durationLimitS: 1,
    assumptions: ['Steady incompressible reference flow; object orientation is fixed.', 'Drag coefficient is a curated approximation: sphere 0.47, plate 1.28. Flow streaks are illustrative, not a pressure field.'], assetIds: [],
  },
};
