/**
 * @file types.ts
 * @description Strongly-typed state definitions and interfaces for the VVER-1200 simulation engine.
 * Separates internal physics, equipment, inputs, derived parameters, alarms, and diagnostics.
 */

/**
 * 6-group delayed neutron precursor concentrations.
 */
export interface DelayedPrecursors {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
}

/**
 * Pure internal physical state vector x(t) ∈ R^21 of the differential algebraic equations.
 */
export interface InternalPhysicalState {
  /** Normalized neutron population (relative to nominal: 1.0 = 3200 MWth prompt) [dimensionless] */
  n: number;
  /** 6-group delayed neutron precursors [dimensionless] */
  precursors: DelayedPrecursors;
  /** Average lumped fuel temperature [K] */
  T_fuel: number;
  /** Average core coolant temperature [K] */
  T_cool_core: number;
  /** Hot leg coolant temperature [K] */
  T_hot_leg: number;
  /** Primary-side tube bundle average temperature in Steam Generator [K] */
  T_sg_prim: number;
  /** Cold leg coolant temperature [K] */
  T_cold_leg: number;
  /** Primary circuit absolute pressure [Pa] */
  P_prim: number;
  /** Pressurizer liquid water mass [kg] */
  M_pzr_water: number;
  /** Pressurizer water temperature [K] */
  T_pzr_water: number;
  /** Total primary circuit coolant mass flow rate [kg/s] */
  W_prim: number;
  /** Secondary-side liquid water mass in Steam Generators [kg] */
  M_sg_water: number;
  /** Secondary-side steam pressure in steam header [Pa] */
  P_sec: number;
  /** Turbine-generator rotor angular speed [rad/s] (nominal 3000 rpm ≈ 314.159 rad/s) */
  omega_turb: number;
  /** Primary coolant average boric acid concentration [ppm] */
  C_boron: number;
  /** Decay heat power component [MW] */
  Q_decay: number;
}

/**
 * Operator / Controller input commands.
 * These are strictly external commands (setpoints/signals), not direct physics overrides.
 */
export interface ControlInputs {
  /** Target position of regulating rod group 10 (0.0 = fully inserted, 1.0 = fully withdrawn) */
  rodPositionTarget: number;
  /** Rod movement mode: 'MANUAL' or 'AUTO' (automatic power regulator) */
  rodControlMode: 'MANUAL' | 'AUTO';
  /** Target boron concentration change rate [ppm/s] (+ for injection, - for pure water dilution) */
  boronInjectionRate: number;
  /** Boron injection pump switch (true = running) */
  boronPumpActive: boolean;
  /** Pure water dilution pump switch (true = running) */
  pureWaterPumpActive: boolean;
  /** Turbine throttle valve position target (0.0 = fully closed, 1.0 = fully open) */
  turbineValveTarget: number;
  /** Turbine Stop Valves (СК ТП) trip / open command (true = open, false = tripped/closed) */
  turbineStopValvesOpen: boolean;
  /** Feedwater control mode: 'AUTO' (3-element level controller) or 'MANUAL' */
  feedwaterControlMode: 'AUTO' | 'MANUAL';
  /** Manual feedwater mass flow rate command [kg/s] (nominal ~1773 kg/s) */
  feedwaterFlowTarget: number;
  /** Pressurizer pressure control mode: 'AUTO' or 'MANUAL' */
  pzrControlMode: 'AUTO' | 'MANUAL';
  /** Pressurizer manual spray valve command (0.0 = closed, 1.0 = fully open) */
  pzrSprayValveTarget: number;
  /** Pressurizer manual heaters power command [MW] (0.0 to 2.52 MW) */
  pzrHeaterPowerTarget: number;
  /** Individual power switches for 4 Main Coolant Pumps (ГЦН 1..4) */
  rcpActive: [boolean, boolean, boolean, boolean];
  /** Target normalized pump speed for primary RCPs (0.0 to 1.0) */
  rcpSpeedTarget: number;
  /** Steam dump to condenser (BRU-K) manual opening command (0.0 to 1.0, -1 = AUTO) */
  bruKTarget: number;
  /** Steam dump to atmosphere (BRU-A) manual opening command (0.0 to 1.0, -1 = AUTO) */
  bruATarget: number;
  /** Generator grid connection state (true = connected to synchronized infinite bus) */
  gridConnected: boolean;
  /** Manual emergency scram command (AZ-1 trip trigger) */
  manualScram: boolean;
}

/**
 * Actual physical state of actuators and plant machinery.
 */
export interface EquipmentState {
  /** Actual physical position of regulating rod group 10 [0.0 .. 1.0] */
  rodPositionActual: number;
  /** Actual turbine throttle valve position [0.0 .. 1.0] */
  turbineValveActual: number;
  /** Actual state of Turbine Stop Valves (СК ТП: true = open, false = slammed shut) */
  turbineStopValvesOpen: boolean;
  /** Actual relative speed of Reactor Coolant Pumps [0.0 .. 1.0] */
  rcpSpeedActual: number;
  /** Individual operational states of 4 Main Coolant Pumps (ГЦН 1..4) */
  rcpStates: [boolean, boolean, boolean, boolean];
  /** Number of currently operating RCPs (0 to 4) */
  rcpCountActive: number;
  /** Actual spray flow into pressurizer [kg/s] */
  pzrSprayFlowActual: number;
  /** Actual heater power in pressurizer [MW] */
  pzrHeaterPowerActual: number;
  /** Number of active heater groups in PZR (0 to 4) */
  pzrHeaterGroupsActive: number;
  /** Emergency protection (AZ-1) scram rod state (true = dropped) */
  scramActive: boolean;
  /** BRU-K actual valve position [0.0 .. 1.0] */
  bruKActual: number;
  /** BRU-A actual valve position [0.0 .. 1.0] */
  bruAActual: number;
  /** Generator breaker state (true = closed / synchronized) */
  gridBreakerClosed: boolean;
  /** Boron pump state */
  boronPumpRunning: boolean;
  /** Pure water pump state */
  pureWaterPumpRunning: boolean;
}

/**
 * Observable / Derived parameters (what gauges, SCADA, and telemetry display).
 */
export interface DerivedParameters {
  /** Prompt fission thermal power [MW] */
  Q_fiss: number;
  /** Total thermal power produced in the core [MW] */
  Q_thermal: number;
  /** Relative thermal power [% of 3200 MW nominal] */
  powerPercent: number;
  /** Heat transferred from fuel to coolant in core [MW] */
  Q_fuel_to_coolant: number;
  /** Heat transferred from primary to secondary in Steam Generators [MW] */
  Q_sg_total: number;
  /** Total dry saturated steam flow generated by SGs [kg/s] */
  D_steam_total: number;
  /** Total dry steam flow through turbine [kg/s] */
  D_turb: number;
  /** Total steam flow dumped through BRU-K [kg/s] */
  D_bruK: number;
  /** Total steam flow dumped through BRU-A [kg/s] */
  D_bruA: number;
  /** Mechanical power developed on turbine shaft [MW] */
  N_turb_mech: number;
  /** Net active electrical power output from generator [MW] */
  P_electric: number;
  /** Reactor core inlet temperature [°C] */
  T_core_in_C: number;
  /** Reactor core outlet temperature [°C] */
  T_core_out_C: number;
  /** Core coolant temperature rise delta T [°C] */
  deltaT_core: number;
  /** Average core coolant temperature [°C] */
  T_cool_avg_C: number;
  /** Average fuel pellet temperature [°C] */
  T_fuel_C: number;
  /** Pressurizer collapsed water level [m] */
  level_pzr_m: number;
  /** Steam generator narrow-range water level [m] */
  level_sg_m: number;
  /** Primary circuit pressure [MPa] */
  P_prim_MPa: number;
  /** Secondary steam pressure [MPa] */
  P_sec_MPa: number;
  /** Total reactivity [pcm] (1 pcm = 10^-5 dk/k) */
  reactivity_total_pcm: number;
  /** Control rod reactivity component [pcm] */
  reactivity_rods_pcm: number;
  /** Fuel Doppler reactivity feedback [pcm] */
  reactivity_doppler_pcm: number;
  /** Coolant temperature/density reactivity feedback [pcm] */
  reactivity_coolant_pcm: number;
  /** Boron reactivity component [pcm] */
  reactivity_boron_pcm: number;
  /** External scenario reactivity perturbation [pcm] */
  reactivity_ext_pcm: number;
  /** Reactor period [s] (positive = power rising, negative = power dropping) */
  reactor_period_s: number;
  /** Generator electrical frequency [Hz] */
  frequency_Hz: number;
}

/**
 * 29 Annunciator / Status Lamp Signals ready for Unity light bulbs and SCADA tiles.
 */
export interface AnnunciatorLamps {
  // RED (Emergency / Trip / Аварийные табло)
  LAMP_AZ1: boolean;               // Срабатывание АЗ-1 (Сброс стержней)
  LAMP_AZ2: boolean;               // Срабатывание АЗ-2
  LAMP_PZ1: boolean;               // Предупредительная защита ПЗ-1
  LAMP_CRIT_POWER: boolean;        // Превышение мощности > 107%
  LAMP_CRIT_PERIOD: boolean;       // Малый период разгона < 10 с
  LAMP_P_PRIM_HIGH_TRIP: boolean;  // Аварийно высокое давление 1 контура > 17.6 МПа
  LAMP_P_PRIM_LOW_TRIP: boolean;   // Аварийно низкое давление 1 контура < 14.5 МПа
  LAMP_T_OUT_HIGH_TRIP: boolean;   // Аварийная температура на выходе из зоны > 335 °C
  LAMP_SG_LEVEL_LOW_TRIP: boolean; // Аварийно низкий уровень в ПГ < 1.8 м
  LAMP_TURBINE_TRIPPED: boolean;   // Аварийный трип турбины (СК посажены)
  LAMP_GRID_DISCONNECT: boolean;   // Генератор отключен от энергосистемы

  // YELLOW (Warnings / Cautions / Предупредительные табло)
  LAMP_POWER_WARN: boolean;        // Предупреждение по мощности > 104%
  LAMP_PERIOD_WARN: boolean;       // Предупреждение по периоду < 20 с
  LAMP_P_PRIM_WARN: boolean;       // Давление 1 контура выше нормы > 16.6 МПа
  LAMP_P_SEC_WARN: boolean;        // Давление пара выше нормы > 7.5 МПа
  LAMP_SG_LEVEL_HIGH: boolean;     // Высокий уровень в ПГ > 2.6 м
  LAMP_RCP1_OFF: boolean;          // Отключен ГЦН-1
  LAMP_RCP2_OFF: boolean;          // Отключен ГЦН-2
  LAMP_RCP3_OFF: boolean;          // Отключен ГЦН-3
  LAMP_RCP4_OFF: boolean;          // Отключен ГЦН-4
  LAMP_BRU_K_OPEN: boolean;        // БРУ-К открыт (сброс в конденсатор)
  LAMP_BRU_A_OPEN: boolean;        // БРУ-А открыт (сброс в атмосферу)
  LAMP_PZR_HEATERS_FULL: boolean;  // Включены все группы ТЭН КД
  LAMP_PZR_SPRAY_ON: boolean;      // Включен впрыск в КД
  LAMP_BORON_INJECTION: boolean;   // Ввод борного концентрата
  LAMP_PURE_WATER: boolean;        // Ввод чистой воды (деборирование)

  // GREEN / WHITE (Status / Штатные режимы)
  LAMP_STEADY_STATE: boolean;      // Реактор в стационаре
  LAMP_GRID_SYNC: boolean;         // Генератор синхронизирован с сетью 50 Гц
  LAMP_ROD_TOP: boolean;           // Стержни СУЗ на верхнем концевике (100%)
  LAMP_ROD_BOTTOM: boolean;        // Стержни СУЗ на нижнем концевике (0%)
  LAMP_AUTO_PRESSURE: boolean;     // Авторегулятор давления 1 контура включен
  LAMP_AUTO_LEVEL_SG: boolean;     // Авторегулятор уровня ПГ включен
}

/**
 * Plant Protection and Alarm States.
 */
export interface AlarmsState {
  /** Emergency Protection AZ-1 actuated */
  az1Active: boolean;
  /** Emergency Protection AZ-2 actuated */
  az2Active: boolean;
  /** Warning Protection PZ-1 actuated */
  pz1Active: boolean;
  /** High reactor thermal power alarm (> 104% nominal) */
  highPowerWarning: boolean;
  /** Critical overpower alarm (> 107% nominal) */
  highPowerTrip: boolean;
  /** Short reactor period alarm (< 20 s) */
  shortPeriodWarning: boolean;
  /** Critical short period alarm (< 10 s) */
  shortPeriodTrip: boolean;
  /** High primary pressure alarm (> 16.6 MPa) */
  highPrimaryPressureWarning: boolean;
  /** Critical primary pressure trip (> 17.6 MPa) */
  highPrimaryPressureTrip: boolean;
  /** Low primary pressure trip (< 14.5 MPa) */
  lowPrimaryPressureTrip: boolean;
  /** Core outlet high temperature alarm (> 335 °C) */
  highCoreOutTempTrip: boolean;
  /** Steam generator low water level alarm (< 1.8 m) */
  lowSgLevelTrip: boolean;
  /** Secondary high steam pressure alarm (> 7.8 MPa) */
  highSecondaryPressureWarning: boolean;
  /** Complete annunciator lamp matrix for Unity rendering */
  lamps: AnnunciatorLamps;
}

/**
 * Engineering diagnostics and conservation metrics.
 */
export interface SimulationDiagnostics {
  /** Instantaneous energy balance absolute error [MW] */
  energyBalanceErrorMW: number;
  /** Instantaneous energy balance relative error [% of Q_thermal] */
  energyBalanceRelPercent: number;
  /** Cumulative primary loop coolant mass drift [kg] */
  primaryMassDriftKg: number;
  /** Secondary loop mass imbalance (W_fw - D_steam) [kg/s] */
  secondaryMassImbalanceKg_s: number;
  /** Flag indicating all state derivatives satisfy steady-state criteria */
  isSteadyState: boolean;
  /** Flag indicating no numerical explosion, NaN or Inf in calculations */
  numericalStable: boolean;
  /** Flag indicating all physical boundaries (P > 0, T > 0, n >= 0) are respected */
  physicalBoundsPassed: boolean;
  /** Maximum weighted norm of state derivatives [1/s] */
  maxDerivativeNorm: number;
  /** Diagnostic log messages or warnings from current step */
  warnings: string[];
}

/**
 * Complete immutable snapshot of the reactor power block state at time t.
 */
export interface ReactorState {
  /** Current simulation virtual time elapsed since start [seconds] */
  simulationTime: number;
  /** Discrete simulation step counter */
  stepCount: number;
  /** Pure internal ODE state vector */
  internal: InternalPhysicalState;
  /** Physical state of actuators and machinery */
  equipment: EquipmentState;
  /** Currently applied operator control inputs */
  inputs: ControlInputs;
  /** Derived observable instrument readings */
  derived: DerivedParameters;
  /** Status of alarms and protective automations */
  alarms: AlarmsState;
  /** Conservation laws and numerical diagnostics */
  diagnostics: SimulationDiagnostics;
}

/**
 * Core interface required for any compliant VVER-1200 Simulation Engine.
 */
export interface ReactorModel {
  /**
   * Initializes the simulation engine to reference nominal steady-state or custom partial state.
   */
  initialize(initialConditions?: Partial<InternalPhysicalState>): void;

  /**
   * Executes a single deterministic simulation step of duration dt seconds.
   * @param dt Timestep in seconds (typically 0.01 to 0.05 s)
   * @param inputs Current operator or automation inputs
   * @returns Updated immutable ReactorState
   */
  step(dt: number, inputs: ControlInputs): ReactorState;

  /**
   * Returns current ReactorState without advancing simulation time.
   */
  getState(): ReactorState;

  /**
   * Resets simulation engine to 100% nominal steady-state.
   */
  reset(): void;

  /**
   * Performs deep sanity and validation check on the internal state.
   */
  validateState(): { valid: boolean; errors: string[] };
}
