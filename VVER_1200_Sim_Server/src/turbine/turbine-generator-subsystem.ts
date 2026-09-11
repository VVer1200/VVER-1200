/**
 * @file turbine-generator-subsystem.ts
 * @description Reduced-order turbine and synchronous generator electromechanical model.
 * Connects steam pressure to turbine flow, torque, rotational speed, and electric power.
 */

import { ParameterRegistry } from '../core/parameters.js';
import { EquipmentState } from '../core/types.js';

export interface TurbineGeneratorStepResult {
  D_turb_kg_s: number; // kg/s
  D_bruK_kg_s: number; // kg/s
  D_bruA_kg_s: number; // kg/s
  N_turb_mech_MW: number; // MW
  P_electric_MW: number; // MW
  next_omega_turb: number; // rad/s
  frequency_Hz: number; // Hz
}

export class TurbineGeneratorSubsystem {
  private static readonly K_TV = ParameterRegistry.get('K_TURBINE_VALVE'); // 2.5332e-4 kg/(s*Pa)
  private static readonly J_TG = ParameterRegistry.get('J_TURBINE_GENERATOR'); // 1.8e5 kg*m^2
  private static readonly OMEGA_NOM = 314.159265; // rad/s (3000 rpm)
  private static readonly ETA_GEN = 0.988; // 98.8% generator efficiency
  private static readonly P_COND_NOM = 5000.0; // Pa (0.05 bar vacuum in condenser)

  /**
   * Computes exact instantaneous steam flows to turbine and dump valves.
   */
  static computeFlows(
    P_sec: number,
    equipment: EquipmentState
  ): { D_turb: number; D_bruK: number; D_bruA: number } {
    let D_turb = 0.0;

    // Turbine Stop Valves (СК ТП) check: if closed, flow is strictly zero
    if (equipment.turbineStopValvesOpen) {
      const valve = Math.max(0.0, Math.min(1.0, equipment.turbineValveActual));
      const P_ratio = Math.min(1.0, this.P_COND_NOM / Math.max(1000.0, P_sec));
      const expansionFactor = Math.sqrt(Math.max(0.001, 1.0 - P_ratio * P_ratio));
      D_turb = this.K_TV * valve * P_sec * expansionFactor;
    }

    // 1. BRU-K steam dump to condenser
    const K_bruK = ParameterRegistry.get('D_STEAM_NOM') / 7.3e6;
    let bruK_opening = equipment.bruKActual;
    const P_sec_MPa = P_sec * 1e-6;
    if (P_sec_MPa > 7.3) {
      const autoOpen = Math.min(1.0, (P_sec_MPa - 7.3) / 0.5); // full open at 7.8 MPa
      bruK_opening = Math.max(bruK_opening, autoOpen);
    }
    const D_bruK = K_bruK * bruK_opening * P_sec;

    // 2. BRU-A steam dump to atmosphere
    const K_bruA = 1000.0 / 7.5e6;
    let bruA_opening = equipment.bruAActual;
    if (P_sec_MPa > 7.5) {
      const autoOpen = Math.min(1.0, (P_sec_MPa - 7.5) / 0.4); // full open at 7.9 MPa
      bruA_opening = Math.max(bruA_opening, autoOpen);
    }
    const D_bruA = K_bruA * bruA_opening * P_sec;

    return { D_turb, D_bruK, D_bruA };
  }

  /**
   * Advances turbine steam expansion, torque, rotor inertia, and generator electrical output.
   */
  static step(
    dt: number,
    omega_turb: number,
    P_sec: number,
    equipment: EquipmentState
  ): TurbineGeneratorStepResult {
    const { D_turb, D_bruK, D_bruA } = this.computeFlows(P_sec, equipment);

    // Mechanical Power
    const delta_h_MJ = 1200.0 / (ParameterRegistry.get('D_STEAM_NOM') * 0.99); // ~0.6836 MJ/kg
    const eta_mech = 0.99;
    const N_turb_mech = D_turb * delta_h_MJ * eta_mech;

    // Turbine Mechanical Torque
    const currentOmega = Math.max(10.0, omega_turb);
    const M_turb = (N_turb_mech * 1e6) / currentOmega; // N*m

    // Rotor Inertia and Generator Electromechanics
    let next_omega = omega_turb;
    let P_electric = 0.0;

    if (equipment.gridBreakerClosed) {
      // Synchronized to infinite grid: frequency is firmly governed by 50.0 Hz grid
      next_omega = this.OMEGA_NOM;
      P_electric = N_turb_mech * this.ETA_GEN;
    } else {
      // Islanded / Trip / Overspeed mode: swing equation J * domega/dt = M_turb - M_friction
      const D_fric = 250.0; // N*m/(rad/s) bearing and windage friction
      const domega_dt = (M_turb - D_fric * currentOmega) / this.J_TG;
      next_omega = Math.max(0.0, currentOmega + dt * domega_dt);
      P_electric = 0.0;
    }

    const frequency_Hz = next_omega / (2.0 * Math.PI);

    return {
      D_turb_kg_s: D_turb,
      D_bruK_kg_s: D_bruK,
      D_bruA_kg_s: D_bruA,
      N_turb_mech_MW: N_turb_mech,
      P_electric_MW: P_electric,
      next_omega_turb: next_omega,
      frequency_Hz
    };
  }
}
