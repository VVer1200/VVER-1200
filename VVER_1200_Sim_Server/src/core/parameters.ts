/**
 * @file parameters.ts
 * @description Parameter database for VVER-1200 simulation engine.
 * Strictly distinguishes REFERENCE, MVP_SYNTHETIC, and DERIVED parameters.
 */

export type ParameterType = 'REFERENCE' | 'MVP_SYNTHETIC' | 'DERIVED';

export interface ParameterEntry {
  name: string;
  value: number;
  unit: string;
  type: ParameterType;
  description: string;
  sourceOrProvenance: string;
}

export class ParameterRegistry {
  private static parameters: Map<string, ParameterEntry> = new Map();

  static register(entry: ParameterEntry): void {
    this.parameters.set(entry.name, Object.freeze({ ...entry }));
  }

  static get(name: string): number {
    const entry = this.parameters.get(name);
    if (!entry) {
      throw new Error(`[ParameterRegistry] Requested parameter "${name}" is not registered.`);
    }
    return entry.value;
  }

  static getEntry(name: string): ParameterEntry {
    const entry = this.parameters.get(name);
    if (!entry) {
      throw new Error(`[ParameterRegistry] Requested parameter "${name}" is not registered.`);
    }
    return entry;
  }

  static getAll(): ParameterEntry[] {
    return Array.from(this.parameters.values());
  }

  static getByType(type: ParameterType): ParameterEntry[] {
    return Array.from(this.parameters.values()).filter((p) => p.type === type);
  }
}

// -------------------------------------------------------------
// 1. REFERENCE DATA (VVER-1200 V-392M / V-491 Open Published Specs)
// -------------------------------------------------------------

ParameterRegistry.register({
  name: 'N_NOM',
  value: 3200.0,
  unit: 'MW',
  type: 'REFERENCE',
  description: 'Nominal reactor core thermal power',
  sourceOrProvenance: 'VVER-1200 Technical Design Documentation (OKB Gidropress / Rosenergoatom)'
});

ParameterRegistry.register({
  name: 'N_EL_NOM',
  value: 1198.8,
  unit: 'MW',
  type: 'REFERENCE',
  description: 'Nominal turbine generator gross electric power output',
  sourceOrProvenance: 'Turbogenerator K-1200-6.8/50 Datasheet'
});

ParameterRegistry.register({
  name: 'P_PRIM_NOM',
  value: 16.20e6,
  unit: 'Pa',
  type: 'REFERENCE',
  description: 'Nominal primary circuit absolute coolant pressure at core outlet',
  sourceOrProvenance: 'VVER-1200 Technical Operational Limits'
});

ParameterRegistry.register({
  name: 'T_IN_NOM',
  value: 298.2 + 273.15, // 571.35 K
  unit: 'K',
  type: 'REFERENCE',
  description: 'Nominal reactor core inlet coolant temperature (cold leg)',
  sourceOrProvenance: 'VVER-1200 Thermal-Hydraulic Passport'
});

ParameterRegistry.register({
  name: 'T_OUT_NOM',
  value: 328.6 + 273.15, // 601.75 K
  unit: 'K',
  type: 'REFERENCE',
  description: 'Nominal reactor core outlet coolant temperature (hot leg)',
  sourceOrProvenance: 'VVER-1200 Thermal-Hydraulic Passport'
});

ParameterRegistry.register({
  name: 'W_PRIM_NOM',
  value: 17600.0,
  unit: 'kg/s',
  type: 'REFERENCE',
  description: 'Nominal total primary coolant mass flow rate through reactor vessel (4 loops)',
  sourceOrProvenance: '86,000 m3/h at working density ~735 kg/m3'
});

ParameterRegistry.register({
  name: 'P_SEC_NOM',
  value: 7.00e6,
  unit: 'Pa',
  type: 'REFERENCE',
  description: 'Nominal dry saturated steam pressure at steam generator outlet',
  sourceOrProvenance: 'PGV-1000MKP Technical Datasheet'
});

ParameterRegistry.register({
  name: 'D_STEAM_NOM',
  value: 1773.25,
  unit: 'kg/s',
  type: 'REFERENCE',
  description: 'Nominal total steam production rate (4 SGs combined ≈ 6384 t/h)',
  sourceOrProvenance: 'Secondary Cycle Energy Balance at 3200 MWth'
});

ParameterRegistry.register({
  name: 'T_FW_NOM',
  value: 225.0 + 273.15, // 498.15 K
  unit: 'K',
  type: 'REFERENCE',
  description: 'Nominal secondary feedwater temperature after high pressure heaters',
  sourceOrProvenance: 'Secondary Cycle Heat Balance'
});

ParameterRegistry.register({
  name: 'V_PZR_TOTAL',
  value: 79.0,
  unit: 'm^3',
  type: 'REFERENCE',
  description: 'Total internal volume of the pressurizer vessel',
  sourceOrProvenance: 'OKB Gidropress Pressurizer Design'
});

ParameterRegistry.register({
  name: 'BETA_EFF',
  value: 0.0069,
  unit: 'dimensionless',
  type: 'REFERENCE',
  description: 'Total effective delayed neutron fraction (beta_eff)',
  sourceOrProvenance: 'VVER-1200 Core Neutronic Benchmark (Keepin 6-group parameters)'
});

ParameterRegistry.register({
  name: 'LAMBDA_PROMPT',
  value: 2.5e-5,
  unit: 's',
  type: 'REFERENCE',
  description: 'Prompt neutron generation lifetime in core lattice',
  sourceOrProvenance: 'VVER-1200 UO2-H2O Core Physics'
});

// 6-group delayed neutron fractions (sum = 0.0069)
export const BETA_I = [0.000248, 0.001387, 0.001256, 0.002629, 0.000994, 0.000386];
// 6-group decay constants [1/s]
export const LAMBDA_I = [0.0127, 0.0317, 0.115, 0.311, 1.40, 3.87];

// -------------------------------------------------------------
// 2. DERIVED PARAMETERS (Analytically computed from geometry / thermodynamics)
// -------------------------------------------------------------

ParameterRegistry.register({
  name: 'M_FUEL_TOTAL',
  value: 80000.0,
  unit: 'kg',
  type: 'DERIVED',
  description: 'Total equivalent mass of UO2 ceramic fuel pellets across 163 assemblies',
  sourceOrProvenance: '163 FA * ~490 kg UO2 per FA'
});

ParameterRegistry.register({
  name: 'C_TH_FUEL',
  value: 80000.0 * 300.0 * 1e-6, // 24.0 MJ/K
  unit: 'MJ/K',
  type: 'DERIVED',
  description: 'Total lumped thermal heat capacity of fuel pellets',
  sourceOrProvenance: 'M_fuel * cp(UO2 at 600°C ≈ 300 J/kg*K)'
});

ParameterRegistry.register({
  name: 'M_CORE_COOLANT',
  value: 24000.0,
  unit: 'kg',
  type: 'DERIVED',
  description: 'Mass of coolant active in core heated channels',
  sourceOrProvenance: 'Core fluid volume * coolant density (~725 kg/m3)'
});

ParameterRegistry.register({
  name: 'C_TH_CORE_COOLANT',
  value: 24000.0 * 5500.0 * 1e-6, // 132.0 MJ/K
  unit: 'MJ/K',
  type: 'DERIVED',
  description: 'Total thermal heat capacity of core active coolant node',
  sourceOrProvenance: 'M_core_coolant * cp(water at 16.2 MPa, 313°C ≈ 5500 J/kg*K)'
});

ParameterRegistry.register({
  name: 'M_SG_WATER_NOM',
  value: 180000.0,
  unit: 'kg',
  type: 'DERIVED',
  description: 'Total nominal water inventory in secondary side of 4 SGs combined',
  sourceOrProvenance: '4 SGs * 45,000 kg normal boiler water inventory'
});

// -------------------------------------------------------------
// 3. MVP_SYNTHETIC PARAMETERS (Calibrated reduced-order lumped parameters)
// -------------------------------------------------------------

ParameterRegistry.register({
  name: 'ALPHA_FUEL_DOPPLER',
  value: -2.60e-5, // -2.6 pcm/K
  unit: 'dk/k/K',
  type: 'MVP_SYNTHETIC',
  description: 'Lumped fuel Doppler temperature reactivity coefficient',
  sourceOrProvenance: 'Calibrated to yield ~ -750 pcm from 0% to 100% fuel heating'
});

ParameterRegistry.register({
  name: 'ALPHA_COOLANT_TEMP',
  value: -35.0e-5, // -35 pcm/K
  unit: 'dk/k/K',
  type: 'MVP_SYNTHETIC',
  description: 'Lumped moderator temperature/density reactivity coefficient at middle of cycle',
  sourceOrProvenance: 'Typical Middle-of-Cycle (MOC) VVER-1200 operating state'
});

ParameterRegistry.register({
  name: 'ALPHA_BORON',
  value: -10.5e-5, // -10.5 pcm/ppm
  unit: 'dk/k/ppm',
  type: 'MVP_SYNTHETIC',
  description: 'Differential reactivity worth of soluble boric acid concentration',
  sourceOrProvenance: 'Calibrated to critical boron concentration ~650 ppm at MOC'
});

ParameterRegistry.register({
  name: 'UA_FC_NOM',
  value: 11.165,
  unit: 'MW/K',
  type: 'MVP_SYNTHETIC',
  description: 'Lumped equivalent fuel-to-coolant heat transfer conductance',
  sourceOrProvenance: 'Calibrated: 3200 MWth / (T_fuel_nom(600°C) - T_cool_avg(313.4°C))'
});

ParameterRegistry.register({
  name: 'UA_SG_NOM',
  value: 3200.0 / (313.4 - (558.98 - 273.15)), // 3200 / 27.57 ≈ 116.068 MW/K
  unit: 'MW/K',
  type: 'MVP_SYNTHETIC',
  description: 'Total primary-to-secondary heat transfer conductance across 4 SGs',
  sourceOrProvenance: 'Calibrated: 3200 MWth / (T_sg_prim_avg(313.4°C) - Tsat(7.0MPa = 285.83°C))'
});

ParameterRegistry.register({
  name: 'TAU_HOT_LEG',
  value: 1.5,
  unit: 's',
  type: 'MVP_SYNTHETIC',
  description: 'Lumped transport time constant for hot leg fluid node',
  sourceOrProvenance: 'Volume of hot leg pipes / nominal volumetric flow rate'
});

ParameterRegistry.register({
  name: 'TAU_COLD_LEG',
  value: 2.5,
  unit: 's',
  type: 'MVP_SYNTHETIC',
  description: 'Lumped transport time constant for cold leg fluid node',
  sourceOrProvenance: 'Volume of cold leg pipes / nominal volumetric flow rate'
});

ParameterRegistry.register({
  name: 'C_PRESSURIZER',
  value: 750.0,
  unit: 'Pa/kg',
  type: 'MVP_SYNTHETIC',
  description: 'Pressurizer pressure sensitivity factor to surge mass: dP/dM = gamma*P/(V_steam*rho_w)',
  sourceOrProvenance: 'Thermodynamic steam cushion compressibility: 1.3 * 16.2e6 / (38 m3 * 735 kg/m3) ≈ 754 Pa/kg'
});

ParameterRegistry.register({
  name: 'C_STEAM_HEADER',
  value: 120.0,
  unit: 'kg/MPa',
  type: 'MVP_SYNTHETIC',
  description: 'Acoustic mass capacitance of main steam lines and SG vapor dome',
  sourceOrProvenance: 'Secondary steam lines and header inventory compressibility'
});

ParameterRegistry.register({
  name: 'K_TURBINE_VALVE',
  value: 1773.25 / 7.00e6, // ~2.5332e-4 kg/(s*Pa)
  unit: 'kg/(s*Pa)',
  type: 'MVP_SYNTHETIC',
  description: 'Stodola flow conductance coefficient for turbine control valves',
  sourceOrProvenance: 'Calibrated to pass 1773.25 kg/s at 100% open and 7.0 MPa steam'
});

ParameterRegistry.register({
  name: 'J_TURBINE_GENERATOR',
  value: 1.8e5,
  unit: 'kg*m^2',
  type: 'MVP_SYNTHETIC',
  description: 'Lumped moment of inertia of turbine-generator rotating shaft train',
  sourceOrProvenance: 'Mechanical inertia time constant Ta ≈ 9.0 seconds'
});

ParameterRegistry.register({
  name: 'ROD_WORTH_GROUP10',
  value: 0.0120, // 1200 pcm
  unit: 'dk/k',
  type: 'MVP_SYNTHETIC',
  description: 'Total integral reactivity worth of regulating rod group 10',
  sourceOrProvenance: 'Calibrated operational regulating group range'
});

ParameterRegistry.register({
  name: 'ROD_WORTH_SCRAM',
  value: -0.0750, // -7500 pcm
  unit: 'dk/k',
  type: 'MVP_SYNTHETIC',
  description: 'Total shutdown negative reactivity worth of scram rods (AZ)',
  sourceOrProvenance: 'Nuclear safety criteria (> 6000 pcm cold shutdown margin)'
});
