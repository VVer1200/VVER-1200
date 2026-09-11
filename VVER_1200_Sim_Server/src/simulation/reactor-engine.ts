/**
 * @file reactor-engine.ts
 * @description Master deterministic VVER-1200 simulation engine implementing ReactorModel.
 * Orchestrates all subsystems in strict causal physical sequence per timestep.
 */

import {
  ReactorModel,
  ReactorState,
  InternalPhysicalState,
  ControlInputs,
  EquipmentState,
  DerivedParameters,
  AlarmsState,
  SimulationDiagnostics,
  AnnunciatorLamps
} from '../core/types.js';
import { ParameterRegistry } from '../core/parameters.js';
import { NeutronicsSubsystem } from '../neutronics/neutronics-subsystem.js';
import { ThermalSubsystem } from '../thermal/thermal-subsystem.js';
import { PrimaryLoopSubsystem } from '../primary/primary-loop-subsystem.js';
import { SteamGeneratorSubsystem } from '../secondary/steam-generator-subsystem.js';
import { TurbineGeneratorSubsystem } from '../turbine/turbine-generator-subsystem.js';
import { ControlSubsystem } from '../control/control-subsystem.js';
import { ProtectionSubsystem } from '../protection/protection-subsystem.js';
import { DiagnosticsSubsystem } from '../diagnostics/diagnostics-subsystem.js';
import { ScenarioEngine, ScenarioModifiers } from '../scenarios/scenario-engine.js';

export class ReactorEngine implements ReactorModel {
  private simulationTime: number = 0.0;
  private stepCount: number = 0;

  private internalState!: InternalPhysicalState;
  private equipmentState!: EquipmentState;
  private currentInputs!: ControlInputs;
  private derivedParams!: DerivedParameters;
  private alarmsState!: AlarmsState;
  private diagnostics!: SimulationDiagnostics;

  private scenarioEngine: ScenarioEngine = new ScenarioEngine();

  constructor(initialPartialState?: Partial<InternalPhysicalState>) {
    this.initialize(initialPartialState);
  }

  getScenarioEngine(): ScenarioEngine {
    return this.scenarioEngine;
  }

  private createDefaultLamps(): AnnunciatorLamps {
    return {
      LAMP_AZ1: false,
      LAMP_AZ2: false,
      LAMP_PZ1: false,
      LAMP_CRIT_POWER: false,
      LAMP_CRIT_PERIOD: false,
      LAMP_P_PRIM_HIGH_TRIP: false,
      LAMP_P_PRIM_LOW_TRIP: false,
      LAMP_T_OUT_HIGH_TRIP: false,
      LAMP_SG_LEVEL_LOW_TRIP: false,
      LAMP_TURBINE_TRIPPED: false,
      LAMP_GRID_DISCONNECT: false,
      LAMP_POWER_WARN: false,
      LAMP_PERIOD_WARN: false,
      LAMP_P_PRIM_WARN: false,
      LAMP_P_SEC_WARN: false,
      LAMP_SG_LEVEL_HIGH: false,
      LAMP_RCP1_OFF: false,
      LAMP_RCP2_OFF: false,
      LAMP_RCP3_OFF: false,
      LAMP_RCP4_OFF: false,
      LAMP_BRU_K_OPEN: false,
      LAMP_BRU_A_OPEN: false,
      LAMP_PZR_HEATERS_FULL: false,
      LAMP_PZR_SPRAY_ON: false,
      LAMP_BORON_INJECTION: false,
      LAMP_PURE_WATER: false,
      LAMP_STEADY_STATE: true,
      LAMP_GRID_SYNC: true,
      LAMP_ROD_TOP: false,
      LAMP_ROD_BOTTOM: false,
      LAMP_AUTO_PRESSURE: true,
      LAMP_AUTO_LEVEL_SG: true
    };
  }

  /**
   * Initializes state variables to reference 100% nominal steady-state.
   */
  initialize(initialConditions?: Partial<InternalPhysicalState>): void {
    this.simulationTime = 0.0;
    this.stepCount = 0;

    const n0 = 1.0; // 100% nominal prompt power
    const eqPrecursors = NeutronicsSubsystem.getEquilibriumPrecursors(n0);

    // Reference 100% nominal state
    this.internalState = {
      n: n0,
      precursors: eqPrecursors,
      T_fuel: 600.0 + 273.15, // 873.15 K
      T_cool_core: 313.4 + 273.15, // 586.55 K
      T_hot_leg: 328.6 + 273.15, // 601.75 K
      T_sg_prim: 313.4 + 273.15, // 586.55 K
      T_cold_leg: 298.2 + 273.15, // 571.35 K
      P_prim: ParameterRegistry.get('P_PRIM_NOM'), // 16.20 MPa
      M_pzr_water: 22500.0, // kg
      T_pzr_water: 348.35 + 273.15, // Tsat at 16.2 MPa
      W_prim: ParameterRegistry.get('W_PRIM_NOM'), // 17,600 kg/s
      M_sg_water: ParameterRegistry.get('M_SG_WATER_NOM'), // 180,000 kg
      P_sec: ParameterRegistry.get('P_SEC_NOM'), // 7.00 MPa
      omega_turb: 314.159265, // 3000 rpm
      C_boron: 650.0, // ppm
      Q_decay: 0.065 * 3200.0, // 208 MW
      ...initialConditions
    };

    this.equipmentState = {
      rodPositionActual: 0.70, // 70% nominal position for group 10
      turbineValveActual: 1.00, // 100% open at full load
      turbineStopValvesOpen: true,
      rcpSpeedActual: 1.00,
      rcpStates: [true, true, true, true],
      rcpCountActive: 4,
      pzrSprayFlowActual: 0.0,
      pzrHeaterPowerActual: 0.18, // 180 kW base heaters
      pzrHeaterGroupsActive: 1,
      scramActive: false,
      bruKActual: 0.0,
      bruAActual: 0.0,
      gridBreakerClosed: true,
      boronPumpRunning: false,
      pureWaterPumpRunning: false
    };

    this.currentInputs = {
      rodPositionTarget: 0.70,
      rodControlMode: 'MANUAL',
      boronInjectionRate: 0.0,
      boronPumpActive: false,
      pureWaterPumpActive: false,
      turbineValveTarget: 1.00,
      turbineStopValvesOpen: true,
      feedwaterControlMode: 'AUTO',
      feedwaterFlowTarget: ParameterRegistry.get('D_STEAM_NOM'), // 1773.25 kg/s
      pzrControlMode: 'AUTO',
      pzrSprayValveTarget: 0.0,
      pzrHeaterPowerTarget: 0.18,
      rcpActive: [true, true, true, true],
      rcpSpeedTarget: 1.0,
      bruKTarget: -1, // AUTO
      bruATarget: -1, // AUTO
      gridConnected: true,
      manualScram: false
    };

    this.alarmsState = {
      az1Active: false,
      az2Active: false,
      pz1Active: false,
      highPowerWarning: false,
      highPowerTrip: false,
      shortPeriodWarning: false,
      shortPeriodTrip: false,
      highPrimaryPressureWarning: false,
      highPrimaryPressureTrip: false,
      lowPrimaryPressureTrip: false,
      highCoreOutTempTrip: false,
      lowSgLevelTrip: false,
      highSecondaryPressureWarning: false,
      lamps: this.createDefaultLamps()
    };

    this.derivedParams = {
      Q_fiss: 3200.0,
      Q_thermal: 3200.0,
      powerPercent: 100.0,
      Q_fuel_to_coolant: 3200.0,
      Q_sg_total: 3200.0,
      D_steam_total: 1773.25,
      D_turb: 1773.25,
      D_bruK: 0.0,
      D_bruA: 0.0,
      N_turb_mech: 1200.0,
      P_electric: 1185.6,
      T_core_in_C: 298.2,
      T_core_out_C: 328.6,
      deltaT_core: 30.4,
      T_cool_avg_C: 313.4,
      T_fuel_C: 600.0,
      level_pzr_m: 5.7,
      level_sg_m: 2.4,
      P_prim_MPa: 16.20,
      P_sec_MPa: 7.00,
      reactivity_total_pcm: 0.0,
      reactivity_rods_pcm: 0.0,
      reactivity_doppler_pcm: 0.0,
      reactivity_coolant_pcm: 0.0,
      reactivity_boron_pcm: 0.0,
      reactivity_ext_pcm: 0.0,
      reactor_period_s: 9999.0,
      frequency_Hz: 50.0
    };

    this.diagnostics = {
      energyBalanceErrorMW: 0.0,
      energyBalanceRelPercent: 0.0,
      primaryMassDriftKg: 0.0,
      secondaryMassImbalanceKg_s: 0.0,
      isSteadyState: true,
      numericalStable: true,
      physicalBoundsPassed: true,
      maxDerivativeNorm: 0.0,
      warnings: []
    };
  }

  reset(): void {
    this.initialize();
  }

  getState(): ReactorState {
    return {
      simulationTime: this.simulationTime,
      stepCount: this.stepCount,
      internal: { ...this.internalState, precursors: { ...this.internalState.precursors } },
      equipment: { ...this.equipmentState, rcpStates: [...this.equipmentState.rcpStates] },
      inputs: { ...this.currentInputs, rcpActive: [...this.currentInputs.rcpActive] },
      derived: { ...this.derivedParams },
      alarms: { ...this.alarmsState, lamps: { ...this.alarmsState.lamps } },
      diagnostics: { ...this.diagnostics, warnings: [...this.diagnostics.warnings] }
    };
  }

  /**
   * Advances the simulation by dt seconds following the strict physical sequence.
   */
  step(dt: number, inputs: ControlInputs): ReactorState {
    // Configurable timestep validation
    if (dt <= 0.0 || dt > 0.5) {
      throw new Error(`[ReactorEngine] Invalid timestep dt=${dt} s. Expected 0 < dt <= 0.5 s.`);
    }

    this.currentInputs = { ...inputs, rcpActive: [...inputs.rcpActive] };
    const prevInternal = { ...this.internalState, precursors: { ...this.internalState.precursors } };

    // 1. Evaluate scenario modifiers
    const scenario: ScenarioModifiers = this.scenarioEngine.evaluate(this.simulationTime, this.currentInputs);

    // 2. Actuator dynamics: rate limit physical mechanisms
    this.equipmentState = ControlSubsystem.stepActuators(
      dt,
      this.currentInputs,
      this.equipmentState,
      this.alarmsState,
      this.internalState.P_prim
    );

    // Apply scenario overrides to equipment if present
    if (scenario.rcpCountOverride !== undefined) {
      this.equipmentState.rcpCountActive = scenario.rcpCountOverride;
    }
    if (scenario.forceGridTrip) {
      this.equipmentState.gridBreakerClosed = false;
    }

    // Soluble boron concentration integration:
    // Boron pump injects +0.2 ppm/s, pure water pump dilutes -0.2 ppm/s, or manual rate
    let effectiveBoronRate = this.currentInputs.boronInjectionRate;
    if (this.currentInputs.boronPumpActive) effectiveBoronRate += 0.25;
    if (this.currentInputs.pureWaterPumpActive) effectiveBoronRate -= 0.25;
    const next_C_boron = Math.max(0.0, this.internalState.C_boron + dt * effectiveBoronRate);

    // 3. Neutronics & Reactivity Subsystem
    const neutronicsRes = NeutronicsSubsystem.step(
      dt,
      this.internalState,
      this.equipmentState,
      scenario.externalReactivity
    );

    // 4. Thermal Core Subsystem (Fuel & Coolant node)
    const T_in_core = this.internalState.T_cold_leg;
    const thermalRes = ThermalSubsystem.step(
      dt,
      this.internalState.T_fuel,
      this.internalState.T_cool_core,
      T_in_core,
      this.internalState.W_prim,
      this.internalState.P_prim,
      neutronicsRes.Q_thermal_MW
    );

    // 5. Steam Generator Subsystem
    // Turbine steam demand calculation for this step
    const flows = TurbineGeneratorSubsystem.computeFlows(this.internalState.P_sec, this.equipmentState);
    const D_turb_current = flows.D_turb;
    const D_bruK_current = flows.D_bruK;
    const D_bruA_current = flows.D_bruA;

    const W_fw = scenario.feedwaterFlowOverride !== undefined
      ? scenario.feedwaterFlowOverride
      : ControlSubsystem.computeAutomaticFeedwater(
          D_turb_current,
          this.derivedParams.level_sg_m,
          2.4,
          this.currentInputs.feedwaterFlowTarget >= 0 ? this.currentInputs.feedwaterFlowTarget : -1,
          this.currentInputs.feedwaterControlMode
        );

    const sgRes = SteamGeneratorSubsystem.step(
      dt,
      this.internalState.T_sg_prim,
      this.internalState.M_sg_water,
      this.internalState.P_sec,
      this.internalState.T_hot_leg,
      this.internalState.W_prim,
      this.internalState.P_prim,
      W_fw,
      D_turb_current,
      D_bruK_current,
      D_bruA_current
    );

    // 6. Primary Loop Subsystem (Hot leg, Cold leg, Pump momentum, Pressurizer)
    const primaryRes = PrimaryLoopSubsystem.step(
      dt,
      this.internalState.T_hot_leg,
      this.internalState.T_cold_leg,
      this.internalState.W_prim,
      this.internalState.P_prim,
      this.internalState.M_pzr_water,
      thermalRes.T_core_out,
      sgRes.T_sg_prim_out,
      thermalRes.next_T_cool_core,
      this.internalState.T_cool_core,
      this.equipmentState
    );

    // 7. Turbine & Generator Electromechanical Subsystem
    const turbRes = TurbineGeneratorSubsystem.step(
      dt,
      this.internalState.omega_turb,
      sgRes.next_P_sec,
      this.equipmentState
    );

    // Update internal physical state vector
    this.internalState = {
      n: neutronicsRes.next_n,
      precursors: neutronicsRes.next_precursors,
      T_fuel: thermalRes.next_T_fuel,
      T_cool_core: thermalRes.next_T_cool_core,
      T_hot_leg: primaryRes.next_T_hot_leg,
      T_sg_prim: sgRes.next_T_sg_prim,
      T_cold_leg: primaryRes.next_T_cold_leg,
      P_prim: primaryRes.next_P_prim,
      M_pzr_water: primaryRes.next_M_pzr_water,
      T_pzr_water: this.internalState.T_pzr_water,
      W_prim: primaryRes.next_W_prim,
      M_sg_water: sgRes.next_M_sg_water,
      P_sec: sgRes.next_P_sec,
      omega_turb: turbRes.next_omega_turb,
      C_boron: next_C_boron,
      Q_decay: neutronicsRes.next_Q_decay
    };

    // 8. Calculate Observable Derived Parameters
    this.derivedParams = {
      Q_fiss: neutronicsRes.Q_fiss_MW,
      Q_thermal: neutronicsRes.Q_thermal_MW,
      powerPercent: (neutronicsRes.Q_thermal_MW / ParameterRegistry.get('N_NOM')) * 100.0,
      Q_fuel_to_coolant: thermalRes.Q_fuel_to_coolant_MW,
      Q_sg_total: sgRes.Q_sg_MW,
      D_steam_total: sgRes.D_steam_kg_s,
      D_turb: turbRes.D_turb_kg_s,
      D_bruK: turbRes.D_bruK_kg_s,
      D_bruA: turbRes.D_bruA_kg_s,
      N_turb_mech: turbRes.N_turb_mech_MW,
      P_electric: turbRes.P_electric_MW,
      T_core_in_C: thermalRes.T_core_in - 273.15,
      T_core_out_C: thermalRes.T_core_out - 273.15,
      deltaT_core: thermalRes.deltaT_core_K,
      T_cool_avg_C: thermalRes.next_T_cool_core - 273.15,
      T_fuel_C: thermalRes.next_T_fuel - 273.15,
      level_pzr_m: primaryRes.level_pzr_m,
      level_sg_m: sgRes.level_sg_m,
      P_prim_MPa: primaryRes.next_P_prim * 1e-6,
      P_sec_MPa: sgRes.next_P_sec * 1e-6,
      reactivity_total_pcm: neutronicsRes.reactivity_total * 1e5,
      reactivity_rods_pcm: neutronicsRes.reactivity_rods * 1e5,
      reactivity_doppler_pcm: neutronicsRes.reactivity_doppler * 1e5,
      reactivity_coolant_pcm: neutronicsRes.reactivity_coolant * 1e5,
      reactivity_boron_pcm: neutronicsRes.reactivity_boron * 1e5,
      reactivity_ext_pcm: scenario.externalReactivity * 1e5,
      reactor_period_s: neutronicsRes.reactor_period_s,
      frequency_Hz: turbRes.frequency_Hz
    };

    // 9. Run Diagnostics
    this.diagnostics = DiagnosticsSubsystem.evaluate(
      dt,
      this.internalState,
      prevInternal,
      this.derivedParams,
      W_fw
    );

    // 10. Evaluate Plant Protection & All 29 Annunciator Lamps
    this.alarmsState = ProtectionSubsystem.evaluate(
      this.internalState,
      this.derivedParams,
      this.equipmentState,
      this.currentInputs,
      this.diagnostics.isSteadyState,
      this.alarmsState
    );

    this.simulationTime += dt;
    this.stepCount++;

    return this.getState();
  }

  validateState(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const state = this.internalState;

    if (isNaN(state.n) || state.n < 0) errors.push(`Invalid neutron density: ${state.n}`);
    if (isNaN(state.T_fuel) || state.T_fuel < 273.15) errors.push(`Invalid fuel temp: ${state.T_fuel} K`);
    if (isNaN(state.P_prim) || state.P_prim <= 0.05e6) errors.push(`Invalid primary pressure: ${state.P_prim} Pa`);
    if (isNaN(state.P_sec) || state.P_sec <= 0.01e6) errors.push(`Invalid secondary pressure: ${state.P_sec} Pa`);

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
