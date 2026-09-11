/**
 * @file primary-loop-subsystem.ts
 * @description Reduced-order primary circuit loop: Hot leg, Cold leg, Pump hydraulics, and Pressurizer.
 */

import { ParameterRegistry } from '../core/parameters.js';
import { SteamTables } from '../core/steam-tables.js';
import { EquipmentState } from '../core/types.js';

export interface PrimaryLoopStepResult {
  next_T_hot_leg: number; // K
  next_T_cold_leg: number; // K
  next_W_prim: number; // kg/s
  next_P_prim: number; // Pa
  next_M_pzr_water: number; // kg
  level_pzr_m: number; // m
  W_surge_kg_s: number; // kg/s
}

export class PrimaryLoopSubsystem {
  private static readonly TAU_HOT_LEG = ParameterRegistry.get('TAU_HOT_LEG'); // 1.5 s
  private static readonly TAU_COLD_LEG = ParameterRegistry.get('TAU_COLD_LEG'); // 2.5 s
  private static readonly C_PZR = ParameterRegistry.get('C_PRESSURIZER'); // 1.25e5 Pa/(kg/s)
  private static readonly W_PRIM_NOM = ParameterRegistry.get('W_PRIM_NOM'); // 17600 kg/s
  private static readonly P_PRIM_NOM = ParameterRegistry.get('P_PRIM_NOM'); // 16.2 MPa

  // Pressurizer cross-sectional area: V = 79 m3, height ≈ 14 m => A ≈ 5.64 m2
  private static readonly A_PZR = 5.64;
  private static readonly NOMINAL_PZR_WATER_MASS = 22500.0; // kg (gives ~5.5 m water level)

  /**
   * Advances the primary loop transport delays, momentum, and pressurizer pressure.
   */
  static step(
    dt: number,
    T_hot_leg: number,
    T_cold_leg: number,
    W_prim: number,
    P_prim: number,
    M_pzr_water: number,
    T_core_out: number,
    T_sg_prim_out: number,
    T_cool_avg: number,
    prev_T_cool_avg: number,
    equipment: EquipmentState
  ): PrimaryLoopStepResult {
    // 1. Hot Leg Transport Delay: tau_hl * dT_hl/dt = T_core_out - T_hl
    const dT_hl_dt = (T_core_out - T_hot_leg) / this.TAU_HOT_LEG;
    const next_T_hot_leg = T_hot_leg + dt * dT_hl_dt;

    // 2. Cold Leg Transport Delay: tau_cl * dT_cl/dt = T_sg_prim_out - T_cl
    const dT_cl_dt = (T_sg_prim_out - T_cold_leg) / this.TAU_COLD_LEG;
    const next_T_cold_leg = T_cold_leg + dt * dT_cl_dt;

    // 3. Reactor Coolant Pumps (RCP) Momentum & Flow Dynamics:
    // Flow depends on operating pump fraction and relative pump speed
    const activeFraction = equipment.rcpCountActive / 4.0;
    const speed = equipment.rcpSpeedActual;
    const pumpHeadFactor = activeFraction * (speed * speed);

    // Natural circulation buoyancy head: deltaP_buoyancy ~ g * beta * rho * deltaZ * (T_hl - T_cl)
    const deltaT_loop = Math.max(0.0, next_T_hot_leg - next_T_cold_leg);
    const naturalCirculationFraction = 0.045 * (deltaT_loop / 30.4); // ~4.5% natural circ at full delta T
    const targetFlowFraction = Math.max(naturalCirculationFraction, pumpHeadFactor);
    const targetFlow = this.W_PRIM_NOM * Math.sqrt(targetFlowFraction);

    // Fluid momentum time constant tau_flow ~ 4.0 s
    const tau_flow = 4.0;
    const next_W_prim = W_prim + dt * ((targetFlow - W_prim) / tau_flow);

    // 4. Pressurizer Dynamics
    // Coolant density and thermal expansion in primary circuit
    const beta_vol = SteamTables.beta_expansion(T_cool_avg);
    const rho_prim = SteamTables.rho_water(T_cool_avg, P_prim);
    const V_prim_active = 450.0; // m3

    // Thermal expansion rate: dV/dt = V * beta * dT/dt
    const dT_cool_dt = (T_cool_avg - prev_T_cool_avg) / Math.max(dt, 1e-4);
    const W_surge = rho_prim * V_prim_active * beta_vol * dT_cool_dt;

    // Spray cooling effect: condensation rate depends on subcooling
    const Tsat_prim = SteamTables.Tsat(P_prim);
    const deltaT_sub = Math.max(0.0, Tsat_prim - next_T_cold_leg); // ~50 K subcooling
    const k_spray_eff = 0.85; // effectiveness factor
    const sprayEffect = equipment.pzrSprayFlowActual * (deltaT_sub / 50.0) * k_spray_eff;

    // Heater pressure generation: 1 MW heaters generate ~0.015 MPa/s
    const heaterEffect = equipment.pzrHeaterPowerActual * 1.5e4; // Pa/s per MW

    // Pressure derivative: dP/dt = C_pzr * (W_surge - sprayEffect) + heaterEffect
    const dP_prim_dt = this.C_PZR * (W_surge - sprayEffect) + heaterEffect;
    let next_P_prim = P_prim + dt * dP_prim_dt;

    // Safety relief valves (IPU PZR) at 17.6 MPa:
    if (next_P_prim > 17.6e6) {
      next_P_prim = 17.6e6; // Blowdown clamping
    }
    // Vacuum protection clamp
    if (next_P_prim < 0.1e6) {
      next_P_prim = 0.1e6;
    }

    // Water mass in pressurizer: dM_w/dt = W_surge + W_spray
    const next_M_pzr_water = Math.max(
      2000.0,
      Math.min(75000.0, M_pzr_water + dt * (W_surge + equipment.pzrSprayFlowActual))
    );

    // Collapsed liquid level in PZR [m]
    const rho_pzr_w = SteamTables.rho_water(Tsat_prim, next_P_prim);
    const level_pzr_m = next_M_pzr_water / (rho_pzr_w * this.A_PZR);

    return {
      next_T_hot_leg,
      next_T_cold_leg,
      next_W_prim,
      next_P_prim,
      next_M_pzr_water,
      level_pzr_m,
      W_surge_kg_s: W_surge
    };
  }
}
