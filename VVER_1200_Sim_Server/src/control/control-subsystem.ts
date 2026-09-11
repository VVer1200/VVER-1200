/**
 * @file control-subsystem.ts
 * @description Actuator dynamics, rate limiters, and automated controller loops.
 * Strictly enforces that control inputs cannot instantly change physical states.
 */

import { ControlInputs, EquipmentState, AlarmsState } from '../core/types.js';

export class ControlSubsystem {
  /** Speed of regulating group in normalized position units per second (0 to 1 over ~50 s) */
  private static readonly ROD_SPEED_REG_PER_SEC = 0.02; // 2% per second

  /** Time for scram rods to fully drop to bottom under gravity [s] */
  private static readonly SCRAM_DROP_TIME_S = 3.0;

  /** Maximum turbine valve actuation speed [1/s] (full stroke in 4 seconds) */
  private static readonly TURBINE_VALVE_MAX_RATE = 0.25;

  /** Maximum rate of change of pump speed [1/s] */
  private static readonly PUMP_ACCELERATION_RATE = 0.1;

  /**
   * Advances actuator positions toward operator setpoints according to physical constraints.
   */
  static stepActuators(
    dt: number,
    inputs: ControlInputs,
    currentEquipment: EquipmentState,
    alarms: AlarmsState,
    currentPressurePa: number
  ): EquipmentState {
    const next: EquipmentState = { ...currentEquipment };

    // 1. Emergency Scram (AZ-1) Actuator Logic
    if (inputs.manualScram || alarms.az1Active || next.scramActive) {
      next.scramActive = true;
      // Gravity drop: rods fall to bottom (0.0) rapidly
      const dropRate = 1.0 / this.SCRAM_DROP_TIME_S;
      next.rodPositionActual = Math.max(0.0, next.rodPositionActual - dropRate * dt);
    } else {
      // Normal regulating group motion (rate limited)
      const targetPos = Math.max(0.0, Math.min(1.0, inputs.rodPositionTarget));
      const deltaPos = targetPos - next.rodPositionActual;
      const maxDelta = this.ROD_SPEED_REG_PER_SEC * dt;
      if (Math.abs(deltaPos) <= maxDelta) {
        next.rodPositionActual = targetPos;
      } else {
        next.rodPositionActual += Math.sign(deltaPos) * maxDelta;
      }
    }

    // 2. Turbine Stop Valves (СК ТП) and Throttle Valves (РК ТП)
    next.turbineStopValvesOpen = inputs.turbineStopValvesOpen;

    if (!next.turbineStopValvesOpen) {
      // Fast emergency trip closure of turbine valves
      next.turbineValveActual = Math.max(0.0, next.turbineValveActual - 1.0 * dt);
    } else {
      const targetValve = Math.max(0.0, Math.min(1.1, inputs.turbineValveTarget));
      const deltaValve = targetValve - next.turbineValveActual;
      const maxValveDelta = this.TURBINE_VALVE_MAX_RATE * dt;
      if (Math.abs(deltaValve) <= maxValveDelta) {
        next.turbineValveActual = targetValve;
      } else {
        next.turbineValveActual += Math.sign(deltaValve) * maxValveDelta;
      }
    }

    // 3. Primary Coolant Pumps (4 independent RCPs)
    next.rcpStates = [...inputs.rcpActive];
    next.rcpCountActive = inputs.rcpActive.filter(Boolean).length;

    const targetPumpSpeed = Math.max(0.0, Math.min(1.0, inputs.rcpSpeedTarget));
    const deltaPump = targetPumpSpeed - next.rcpSpeedActual;
    const maxPumpDelta = this.PUMP_ACCELERATION_RATE * dt;
    if (Math.abs(deltaPump) <= maxPumpDelta) {
      next.rcpSpeedActual = targetPumpSpeed;
    } else {
      next.rcpSpeedActual += Math.sign(deltaPump) * maxPumpDelta;
    }

    // 4. Pressurizer Controls (AUTO vs MANUAL)
    if (inputs.pzrControlMode === 'AUTO') {
      const autoPzr = this.computeAutomaticPzrControls(currentPressurePa);
      next.pzrSprayFlowActual = autoPzr.sprayTarget * 150.0;
      next.pzrHeaterPowerActual = autoPzr.heatersTarget;
      next.pzrHeaterGroupsActive = Math.round((autoPzr.heatersTarget / 2.52) * 4);
    } else {
      // Manual control
      const sprayTarget = Math.max(0.0, Math.min(1.0, inputs.pzrSprayValveTarget));
      next.pzrSprayFlowActual = sprayTarget * 150.0;
      next.pzrHeaterPowerActual = Math.max(0.0, Math.min(2.52, inputs.pzrHeaterPowerTarget));
      next.pzrHeaterGroupsActive = Math.round((next.pzrHeaterPowerActual / 2.52) * 4);
    }

    // 5. Grid Breaker
    next.gridBreakerClosed = inputs.gridConnected;

    // 6. Steam Dumps (BRU-K and BRU-A)
    next.bruKActual = inputs.bruKTarget >= 0 ? Math.max(0.0, Math.min(1.0, inputs.bruKTarget)) : 0.0;
    next.bruAActual = inputs.bruATarget >= 0 ? Math.max(0.0, Math.min(1.0, inputs.bruATarget)) : 0.0;

    // 7. Boron & Pure Water Pumps
    next.boronPumpRunning = inputs.boronPumpActive;
    next.pureWaterPumpRunning = inputs.pureWaterPumpActive;

    return next;
  }

  /**
   * Automatic 3-element controller for Steam Generator Feedwater Flow:
   * W_fw = D_steam + Kp * (L_sg - L_set)
   */
  static computeAutomaticFeedwater(
    D_steam: number,
    currentSgLevel: number,
    targetSgLevel: number = 2.4, // nominal level ~2.4 m
    manualTarget: number = -1,
    mode: 'AUTO' | 'MANUAL' = 'AUTO'
  ): number {
    if (mode === 'MANUAL' && manualTarget >= 0) {
      return manualTarget;
    }
    const Kp_level = 180.0; // kg/s per meter level error
    const levelError = currentSgLevel - targetSgLevel;
    const commandedFlow = D_steam - Kp_level * levelError;
    return Math.max(0.0, Math.min(2400.0, commandedFlow));
  }

  /**
   * Automatic Primary Pressure Controller for Pressurizer (Spray & Heaters):
   * Maintains P_prim around 16.20 MPa.
   */
  static computeAutomaticPzrControls(
    P_prim_Pa: number
  ): { sprayTarget: number; heatersTarget: number } {
    const P_MPa = P_prim_Pa * 1e-6;
    let spray = 0.0;
    let heaters = 0.18; // base heaters

    if (P_MPa > 16.35) {
      // Modulate spray linearly between 16.35 and 16.70 MPa
      spray = Math.min(1.0, (P_MPa - 16.35) / 0.35);
      heaters = 0.0;
    } else if (P_MPa < 16.10) {
      spray = 0.0;
      // Turn on proportional heaters below 16.10 MPa, full at 15.90 MPa
      const frac = Math.min(1.0, (16.10 - P_MPa) / 0.20);
      heaters = frac * 2.52;
    }

    return { sprayTarget: spray, heatersTarget: heaters };
  }
}
