/**
 * @file thermal-subsystem.ts
 * @description Two-node core thermal model: lumped fuel mass + equivalent fuel-to-coolant conductance + coolant node.
 * Implements predictor-corrector (Heun) integration for thermodynamic balance.
 */

import { ParameterRegistry } from '../core/parameters.js';
import { SteamTables } from '../core/steam-tables.js';

export interface ThermalCoreStepResult {
  next_T_fuel: number; // K
  next_T_cool_core: number; // K
  T_core_out: number; // K
  T_core_in: number; // K
  Q_fuel_to_coolant_MW: number; // MW
  deltaT_core_K: number; // K
}

export class ThermalSubsystem {
  private static readonly C_TH_FUEL = ParameterRegistry.get('C_TH_FUEL'); // 24.0 MJ/K
  private static readonly C_TH_COOLANT = ParameterRegistry.get('C_TH_CORE_COOLANT'); // 132.0 MJ/K
  private static readonly UA_FC_NOM = ParameterRegistry.get('UA_FC_NOM'); // 11.165 MW/K

  /**
   * Advances the thermal states of fuel and core coolant over timestep dt.
   *
   * @param dt Timestep [s]
   * @param T_fuel Current lumped fuel temperature [K]
   * @param T_cool_core Current average core coolant temperature [K]
   * @param T_in Reactor core inlet coolant temperature (from cold leg) [K]
   * @param W_prim Primary loop total mass flow rate [kg/s]
   * @param P_prim Primary circuit pressure [Pa]
   * @param Q_thermal_MW Total core thermal power produced [MW]
   */
  static step(
    dt: number,
    T_fuel: number,
    T_cool_core: number,
    T_in: number,
    W_prim: number,
    P_prim: number,
    Q_thermal_MW: number
  ): ThermalCoreStepResult {
    // Specific heat of water at current core temperature and pressure [MJ/(kg*K)]
    const cp_water_MJ = SteamTables.cp_water(T_cool_core, P_prim) * 1e-6; // ~0.0055 MJ/(kg*K)

    // Heat transfer from fuel to coolant [MW]
    // Q_fc = (UA)_fc * (T_f - T_c)
    const UA_fc = this.UA_FC_NOM;

    // Evaluates derivatives dT_f/dt and dT_c/dt
    const computeDerivatives = (T_f: number, T_c: number) => {
      const Q_fc = UA_fc * (T_f - T_c);
      // Fuel derivative: C_th,f * dT_f/dt = Q_thermal - Q_fc
      const dT_f_dt = (Q_thermal_MW - Q_fc) / this.C_TH_FUEL;

      // Coolant outlet temperature: T_out = 2 * T_c - T_in
      const T_out = 2.0 * T_c - T_in;
      const Q_coolant_removal = W_prim * cp_water_MJ * (T_out - T_in);

      // Coolant derivative: C_th,c * dT_c/dt = Q_fc - Q_coolant_removal
      const dT_c_dt = (Q_fc - Q_coolant_removal) / this.C_TH_COOLANT;

      return { dT_f_dt, dT_c_dt, Q_fc, T_out };
    };

    // Heun's Predictor-Corrector Method (2nd order ODE integration)
    // 1. Predictor step (Euler)
    const k1 = computeDerivatives(T_fuel, T_cool_core);
    const T_fuel_pred = T_fuel + dt * k1.dT_f_dt;
    const T_cool_pred = T_cool_core + dt * k1.dT_c_dt;

    // 2. Corrector step
    const k2 = computeDerivatives(T_fuel_pred, T_cool_pred);
    const next_T_fuel = T_fuel + 0.5 * dt * (k1.dT_f_dt + k2.dT_f_dt);
    const next_T_cool_core = T_cool_core + 0.5 * dt * (k1.dT_c_dt + k2.dT_c_dt);

    const final_T_out = 2.0 * next_T_cool_core - T_in;
    const final_Q_fc = UA_fc * (next_T_fuel - next_T_cool_core);
    const deltaT_core = final_T_out - T_in;

    return {
      next_T_fuel,
      next_T_cool_core,
      T_core_out: final_T_out,
      T_core_in: T_in,
      Q_fuel_to_coolant_MW: final_Q_fc,
      deltaT_core_K: deltaT_core
    };
  }
}
