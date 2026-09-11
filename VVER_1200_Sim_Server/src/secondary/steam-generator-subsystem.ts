/**
 * @file steam-generator-subsystem.ts
 * @description Horizontal steam generator (PGV-1000MKP) reduced-order model.
 * Connects primary heat removal to secondary boiling, steam pressure, and water level.
 */

import { ParameterRegistry } from '../core/parameters.js';
import { SteamTables } from '../core/steam-tables.js';

export interface SteamGeneratorStepResult {
  next_T_sg_prim: number; // K
  T_sg_prim_out: number; // K
  Q_sg_MW: number; // MW
  D_steam_kg_s: number; // kg/s
  next_M_sg_water: number; // kg
  next_P_sec: number; // Pa
  level_sg_m: number; // m
  Tsat_sec_K: number; // K
}

export class SteamGeneratorSubsystem {
  private static readonly UA_SG_NOM = ParameterRegistry.get('UA_SG_NOM'); // 116.07 MW/K
  private static readonly M_SG_WATER_NOM = ParameterRegistry.get('M_SG_WATER_NOM'); // 180,000 kg
  private static readonly C_HDR = ParameterRegistry.get('C_STEAM_HEADER'); // 120.0 kg/MPa = 1.2e-4 kg/Pa
  private static readonly T_FW_NOM = ParameterRegistry.get('T_FW_NOM'); // 498.15 K (225 °C)

  // Primary tube bundle thermal mass: ~45,000 kg fluid in tubes * 5500 J/kg*K ≈ 247.5 MJ/K
  private static readonly C_TH_SG_PRIM = 247.5; // MJ/K

  /**
   * Advances the steam generator primary tubes, boiling heat transfer, and secondary steam pressure.
   */
  static step(
    dt: number,
    T_sg_prim: number,
    M_sg_water: number,
    P_sec: number,
    T_hot_leg: number,
    W_prim: number,
    P_prim: number,
    W_fw: number,
    D_turb: number,
    D_bruK: number,
    D_bruA: number = 0.0
  ): SteamGeneratorStepResult {
    // 1. Secondary saturation properties at P_sec
    const Tsat_sec = SteamTables.Tsat(P_sec);
    const h_g_J = SteamTables.hg(P_sec);
    const h_fw_J = SteamTables.h_feedwater(this.T_FW_NOM);
    const deltaH_evap_MJ = Math.max(0.5, (h_g_J - h_fw_J) * 1e-6); // ~1.805 MJ/kg

    // 2. Primary-to-secondary heat transfer
    // Heat transfer degraded if tube bundle is uncovered (M_sg_water < M_nom)
    const levelCoverageFraction = Math.min(1.0, Math.max(0.05, M_sg_water / this.M_SG_WATER_NOM));
    const UA_sg = this.UA_SG_NOM * levelCoverageFraction;

    const deltaT_eff = Math.max(0.0, T_sg_prim - Tsat_sec);
    const Q_sg_MW = UA_sg * deltaT_eff;

    // 3. Primary tube bundle energy balance:
    // C_th * dT_sg_p/dt = W_prim * cp * (T_hl - T_out) - Q_sg
    // T_out = 2 * T_sg_prim - T_hl => (T_hl - T_out) = 2 * (T_hl - T_sg_prim)
    const cp_prim_MJ = SteamTables.cp_water(T_sg_prim, P_prim) * 1e-6;
    const Q_prim_inflow = W_prim * cp_prim_MJ * 2.0 * (T_hot_leg - T_sg_prim);
    const dT_sg_prim_dt = (Q_prim_inflow - Q_sg_MW) / this.C_TH_SG_PRIM;
    const next_T_sg_prim = T_sg_prim + dt * dT_sg_prim_dt;
    const T_sg_prim_out = 2.0 * next_T_sg_prim - T_hot_leg;

    // 4. Secondary boiling and dry steam generation:
    // D_steam = Q_sg / (h_g - h_fw)
    const D_steam_kg_s = Q_sg_MW / deltaH_evap_MJ;

    // 5. Mass balance in secondary water inventory: dM_w/dt = W_fw - D_steam
    const next_M_sg_water = Math.max(10000.0, M_sg_water + dt * (W_fw - D_steam_kg_s));

    // Secondary collapsed level (approx 2.4 m at 180 tons across 4 horizontal SGs)
    const level_sg_m = 2.4 * (next_M_sg_water / this.M_SG_WATER_NOM);

    // 6. Secondary steam header pressure:
    // C_hdr [kg/Pa] * dP_sec/dt = D_steam - D_turb - D_bruK - D_bruA
    const C_hdr_kg_Pa = this.C_HDR * 1e-6; // convert from kg/MPa to kg/Pa
    const netSteamFlow = D_steam_kg_s - D_turb - D_bruK - D_bruA;
    const dP_sec_dt = netSteamFlow / C_hdr_kg_Pa;

    let next_P_sec = Math.max(0.05e6, Math.min(9.0e6, P_sec + dt * dP_sec_dt));

    return {
      next_T_sg_prim,
      T_sg_prim_out,
      Q_sg_MW,
      D_steam_kg_s,
      next_M_sg_water,
      next_P_sec,
      level_sg_m,
      Tsat_sec_K: Tsat_sec
    };
  }
}
