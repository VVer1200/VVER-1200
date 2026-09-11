/**
 * @file neutronics-subsystem.ts
 * @description Point kinetics with 6 delayed neutron groups, decay heat, and reactivity summation.
 * Utilizes an A-stable semi-implicit stiff integrator for prompt neutrons to ensure stability at any dt.
 */

import { DelayedPrecursors, InternalPhysicalState, EquipmentState } from '../core/types.js';
import { ParameterRegistry, BETA_I, LAMBDA_I } from '../core/parameters.js';

export interface NeutronicsStepResult {
  next_n: number;
  next_precursors: DelayedPrecursors;
  next_Q_decay: number;
  Q_fiss_MW: number;
  Q_thermal_MW: number;
  reactivity_total: number; // dk/k
  reactivity_rods: number; // dk/k
  reactivity_doppler: number; // dk/k
  reactivity_coolant: number; // dk/k
  reactivity_boron: number; // dk/k
  reactor_period_s: number;
  dn_dt: number;
}

export class NeutronicsSubsystem {
  private static readonly BETA_EFF = ParameterRegistry.get('BETA_EFF');
  private static readonly LAMBDA_PROMPT = ParameterRegistry.get('LAMBDA_PROMPT');
  private static readonly N_NOM = ParameterRegistry.get('N_NOM');

  // Nominal reference states for zero feedback deviation:
  private static readonly T_FUEL_NOM = 600.0 + 273.15; // 873.15 K
  private static readonly T_COOL_NOM = 313.4 + 273.15; // 586.55 K
  private static readonly C_BORON_NOM = 650.0; // ppm

  // Decay heat constants:
  private static readonly F_DECAY = 0.065; // 6.5% of nominal power
  private static readonly TAU_DECAY = 80.0; // seconds

  /**
   * Evaluates reactivity balance based on control positions, temperatures, and boron.
   */
  static computeReactivity(
    equipment: EquipmentState,
    state: InternalPhysicalState,
    externalReactivityPerturbation: number = 0.0
  ): {
    total: number;
    rods: number;
    doppler: number;
    coolant: number;
    boron: number;
  } {
    const alpha_fuel = ParameterRegistry.get('ALPHA_FUEL_DOPPLER');
    const alpha_cool = ParameterRegistry.get('ALPHA_COOLANT_TEMP');
    const alpha_boron = ParameterRegistry.get('ALPHA_BORON');
    const rod_worth_group10 = ParameterRegistry.get('ROD_WORTH_GROUP10');
    const rod_worth_scram = ParameterRegistry.get('ROD_WORTH_SCRAM');

    // 1. Control Rods (S-curve differential characteristic for group 10)
    // z = 0 (bottom) to 1 (top). At z = 0.70 nominal steady state, reactivity is zeroed by design.
    const z = Math.max(0.0, Math.min(1.0, equipment.rodPositionActual));
    const s_curve = z - (1.0 / (2.0 * Math.PI)) * Math.sin(2.0 * Math.PI * z);
    const z_nom = 0.70;
    const s_nom = z_nom - (1.0 / (2.0 * Math.PI)) * Math.sin(2.0 * Math.PI * z_nom);
    let rho_rods = rod_worth_group10 * (s_curve - s_nom);

    // If scram occurred, add large negative shutdown worth proportional to dropped position
    if (equipment.scramActive) {
      const droppedFraction = 1.0 - z;
      rho_rods += rod_worth_scram * droppedFraction;
    }

    // 2. Fuel Doppler Feedback (Strictly negative with rising fuel temperature)
    const rho_doppler = alpha_fuel * (state.T_fuel - this.T_FUEL_NOM);

    // 3. Coolant Temperature/Density Feedback (Negative with rising coolant temperature)
    const rho_coolant = alpha_cool * (state.T_cool_core - this.T_COOL_NOM);

    // 4. Soluble Boric Acid Reactivity
    const rho_boron = alpha_boron * (state.C_boron - this.C_BORON_NOM);

    // 5. Total Reactivity Summation
    const total = rho_rods + rho_doppler + rho_coolant + rho_boron + externalReactivityPerturbation;

    return {
      total,
      rods: rho_rods,
      doppler: rho_doppler,
      coolant: rho_coolant,
      boron: rho_boron
    };
  }

  /**
   * Advances point kinetics with 6 delayed neutron groups over timestep dt.
   * Employs an analytical / semi-implicit integration scheme to conquer stiffness.
   */
  static step(
    dt: number,
    state: InternalPhysicalState,
    equipment: EquipmentState,
    externalReactivityPerturbation: number = 0.0
  ): NeutronicsStepResult {
    const reac = this.computeReactivity(equipment, state, externalReactivityPerturbation);
    const rho = reac.total;
    const beta = this.BETA_EFF;
    const Lambda = this.LAMBDA_PROMPT;

    // Delayed neutron precursor source sum S_delayed = sum(lambda_i * C_i)
    const p = state.precursors;
    const S_delayed =
      LAMBDA_I[0] * p.c1 +
      LAMBDA_I[1] * p.c2 +
      LAMBDA_I[2] * p.c3 +
      LAMBDA_I[3] * p.c4 +
      LAMBDA_I[4] * p.c5 +
      LAMBDA_I[5] * p.c6;

    // Subcritical source S0 [1/s]
    const S0 = 1.0e-5;

    // Stiff Point Kinetics Integration:
    // dn/dt = (rho - beta)/Lambda * n + S_delayed + S0
    // Using semi-implicit / backward Euler discretization for prompt term:
    // (n_next - n) / dt = (rho - beta)/Lambda * n_next + S_delayed + S0
    // => n_next * (1 - dt * (rho - beta)/Lambda) = n + dt * (S_delayed + S0)
    let denom = 1.0 - dt * ((rho - beta) / Lambda);
    // Numerical safeguard: ensure denominator does not hit singularity near prompt criticality
    if (denom < 0.05) {
      denom = 0.05;
    }

    let next_n = (state.n + dt * (S_delayed + S0)) / denom;
    // Physical bounds protection: neutron density can never be negative
    if (next_n < 0.0 || isNaN(next_n)) {
      next_n = 0.0;
    }

    // Precursors integration using newly computed n_next (Implicit Euler for precursors):
    // dC_i/dt = beta_i/Lambda * n_next - lambda_i * C_i_next
    // => C_i_next = (C_i + dt * beta_i/Lambda * next_n) / (1 + dt * lambda_i)
    const next_c1 = (p.c1 + dt * (BETA_I[0] / Lambda) * next_n) / (1.0 + dt * LAMBDA_I[0]);
    const next_c2 = (p.c2 + dt * (BETA_I[1] / Lambda) * next_n) / (1.0 + dt * LAMBDA_I[1]);
    const next_c3 = (p.c3 + dt * (BETA_I[2] / Lambda) * next_n) / (1.0 + dt * LAMBDA_I[2]);
    const next_c4 = (p.c4 + dt * (BETA_I[3] / Lambda) * next_n) / (1.0 + dt * LAMBDA_I[3]);
    const next_c5 = (p.c5 + dt * (BETA_I[4] / Lambda) * next_n) / (1.0 + dt * LAMBDA_I[4]);
    const next_c6 = (p.c6 + dt * (BETA_I[5] / Lambda) * next_n) / (1.0 + dt * LAMBDA_I[5]);

    // Calculate prompt fission power and decay heat ODE
    const Q_fiss_MW = this.N_NOM * next_n;
    const targetDecayMW = this.F_DECAY * Q_fiss_MW;
    // dQ_decay/dt = (targetDecay - Q_decay) / tau_decay
    const next_Q_decay = state.Q_decay + dt * ((targetDecayMW - state.Q_decay) / this.TAU_DECAY);

    // Total thermal power generated in core [MW]
    const Q_thermal_MW = (1.0 - this.F_DECAY) * Q_fiss_MW + next_Q_decay;

    // Rate of change dn/dt and reactor period
    const dn_dt = (next_n - state.n) / dt;
    let reactor_period_s = 9999.0;
    if (Math.abs(dn_dt) > 1e-6 && next_n > 1e-4) {
      reactor_period_s = next_n / dn_dt;
    }

    return {
      next_n,
      next_precursors: {
        c1: next_c1,
        c2: next_c2,
        c3: next_c3,
        c4: next_c4,
        c5: next_c5,
        c6: next_c6
      },
      next_Q_decay,
      Q_fiss_MW,
      Q_thermal_MW,
      reactivity_total: rho,
      reactivity_rods: reac.rods,
      reactivity_doppler: reac.doppler,
      reactivity_coolant: reac.coolant,
      reactivity_boron: reac.boron,
      reactor_period_s,
      dn_dt
    };
  }

  /**
   * Generates equilibrium precursors for a steady-state power fraction n0.
   */
  static getEquilibriumPrecursors(n0: number): DelayedPrecursors {
    const Lambda = this.LAMBDA_PROMPT;
    return {
      c1: (BETA_I[0] / (LAMBDA_I[0] * Lambda)) * n0,
      c2: (BETA_I[1] / (LAMBDA_I[1] * Lambda)) * n0,
      c3: (BETA_I[2] / (LAMBDA_I[2] * Lambda)) * n0,
      c4: (BETA_I[3] / (LAMBDA_I[3] * Lambda)) * n0,
      c5: (BETA_I[4] / (LAMBDA_I[4] * Lambda)) * n0,
      c6: (BETA_I[5] / (LAMBDA_I[5] * Lambda)) * n0
    };
  }
}
