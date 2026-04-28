import { DeviceType } from '../../../shared/models/device.model';

export interface InterventionHistoryItem {
  id: string;
  date: string;
  dateKey?: string;
  typeLabelKey: string;
  source: 'intervention' | 'registration' | 'commissioning-header';
  clickable: boolean;
}

/** Ordered list of fields to display on intervention detail page. */
export const INTERVENTION_DISPLAY_FIELDS = [
  'interventionType', 'interventionDescription', 'warrantyStatus',
  'sparePart1', 'sparePart2', 'sparePart3', 'sparePart4',
  'addedBy', 'addedDate', 'error', 'note',
];

/** Ordered list of fields to display on registration detail page. */
export const REGISTRATION_DISPLAY_FIELDS = [
  'registeredAt', 'warrantyStatus', 'warrantyDate', 'comment', 'registeredBy',
];

/** Metadata fields excluded from detail display. */
export const HIDDEN_FIELDS = ['sn', 'deviceCode', 'deviceName', 'deviceType', 'exported'];

export enum InterventionType {
  COMMISSIONING = 'commissioning',
  ANNUAL_SERVICE = 'annual_service',
  INTERVENTION_REPAIR = 'intervention_repair',
  INTERVENTION_NOISE = 'intervention_noise',
  INTERVENTION_REPLACE = 'intervention_replace',
}

export interface InterventionTypeOption {
  key: InterventionType;
  label: string;
}

export const COMMISSIONING_TYPES: Partial<Record<DeviceType, InterventionTypeOption>> = {
  [DeviceType.GAS_BOILER]: { key: InterventionType.COMMISSIONING, label: 'intervention_type_commissioning_gas_boiler' },
  [DeviceType.HEAT_PUMP]: { key: InterventionType.COMMISSIONING, label: 'intervention_type_commissioning_heat_pump' },
};

export const ANNUAL_SERVICE_TYPES: Partial<Record<DeviceType, InterventionTypeOption>> = {
  [DeviceType.GAS_BOILER]: { key: InterventionType.ANNUAL_SERVICE, label: 'intervention_type_annual_gas_boiler' },
  [DeviceType.HEAT_PUMP]: { key: InterventionType.ANNUAL_SERVICE, label: 'intervention_type_annual_heat_pump' },
};

export const INTERVENTION_OPTIONS: Partial<Record<DeviceType, InterventionTypeOption[]>> = {
  [DeviceType.BOILER]: [
    { key: InterventionType.INTERVENTION_REPAIR, label: 'intervention_type_repair_boiler' },
    { key: InterventionType.INTERVENTION_NOISE, label: 'intervention_type_noise_boiler' },
    { key: InterventionType.INTERVENTION_REPLACE, label: 'intervention_type_replace_boiler' },
  ],
  [DeviceType.GAS_BOILER]: [
    { key: InterventionType.INTERVENTION_REPAIR, label: 'intervention_type_repair_gas_boiler' },
  ],
  [DeviceType.HEAT_PUMP]: [
    { key: InterventionType.INTERVENTION_REPAIR, label: 'intervention_type_repair_heat_pump' },
  ],
  [DeviceType.AIR_CONDITION]: [
    { key: InterventionType.INTERVENTION_REPAIR, label: 'intervention_type_repair_air_condition' },
  ],
};
/** Maximum spare parts per intervention. */
export const MAX_SPARE_PARTS = 4;

export const COMMISSIONING_DESCRIPTION = 'intervention_description_commissioning';
export const ANNUAL_SERVICE_DESCRIPTION = 'intervention_description_annual_service';

export const DEFAULT_ERROR = 'error_no_error';
export const DEFAULT_DISTANCE = '30';


// [TODO:DELETE] Obrisati FAULT_DESCRIPTIONS, ERROR_CODES, BOILER_GAS_AC_ERRORS i HEAT_PUMP_ERRORS
// nakon što se podaci unesu u Firestore (tenants/{tenantId}/settings/config → business.interventionFaultOptions i business.interventionErrorOptions).
// Ove konstante su ostavljene kao referenca za unos u bazu. Ako su liste u app-u prazne, podaci još nisu uneti.
// Više se ne koriste u kodu — intervention page čita iz ConfigStore.
export const FAULT_DESCRIPTIONS: Record<DeviceType, string[]> = {
  [DeviceType.BOILER]: [
    'NE GREJE, SIJA SIJALICA',
    'NE GREJE, NE SIJA SIJALICA',
    'IZBACUJE SKLOPKA',
    'ZVECKA U BOJLERU',
    'VODA IZ BOJLERA ŽUTA',
    'BUKA PRILIKOM ZAGREVANJA',
    'CURENJE GREJAČA',
    'CURENJE SIGURNOSNOG VENTILA',
    'CURI VODA IZ BOJLERA',
    'GREJAČ NEISPRAVAN',
    'DISPLEJ NEISPRAVAN',
    'ELEKTRONSKA PLOČA NEISPRAVNA',
    'MIRIS PRILIKOM RADA',
    'OLABAVLJEN DEO',
    'POKLOPAC BOJLERA',
    'PREGREVA SE VODA',
    'PROBLEM SA PRITISKOM',
    'PROCUREO KAZAN',
    'TERMOSTAT NEISPRAVAN',
    'UREĐAJ NE GREJE',
    'VODA SE BRZO HLADI',
    'ŽICE GREJAČA VEZANE POGREŠNO',
    'ZUJANJE-PIŠTANJE PRILKOM RADA',
  ],
  [DeviceType.GAS_BOILER]: [
    'BUKA PRILIKOM ZAGREVANJA',
    'CURENJE SIGURNOSNOG VENTILA',
    'CURI VODA IZ KOTLA',
    'NEISPRAVAN DISPLEJ',
    'GASNI VENTIL NEISPRAVAN',
    'GREŠKA ELEKTRONSKE PLOČE',
    'IZMENJIVAČ NE RADI ZAPUŠEN',
    'PUMPA NEISPRAVNA',
    'MANOMETAR NE PRIKAZUJE PRITISAK',
    'NEISPRAVNE ELEKTRODE',
    'NEMA MODULACIJE',
    'OLABAVLJEN DEO',
    'PREGREVA SE VODA',
    'VAZDUŠNI PRESOSTAT NEISPRAVAN',
    'VODENI PRESOSTAT NEISPRAVAN',
    'SLAVINA ZA DOPUNU NIJE ISPRAVNA',
    'NTC T NEISPRAVAN',
    'UREĐAJ NE PALI',
    'VENTILATOR NEISPRAVAN',
    'NEISPRAVAN SERVO MOTOR',
    'NEISPARVAN TROKRAKI VENTIL',
    'NEISPRAVAN REED RELEJ',
    'NEISPRAVAN MERAČ PROTOKA',
    'NEISPAVAN ULOŽAK TROKRAKOG',
    'GODIŠNJI SERVIS',
  ],
  [DeviceType.HEAT_PUMP]: [
    'BUKA PRILIKOM ZAGREVANJA',
    'CURENJE SIGURNOSNOG VENTILA',
    'CURI VODA IZ KOTLA',
    'NEISPRAVAN DISPLEJ',
    'GASNI VENTIL NEISPRAVAN',
    'GREŠKA ELEKTRONSKE PLOČE',
    'IZMENJIVAČ NE RADI ZAPUŠEN',
    'PUMPA NEISPRAVNA',
    'MANOMETAR NE PRIKAZUJE PRITISAK',
    'NEISPRAVNE ELEKTRODE',
    'NEMA MODULACIJE',
    'OLABAVLJEN DEO',
    'PREGREVA SE VODA',
    'VAZDUŠNI PRESOSTAT NEISPRAVAN',
    'VODENI PRESOSTAT NEISPRAVAN',
    'SLAVINA ZA DOPUNU NIJE ISPRAVNA',
    'NTC T NEISPRAVAN',
    'UREĐAJ NE PALI',
    'VENTILATOR NEISPRAVAN',
    'NEISPRAVAN SERVO MOTOR',
    'NEISPARVAN TROKRAKI VENTIL',
    'NEISPRAVAN REED RELEJ',
    'NEISPRAVAN MERAČ PROTOKA',
    'NEISPAVAN ULOŽAK TROKRAKOG',
  ],
  [DeviceType.AIR_CONDITION]: [
    'BUKA PRILIKOM ZAGREVANJA',
    'CURENJE SIGURNOSNOG VENTILA',
    'CURI VODA IZ KOTLA',
    'NEISPRAVAN DISPLEJ',
    'GASNI VENTIL NEISPRAVAN',
    'GREŠKA ELEKTRONSKE PLOČE',
    'IZMENJIVAČ NE RADI ZAPUŠEN',
    'PUMPA NEISPRAVNA',
    'MANOMETAR NE PRIKAZUJE PRITISAK',
    'NEISPRAVNE ELEKTRODE',
    'NEMA MODULACIJE',
    'OLABAVLJEN DEO',
    'PREGREVA SE VODA',
    'VAZDUŠNI PRESOSTAT NEISPRAVAN',
    'VODENI PRESOSTAT NEISPRAVAN',
    'SLAVINA ZA DOPUNU NIJE ISPRAVNA',
    'NTC T NEISPRAVAN',
    'UREĐAJ NE PALI',
    'VENTILATOR NEISPRAVAN',
    'NEISPRAVAN SERVO MOTOR',
    'NEISPARVAN TROKRAKI VENTIL',
    'NEISPRAVAN REED RELEJ',
    'NEISPRAVAN MERAČ PROTOKA',
    'NEISPAVAN ULOŽAK TROKRAKOG',
  ],
};

const BOILER_GAS_AC_ERRORS: string[] = [
  DEFAULT_ERROR,
  '101 - Pregrevanje',
  '103 - Nedovoljna cirkulacija',
  '104 - Nedovoljna cirkulacija',
  '105 - Nedovoljna cirkulacija',
  '106 - Nedovoljna cirkulacija',
  '107 - Nedovoljna cirkulacija',
  '108 - Potrebno dopunjavanje',
  '110 - Otvoreni str. krug ili kratki spoj sonde na ulazu u m sistem',
  '112 - Otvoreni strujni krug ili kratki spoj povratne sonde grejanja',
  '114 - Otvoreni strujni krug ili kratki spoj spoljne sonde',
  '116 - Termostat podnog grejanja otvoren',
  '1P1 - Dojava nedostatne cirkulacije',
  '1P2 - Dojava nedostatne cirkulacije',
  '1P3 - Dojava nedostatne cirkulacije',
  '1P4 - Nedovoljna količina vode u sistemu (zahtev punjenja)',
  '203 - Prekid kruga senzora rezervoara GENUS ONE SYSTEM',
  '205 - Senzor na ulazu PTV-a u prekidu za bojler sa spojenim solarnim sistemom',
  '209 - Pregrejan rezervoar GENUS ONE SYSTEM',
  '301 - Greška EEPROM display',
  '302 - Greška komunikacije',
  '303 - Greška na glavnoj kartici',
  '305 - Greška na glavnoj kartici',
  '306 - Greška na glavnoj kartici',
  '307 - Greška na glavnoj kartici',
  '313 - Greška niskog napona',
  '3P9 - Redovno održavanje - zvati Servis',
  '411 - Sobni senzor Z1 nije dostupan (ako je ugrađena)',
  '412 - Sobni senzor Z2 nije dostupan (ako je ugrađena)',
  '413 - Sonbi senzor Z3 nije dostupan (ako je ugrađena)',
  '501 - Izostanak plamena (Nakon 5 puta sa P6)',
  '502 - Dojava plamena dok je zatvoren gasni ventil',
  '503 - Dojava plamena dok je zatvoren gasni ventil (Nakon 20 sekundi sa 502)',
  '504 - Nema plamena',
  '5P6 - Prvo paljenje neuspešno',
  '5P5 - Greška niskog pritiska gasa',
  '5P3 - Podizanje plamena',
  '611 - Upozorenje na ventilatoru - anomalija na ulazu vazduha i/ili odvodu dimnih gasova',
  '612 - Greška ventilatora (brzina veća ili manja od postavljenih vrednosti)',
  '701 - Senzor polaska zone 1 neispravan',
  '702 - Senzor polaska zone 2 neispravan',
  '703 - Senzor polaska zone 3 neispravan',
  '711 - Senzor povratka zone 1 neispravan',
  '712 - Senzor povratka zone 2 neispravan',
  '713 - Senzor povratka zone 3 neispravan',
  '722 - Pregrevanje zone 2',
  '723 - Pregrevanje zone 3',
  '750 - Hidraulička šema nije definisana',
  '801 - Greška prilikom kalibracije',
  '802 - Detektovan plamen sa zatvorenim gasnim ventilom',
  '803 - Pogrešna snaga kW (parametar 229)',
  '804 - Potrebna spojnica za razdvajanje, potrebno je ugraditi spojnicu koja je dostavljena sa kodom 3319171.',
];

const HEAT_PUMP_ERRORS: string[] = [
  DEFAULT_ERROR,
  '1 - Greška TD senzora',
  '905 - Greška kompresora',
  '906 - Greška ventlatora',
  '907 - Greška četvorokrakog ventila',
  '908 - Greška ekspanzijskog ventila',
  '909 - Nulta brzina ventilatora TP',
  '910 - Greška u komunikaciji invertora - TDM',
  '911 - Greška senzora temperature na isparivaču (TE - par.17.10.3)',
  '912 - Greška četvorokrakog ventila',
  '913 - Greška senzora polazne temperature vode (LWT -par.17.10.1)',
  '914 - Greška senzora izlazne temperature kondenzatora (TR - par.17.10.6)',
  '915 - Greška komunikacije TDM ploče',
  '916 - Greška senzora izlazne temperature na isparivaču (TEO - par.17.10.0)',
  '917 - Greška smrzavanja DT Freeze',
  '918 - Greška pumpe',
  '919 - Previsoka temperatura na izlazu iz kompresora (TD -par.17.10.5)',
  '922 - Greška smrzavanja DT Freeze',
  '931 - Greška inverter ploče',
  '947 - Greška četvorokrakog ventila',
  '948 - Greška senzora temperature na izlazu iz kompresora (TD -par.17.10.5)',
  '949 - Greška senzora temperature na ulazu u kompresor (TS -par.17.10.4)',
  '950 - Previsoka temperatura na izlazu iz kompresora (TD -par.17.10.5)',
  '951 - Previsoka temperatura na izlazu iz kompresora (TD -par.17.10.5)',
  '952 - Greška senzora spoljašnje temperature zraka (TO -par.17.10.0)',
  '953 - Greška kompresora',
  '954 - Greška baznog grejača',
  '956 - Neadekvatan model kompresora',
  '957 - Neadenkatan model ventilatora',
  '960 - HP EWT Greška - Greška senzora povratne temperature vode (EWT)',
  '962 - Greška odmrzavanja',
  '968 - Greška u komunikaciji ATGBUS TDM - EM',
  '989 - Greška mašina prazna',
  '997 - Prekomerna struja kompresora',
  '998 - Prekomerna struja kompresora',
  '9E5 - Intervencija presostata visokog pritiska',
  '9E8 - Greška presostata niskog pritiska s kompresorom OFF',
  '9E9 - Greška klixon s kompresorom OFF',
  '9E18 - Greška sigurnosnog termostata ST1',
  '9E21 - Greška mala količina rashladnog sredstva',
  '9E22 - Greška mašina prazna',
  '9E24 - Greška EXV blokiran',
  '9E25 - Greška EXV blokiran',
  '9E28 - Zaštita visokog pritiska',
  '9E29 - Zaštita visokog pritiska',
  '9E31 - Zaštita termostata kompresora',
  '9E32 - Zaštita termostata kompresora',
  '9E34 - Zaštita od niskog pritiska',
  '9E35 - Zaštita od niskog pritiska',
  '9E36 - Debalans struje faza kompresora',
  '9E37 - Debalans struje faza kompresora',
  '9E38 - Promena struje kompresora suviše velika',
  '9E39 - Promena struje kompresora suviše velika',
  '114 - Spoljašnja temperatura nedostupna',
  '730 - Greška kod bafera visoke sonde',
  '731 - Previsoka temperatura bafera',
  '732 - Greška kod bafera niske sonde',
  '902 - Senzor protoka sistema oštećen',
  '923 - Greška pritiska grejanja',
  '924 - Greška komunikacije TP',
  '927 - Greška u poklapanju pomoćnih ulaza',
  '928 - Greška u konfiguraciji bloka isporuke energije',
  '933 - Prevelika temperatura sonde polaznog voda',
  '934 - Oštećen senzor spremnika PTV',
  '935 - Prekoračenje temp. spremnika',
  '936 - Podni termostat 1-greška',
  '937 - Greška nestanka cirkulacije',
  '938 - Greška anode',
  '940 - Hidraulična shema nedefinisana',
  '955 - Protok vode Provera Greške',
  '970 - EM Split/Mono nedef. parametar',
  '2P2 - Antilegionela nekompletna',
  '2P3 - Zadana vrednost nije dostignuta',
  '2P4 - Drugi termostat grejača (ručno)',
  '2P5 - Prvi termostat grejača (auto)',
  '2P7 - Greška predcirkulacije',
  '2P8 - Upozorenje o niskom pritisku',
  '2P9 - SG spremna. Greška konfiguracije',
];

export const ERROR_CODES: Record<DeviceType, string[]> = {
  [DeviceType.BOILER]: BOILER_GAS_AC_ERRORS,
  [DeviceType.GAS_BOILER]: BOILER_GAS_AC_ERRORS,
  [DeviceType.AIR_CONDITION]: BOILER_GAS_AC_ERRORS,
  [DeviceType.HEAT_PUMP]: HEAT_PUMP_ERRORS,
};
