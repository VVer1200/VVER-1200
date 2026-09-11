/**
 * @file protection-subsystem.ts
 * @description Reactor protection automations (AZ-1, AZ-2, PZ-1) and alarm setpoints.
 * Evaluates all 29 physical annunciator lamps for Unity 3D / SCADA tiles.
 */

import { AlarmsState, DerivedParameters, InternalPhysicalState, EquipmentState, ControlInputs } from '../core/types.js';

export class ProtectionSubsystem {
  /**
   * Evaluates safety thresholds and calculates all 29 annunciator lamp states.
   */
  static evaluate(
    internal: InternalPhysicalState,
    derived: DerivedParameters,
    equipment: EquipmentState,
    inputs: ControlInputs,
    isSteadyState: boolean,
    previousAlarms: AlarmsState
  ): AlarmsState {
    const alarms: AlarmsState = { ...previousAlarms };

    // 1. Power thresholds (Nominal = 3200 MW)
    alarms.highPowerWarning = derived.Q_thermal > 3328.0; // > 104%
    alarms.highPowerTrip = derived.Q_thermal > 3424.0;    // > 107%

    // 2. Reactor period thresholds
    const isRising = derived.reactor_period_s > 0;
    alarms.shortPeriodWarning = isRising && derived.reactor_period_s < 20.0;
    alarms.shortPeriodTrip = isRising && derived.reactor_period_s < 10.0;

    // 3. Primary pressure thresholds (Nominal = 16.20 MPa)
    const P_prim_MPa = internal.P_prim * 1e-6;
    alarms.highPrimaryPressureWarning = P_prim_MPa > 16.60;
    alarms.highPrimaryPressureTrip = P_prim_MPa > 17.60;
    alarms.lowPrimaryPressureTrip = P_prim_MPa < 14.50;

    // 4. Core outlet temperature threshold (Nominal = 328.6 °C)
    alarms.highCoreOutTempTrip = derived.T_core_out_C > 335.0;

    // 5. Steam generator level thresholds (Nominal = 2.4 m)
    alarms.lowSgLevelTrip = derived.level_sg_m < 1.80;
    const sgLevelHigh = derived.level_sg_m > 2.60;

    // 6. Secondary steam pressure threshold (Nominal = 7.00 MPa)
    const P_sec_MPa = internal.P_sec * 1e-6;
    alarms.highSecondaryPressureWarning = P_sec_MPa > 7.50;

    // 7. Master Emergency Protection Trigger (AZ-1)
    if (
      alarms.highPowerTrip ||
      alarms.shortPeriodTrip ||
      alarms.highPrimaryPressureTrip ||
      alarms.lowPrimaryPressureTrip ||
      alarms.highCoreOutTempTrip ||
      alarms.lowSgLevelTrip ||
      equipment.scramActive
    ) {
      alarms.az1Active = true;
    }

    // 8. Warning Protection Trigger (PZ-1)
    if (alarms.highPowerWarning || alarms.shortPeriodWarning || alarms.highPrimaryPressureWarning) {
      alarms.pz1Active = true;
    }

    // 9. 29 Individual Annunciator Lamps for Unity / SCADA
    alarms.lamps = {
      // RED ALARMS
      LAMP_AZ1: alarms.az1Active,
      LAMP_AZ2: alarms.az2Active,
      LAMP_PZ1: alarms.pz1Active,
      LAMP_CRIT_POWER: alarms.highPowerTrip,
      LAMP_CRIT_PERIOD: alarms.shortPeriodTrip,
      LAMP_P_PRIM_HIGH_TRIP: alarms.highPrimaryPressureTrip,
      LAMP_P_PRIM_LOW_TRIP: alarms.lowPrimaryPressureTrip,
      LAMP_T_OUT_HIGH_TRIP: alarms.highCoreOutTempTrip,
      LAMP_SG_LEVEL_LOW_TRIP: alarms.lowSgLevelTrip,
      LAMP_TURBINE_TRIPPED: !equipment.turbineStopValvesOpen || (derived.D_turb <= 0.0 && derived.powerPercent > 20.0),
      LAMP_GRID_DISCONNECT: !equipment.gridBreakerClosed,

      // YELLOW WARNINGS
      LAMP_POWER_WARN: alarms.highPowerWarning,
      LAMP_PERIOD_WARN: alarms.shortPeriodWarning,
      LAMP_P_PRIM_WARN: alarms.highPrimaryPressureWarning,
      LAMP_P_SEC_WARN: alarms.highSecondaryPressureWarning,
      LAMP_SG_LEVEL_HIGH: sgLevelHigh,
      LAMP_RCP1_OFF: !equipment.rcpStates[0],
      LAMP_RCP2_OFF: !equipment.rcpStates[1],
      LAMP_RCP3_OFF: !equipment.rcpStates[2],
      LAMP_RCP4_OFF: !equipment.rcpStates[3],
      LAMP_BRU_K_OPEN: equipment.bruKActual > 0.05 || derived.D_bruK > 10.0,
      LAMP_BRU_A_OPEN: equipment.bruAActual > 0.05 || derived.D_bruA > 10.0,
      LAMP_PZR_HEATERS_FULL: equipment.pzrHeaterGroupsActive >= 3 || equipment.pzrHeaterPowerActual > 1.8,
      LAMP_PZR_SPRAY_ON: equipment.pzrSprayFlowActual > 5.0,
      LAMP_BORON_INJECTION: equipment.boronPumpRunning || inputs.boronInjectionRate > 0.0,
      LAMP_PURE_WATER: equipment.pureWaterPumpRunning || inputs.boronInjectionRate < 0.0,

      // GREEN / WHITE STATUS
      LAMP_STEADY_STATE: isSteadyState,
      LAMP_GRID_SYNC: equipment.gridBreakerClosed && Math.abs(derived.frequency_Hz - 50.0) < 0.2,
      LAMP_ROD_TOP: equipment.rodPositionActual >= 0.99,
      LAMP_ROD_BOTTOM: equipment.rodPositionActual <= 0.01,
      LAMP_AUTO_PRESSURE: inputs.pzrControlMode === 'AUTO',
      LAMP_AUTO_LEVEL_SG: inputs.feedwaterControlMode === 'AUTO'
    };

    return alarms;
  }
}
