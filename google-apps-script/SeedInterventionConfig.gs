/**
 * SeedInterventionConfig.gs
 * Upisuje interventionFaultOptions i interventionErrorOptions u Firestore config.
 *
 * Pokreni: seedInterventionConfig()
 *
 * Upisuje u: tenants/{TENANT_ID}/settings/config
 * Polja: business.interventionFaultOptions, business.interventionErrorOptions
 *
 * Vrednosti su i18n kljucevi — prevodi su u translations kolekciji.
 */

var SEED_TENANT_ID = "ariston_srb";

/** Na koji projekat upisujemo (prod ili test). */
function seedInterventionConfig() {
  seedTo_(FirebaseService.prod(), "PROD");
}

function seedInterventionConfigTest() {
  seedTo_(FirebaseService.test(), "TEST");
}

function seedTo_(fb, label) {
  var collection = "tenants/" + SEED_TENANT_ID + "/settings";
  var docId = "config";

  var faultOptions = {
    "boiler": [
      "fault_boiler_no_heat_light_on",
      "fault_boiler_no_heat_light_off",
      "fault_boiler_trips_breaker",
      "fault_boiler_rattling",
      "fault_boiler_yellow_water",
      "fault_boiler_noise_heating",
      "fault_boiler_heater_leak",
      "fault_boiler_safety_valve_leak",
      "fault_boiler_water_leak",
      "fault_boiler_heater_faulty",
      "fault_boiler_display_faulty",
      "fault_boiler_board_faulty",
      "fault_boiler_smell",
      "fault_boiler_loose_part",
      "fault_boiler_cover",
      "fault_boiler_overheating",
      "fault_boiler_pressure_issue",
      "fault_boiler_tank_leak",
      "fault_boiler_thermostat_faulty",
      "fault_boiler_not_heating",
      "fault_boiler_fast_cooling",
      "fault_boiler_wiring_wrong",
      "fault_boiler_buzzing"
    ],
    "gas-boiler": [
      "fault_common_noise_heating",
      "fault_common_safety_valve_leak",
      "fault_common_water_leak",
      "fault_common_display_faulty",
      "fault_common_gas_valve_faulty",
      "fault_common_board_error",
      "fault_common_exchanger_blocked",
      "fault_common_pump_faulty",
      "fault_common_manometer",
      "fault_common_electrodes_faulty",
      "fault_common_no_modulation",
      "fault_common_loose_part",
      "fault_common_overheating",
      "fault_common_air_pressostat",
      "fault_common_water_pressostat",
      "fault_common_refill_valve",
      "fault_common_ntc_faulty",
      "fault_common_no_ignition",
      "fault_common_fan_faulty",
      "fault_common_servo_motor",
      "fault_common_three_way_valve",
      "fault_common_reed_relay",
      "fault_common_flow_meter",
      "fault_common_three_way_insert",
      "fault_gas_boiler_annual_service"
    ],
    "heat-pump": [
      "fault_common_noise_heating",
      "fault_common_safety_valve_leak",
      "fault_common_water_leak",
      "fault_common_display_faulty",
      "fault_common_gas_valve_faulty",
      "fault_common_board_error",
      "fault_common_exchanger_blocked",
      "fault_common_pump_faulty",
      "fault_common_manometer",
      "fault_common_electrodes_faulty",
      "fault_common_no_modulation",
      "fault_common_loose_part",
      "fault_common_overheating",
      "fault_common_air_pressostat",
      "fault_common_water_pressostat",
      "fault_common_refill_valve",
      "fault_common_ntc_faulty",
      "fault_common_no_ignition",
      "fault_common_fan_faulty",
      "fault_common_servo_motor",
      "fault_common_three_way_valve",
      "fault_common_reed_relay",
      "fault_common_flow_meter",
      "fault_common_three_way_insert"
    ],
    "air-condition": [
      "fault_common_noise_heating",
      "fault_common_safety_valve_leak",
      "fault_common_water_leak",
      "fault_common_display_faulty",
      "fault_common_gas_valve_faulty",
      "fault_common_board_error",
      "fault_common_exchanger_blocked",
      "fault_common_pump_faulty",
      "fault_common_manometer",
      "fault_common_electrodes_faulty",
      "fault_common_no_modulation",
      "fault_common_loose_part",
      "fault_common_overheating",
      "fault_common_air_pressostat",
      "fault_common_water_pressostat",
      "fault_common_refill_valve",
      "fault_common_ntc_faulty",
      "fault_common_no_ignition",
      "fault_common_fan_faulty",
      "fault_common_servo_motor",
      "fault_common_three_way_valve",
      "fault_common_reed_relay",
      "fault_common_flow_meter",
      "fault_common_three_way_insert"
    ]
  };

  var boilerGasAcErrors = [
    "error_no_error",
    "error_101", "error_103", "error_104", "error_105", "error_106", "error_107", "error_108",
    "error_110", "error_112", "error_114", "error_116",
    "error_1p1", "error_1p2", "error_1p3", "error_1p4",
    "error_203", "error_205", "error_209",
    "error_301", "error_302", "error_303", "error_305", "error_306", "error_307", "error_313",
    "error_3p9",
    "error_411", "error_412", "error_413",
    "error_501", "error_502", "error_503", "error_504",
    "error_5p6", "error_5p5", "error_5p3",
    "error_611", "error_612",
    "error_701", "error_702", "error_703",
    "error_711", "error_712", "error_713",
    "error_722", "error_723", "error_750",
    "error_801", "error_802", "error_803", "error_804"
  ];

  var heatPumpErrors = [
    "error_no_error",
    "error_hp_1",
    "error_hp_905", "error_hp_906", "error_hp_907", "error_hp_908", "error_hp_909",
    "error_hp_910", "error_hp_911", "error_hp_912", "error_hp_913", "error_hp_914",
    "error_hp_915", "error_hp_916", "error_hp_917", "error_hp_918", "error_hp_919",
    "error_hp_922", "error_hp_931", "error_hp_947", "error_hp_948", "error_hp_949",
    "error_hp_950", "error_hp_951", "error_hp_952", "error_hp_953", "error_hp_954",
    "error_hp_956", "error_hp_957", "error_hp_960", "error_hp_962", "error_hp_968",
    "error_hp_989", "error_hp_997", "error_hp_998",
    "error_hp_9e5", "error_hp_9e8", "error_hp_9e9",
    "error_hp_9e18", "error_hp_9e21", "error_hp_9e22", "error_hp_9e24", "error_hp_9e25",
    "error_hp_9e28", "error_hp_9e29", "error_hp_9e31", "error_hp_9e32",
    "error_hp_9e34", "error_hp_9e35", "error_hp_9e36", "error_hp_9e37",
    "error_hp_9e38", "error_hp_9e39",
    "error_hp_114", "error_hp_730", "error_hp_731", "error_hp_732",
    "error_hp_902", "error_hp_923", "error_hp_924", "error_hp_927", "error_hp_928",
    "error_hp_933", "error_hp_934", "error_hp_935", "error_hp_936", "error_hp_937",
    "error_hp_938", "error_hp_940", "error_hp_955", "error_hp_970",
    "error_hp_2p2", "error_hp_2p3", "error_hp_2p4", "error_hp_2p5",
    "error_hp_2p7", "error_hp_2p8", "error_hp_2p9"
  ];

  var errorOptions = {
    "boiler": boilerGasAcErrors,
    "gas-boiler": boilerGasAcErrors,
    "air-condition": boilerGasAcErrors,
    "heat-pump": heatPumpErrors
  };

  var data = {
    interventionFaultOptions: faultOptions,
    interventionErrorOptions: errorOptions
  };

  Logger.log("=== SEED " + label + " ===");
  Logger.log("Tenant: " + SEED_TENANT_ID);
  Logger.log("Fault types: " + Object.keys(faultOptions).join(", "));
  Logger.log("Error types: " + Object.keys(errorOptions).join(", "));

  var result = fb.patchFields(collection, docId, data);

  if (result.success) {
    Logger.log("USPESNO upisano u " + label);
  } else {
    Logger.log("GRESKA: " + result.error);
  }
}
