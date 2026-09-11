/**
 * @file export-csv.ts
 * @description Runs a virtual transient and exports high-resolution timeseries to CSV.
 * Allows visual plotting and verification of dynamic behaviors.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ReactorEngine } from '../simulation/reactor-engine.js';
import { ControlInputs } from '../core/types.js';

console.log('========================================================================');
console.log('  VVER-1200 SIMULATION ENGINE - TRANSIENT CSV EXPORTER');
console.log('========================================================================\n');

const engine = new ReactorEngine();

const inputs: ControlInputs = {
  rodPositionTarget: 0.70,
  rodControlMode: 'MANUAL',
  boronInjectionRate: 0.0,
  boronPumpActive: false,
  pureWaterPumpActive: false,
  turbineValveTarget: 1.00,
  turbineStopValvesOpen: true,
  feedwaterControlMode: 'AUTO',
  feedwaterFlowTarget: 1773.25,
  pzrControlMode: 'AUTO',
  pzrSprayValveTarget: 0.0,
  pzrHeaterPowerTarget: 0.18,
  rcpActive: [true, true, true, true],
  rcpSpeedTarget: 1.0,
  bruKTarget: -1,
  bruATarget: -1,
  gridConnected: true,
  manualScram: false
};

const dt = 0.05; // 50 ms resolution
const totalTimeSeconds = 60.0;
const totalSteps = Math.round(totalTimeSeconds / dt);

const rows: string[] = [];
// CSV Header
rows.push(
  [
    'time_s',
    'power_MW',
    'power_pct',
    'P_electric_MW',
    'T_fuel_C',
    'T_in_C',
    'T_out_C',
    'T_cool_avg_C',
    'P_prim_MPa',
    'P_sec_MPa',
    'D_steam_kg_s',
    'D_turb_kg_s',
    'W_prim_kg_s',
    'level_pzr_m',
    'level_sg_m',
    'reactivity_total_pcm',
    'reactivity_doppler_pcm',
    'reactivity_coolant_pcm',
    'reactivity_rods_pcm'
  ].join(',')
);

console.log(`Simulating ${totalTimeSeconds} seconds of transient at dt = ${dt} s (${totalSteps} steps)...`);

for (let step = 0; step <= totalSteps; step++) {
  const time = step * dt;

  // Transient profile:
  // 0s - 10s: Steady state at 100%
  // 10s - 25s: Rod group 10 raised from 0.70 to 0.74 (power ramp)
  // 25s - 45s: Turbine valve opened to 1.03
  // 45s - 60s: Return toward new steady state
  if (time >= 10.0 && time < 25.0) {
    inputs.rodPositionTarget = 0.74;
  }
  if (time >= 25.0) {
    inputs.turbineValveTarget = 1.03;
  }

  const state = engine.step(dt, inputs);

  // Record row every step (50 ms resolution)
  rows.push(
    [
      time.toFixed(2),
      state.derived.Q_thermal.toFixed(2),
      state.derived.powerPercent.toFixed(2),
      state.derived.P_electric.toFixed(2),
      state.derived.T_fuel_C.toFixed(2),
      state.derived.T_core_in_C.toFixed(2),
      state.derived.T_core_out_C.toFixed(2),
      state.derived.T_cool_avg_C.toFixed(2),
      state.derived.P_prim_MPa.toFixed(3),
      state.derived.P_sec_MPa.toFixed(3),
      state.derived.D_steam_total.toFixed(2),
      state.derived.D_turb.toFixed(2),
      state.internal.W_prim.toFixed(1),
      state.derived.level_pzr_m.toFixed(3),
      state.derived.level_sg_m.toFixed(3),
      state.derived.reactivity_total_pcm.toFixed(2),
      state.derived.reactivity_doppler_pcm.toFixed(2),
      state.derived.reactivity_coolant_pcm.toFixed(2),
      state.derived.reactivity_rods_pcm.toFixed(2)
    ].join(',')
  );
}

const outputPath = path.resolve('simulation_output.csv');
fs.writeFileSync(outputPath, rows.join('\n'), 'utf-8');

console.log(`\nSuccessfully exported ${rows.length - 1} telemetry datapoints to:`);
console.log(`-> ${outputPath}\n`);
console.log('You can now open this CSV in Excel, Python (pandas/matplotlib), or any plotting tool.');
