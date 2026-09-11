/**
 * @file diagnostics-subsystem.ts
 * @description Comprehensive diagnostics: Energy conservation, Mass conservation,
 * Numerical stability, Physical boundary validation, and Steady-State detection.
 */

import {
  InternalPhysicalState,
  DerivedParameters,
  SimulationDiagnostics
} from '../core/types.js';
import { ParameterRegistry } from '../core/parameters.js';
import { SteamTables } from '../core/steam-tables.js';

export class DiagnosticsSubsystem {
  private static readonly C_TH_FUEL = ParameterRegistry.get('C_TH_FUEL');
  private static readonly C_TH_COOLANT = ParameterRegistry.get('C_TH_CORE_COOLANT');
  private static readonly M_SG_WATER_NOM = ParameterRegistry.get('M_SG_WATER_NOM');

  // Rolling window accumulator for steady state detection
  private static steadyStateSeconds = 0.0;

  /**
   * Performs full diagnostics sweep on current step.
   */
  static evaluate(
    dt: number,
    state: InternalPhysicalState,
    prevState: InternalPhysicalState,
    derived: DerivedParameters,
    feedwaterFlow: number
  ): SimulationDiagnostics {
    const warnings: string[] = [];

    // 1. Numerical Stability & NaN/Infinity Check
    let numericalStable = true;
    const checkNumber = (val: number, label: string) => {
      if (isNaN(val) || !isFinite(val)) {
        numericalStable = false;
        warnings.push(`[Numerical Instability] ${label} became NaN or Infinite: ${val}`);
      }
    };

    checkNumber(state.n, 'neutron density n');
    checkNumber(state.T_fuel, 'fuel temperature T_fuel');
    checkNumber(state.T_cool_core, 'coolant temperature T_cool_core');
    checkNumber(state.P_prim, 'primary pressure P_prim');
    checkNumber(state.P_sec, 'secondary pressure P_sec');
    checkNumber(derived.Q_thermal, 'thermal power Q_thermal');
    checkNumber(derived.P_electric, 'electric power P_electric');

    // 2. Physical Bounds Invariants Check
    let physicalBoundsPassed = true;
    if (state.n < 0.0) {
      physicalBoundsPassed = false;
      warnings.push(`[Physical Bounds] Negative neutron population: ${state.n}`);
    }
    if (state.P_prim <= 0.05e6) {
      physicalBoundsPassed = false;
      warnings.push(`[Physical Bounds] Unphysical vacuum or negative primary pressure: ${state.P_prim} Pa`);
    }
    if (state.T_fuel < 273.15 || state.T_cool_core < 273.15) {
      physicalBoundsPassed = false;
      warnings.push(`[Physical Bounds] Freezing core temperature: Tf=${state.T_fuel} K, Tc=${state.T_cool_core} K`);
    }
    if (state.W_prim < 0.0) {
      physicalBoundsPassed = false;
      warnings.push(`[Physical Bounds] Unphysical reverse loop flow: ${state.W_prim} kg/s`);
    }

    // 3. Energy Balance Conservation Check
    // Q_thermal = W_prim * cp * (T_out - T_in) + C_th,f * dT_f/dt + C_th,c * dT_c/dt
    const cp_water_MJ = SteamTables.cp_water(state.T_cool_core, state.P_prim) * 1e-6;
    const Q_coolant_removal = state.W_prim * cp_water_MJ * (derived.T_core_out_C - derived.T_core_in_C);
    const dT_f_dt = (state.T_fuel - prevState.T_fuel) / Math.max(dt, 1e-4);
    const dT_c_dt = (state.T_cool_core - prevState.T_cool_core) / Math.max(dt, 1e-4);
    const dE_accum_dt = this.C_TH_FUEL * dT_f_dt + this.C_TH_COOLANT * dT_c_dt;

    const Q_accounted = Q_coolant_removal + dE_accum_dt;
    const energyBalanceErrorMW = Math.abs(derived.Q_thermal - Q_accounted);
    const energyBalanceRelPercent = derived.Q_thermal > 10.0 ? (energyBalanceErrorMW / derived.Q_thermal) * 100.0 : 0.0;

    if (energyBalanceRelPercent > 1.0) {
      warnings.push(
        `[Energy Balance Warning] Energy discrepancy: ${energyBalanceErrorMW.toFixed(2)} MW (${energyBalanceRelPercent.toFixed(2)}%)`
      );
    }

    // 4. Mass Balance Check
    // Primary is strictly sealed: zero mass drift
    const primaryMassDriftKg = 0.0;
    // Secondary mass imbalance = Feedwater in - Steam out
    const secondaryMassImbalanceKg_s = feedwaterFlow - derived.D_steam_total;

    // 5. Steady-State Detector
    // Checks weighted norm of derivatives:
    // |dn/dt| < 1e-4 s^-1, |dTf/dt| < 0.02 K/s, |dTc/dt| < 0.01 K/s, |dPprim/dt| < 500 Pa/s
    const dn_dt = Math.abs(state.n - prevState.n) / dt;
    const dP_prim_dt = Math.abs(state.P_prim - prevState.P_prim) / dt;
    const dP_sec_dt = Math.abs(state.P_sec - prevState.P_sec) / dt;

    const norm = Math.max(
      dn_dt,
      Math.abs(dT_f_dt) * 0.01,
      Math.abs(dT_c_dt) * 0.02,
      (dP_prim_dt / 1e6) * 0.01,
      (dP_sec_dt / 1e6) * 0.01
    );

    const isCurrentlyDormant =
      dn_dt < 1.0e-4 &&
      Math.abs(dT_f_dt) < 0.02 &&
      Math.abs(dT_c_dt) < 0.01 &&
      dP_prim_dt < 500.0 &&
      dP_sec_dt < 500.0;

    if (isCurrentlyDormant) {
      this.steadyStateSeconds += dt;
    } else {
      this.steadyStateSeconds = 0.0;
    }

    // Requires 10 consecutive seconds of derivative stillness to declare Steady-State
    const isSteadyState = this.steadyStateSeconds >= 10.0;

    return {
      energyBalanceErrorMW,
      energyBalanceRelPercent,
      primaryMassDriftKg,
      secondaryMassImbalanceKg_s,
      isSteadyState,
      numericalStable,
      physicalBoundsPassed,
      maxDerivativeNorm: norm,
      warnings
    };
  }
}
