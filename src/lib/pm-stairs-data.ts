// IATA AHM 917 - preventivno održavanje (PM check sheet) za PUTNIČKE STEPENICE (PBS, samohodne i vučene).
// Sadržaj je preuzet iz IATA predloška "AHM 917 Maintenance checklists - Passenger stairs (PBS)" i namjerno ostavljen
// na ENGLESKOM (originalni tekst standarda, bez prevoda - da ne bi došlo do pogrešnog tumačenja sigurnosnih postupaka).
// GENERISANO iz xlsx-a - ne uređivati ručno stavke; promjene idu kroz novu IATA reviziju.
//
// scope: ALL   = zadaje se pri svakom PM servisu (minor i major)
//        MAJOR = samo pri velikom (major) servisu - zamjene i provjere godišnjeg/dužeg intervala
// note: interval / uputstvo iz kolone "IATA recommended interval" za tu stavku

export interface PmTask { key: string; no: number; text: string; scope: 'ALL' | 'MAJOR'; note: string }
export interface PmSection { id: string; title: string; caution: string; checkNote: string; replaceNote: string; tasks: PmTask[] }

export const PM_STAIRS_SECTIONS: PmSection[] = [
 {
  "id": "pre-inspection",
  "title": "Pre-inspection",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "pre-inspection.1",
    "no": 1,
    "text": "Review previous PM Check sheet for comments / open items",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "pre-inspection.2",
    "no": 2,
    "text": "General - carry out an internal and external appearance check including checking for missing pieces and fluid leaks",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "pre-inspection.3",
    "no": 3,
    "text": "Drive and test all functions",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "pre-inspection.4",
    "no": 4,
    "text": "Check ID number and logos - replace if missing or damaged",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "pre-inspection.5",
    "no": 5,
    "text": "Record hour / distance (Km / mile) meter reading",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "pre-inspection.6",
    "no": 6,
    "text": "Remove all FOD and wash engine and body",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "pre-inspection.7",
    "no": 7,
    "text": "Report all damage on the unit to the workshop manager",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "body",
  "title": "Body",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "body.1",
    "no": 1,
    "text": "Driver's cab:\nClean cab\nCheck general condition of:\nfloor lining, insulation, trim, dashboard, instrument/control housings",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "body.2",
    "no": 2,
    "text": "Stairs:\nClean stairs\nCheck general condition of:\nstairs interior and exterior, floor linings, anti-slip measures, sidewalls, handrails, trim, kickplates,\nCheck for:\nsigns of corrosion, damage, mould",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "body.3",
    "no": 3,
    "text": "Canopy:\nClean canopy\nCheck general condition of:\ncanopy structure (rigid and flexible portions)\nroofing and windows\nCheck for:\nsigns of corrosion, damage, mould",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "body.4",
    "no": 4,
    "text": "Check safety markings, paint, logos and decals",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "body.5",
    "no": 5,
    "text": "Check doors, locks, door frame for cracks, inside door covers securely attached",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "body.6",
    "no": 6,
    "text": "Check the seat(s), seatbelt(s), seat adjusting system(s)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "body.7",
    "no": 7,
    "text": "Windscreen, windows, mirrors - check:\nfor cracks, chips, scratches - repair or replace as necessary\nmirrors - adjustment, operation\nwipers for operation, condition of wiper blades - replace as necessary\nwindow washer operation, top-up washer fluid\nwindow / mirror heater operation and elements for correct operation\nwindow lifts / sliders - correct operation, sealing on closing",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "brakes-air-brake-systems",
  "title": "Brakes - Air brake systems",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace filters and fluids - every 12 months or 1500 hrs",
  "tasks": [
   {
    "key": "brakes-air-brake-systems.1",
    "no": 1,
    "text": "Air compressor - check:\ncorrect function\nmin and max pressure - cut-outs and clutches\ncondition and connections to discharge lines",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-air-brake-systems.2",
    "no": 2,
    "text": "Change air dryer filter",
    "scope": "MAJOR",
    "note": "Replace filters and fluids - every 12 months or 1500 hrs"
   },
   {
    "key": "brakes-air-brake-systems.3",
    "no": 3,
    "text": "Check main working air pressure and max air pressure for brakes, when pressurized",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-air-brake-systems.4",
    "no": 4,
    "text": "Check air brake system for leaks (tanks, pipes, hoses)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-air-brake-systems.5",
    "no": 5,
    "text": "Drain water from air tanks",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "brakes-hydraulic-systems",
  "title": "Brakes - Hydraulic systems",
  "caution": "CAUTION:\nAfter working on the brakes, before driving, check footbrake and parkbrake systems are functioning correctly",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace filters and fluids - every 12 months or 1500 hrs",
  "tasks": [
   {
    "key": "brakes-hydraulic-systems.1",
    "no": 1,
    "text": "Check brake fluid level",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-hydraulic-systems.2",
    "no": 2,
    "text": "Replace the brake fluid and purge the system",
    "scope": "MAJOR",
    "note": "Glycol based: 12 months or 1500 hrs Silicone based: see brake OEM / silicone brake fluid manufacturer information"
   },
   {
    "key": "brakes-hydraulic-systems.3",
    "no": 3,
    "text": "Check brake master cylinder, lines and hoses for leaks",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-hydraulic-systems.4",
    "no": 4,
    "text": "Check function of hydraulic parking brake operation as well as emergency release procedures [if applicable]",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "brakes-components",
  "title": "Brakes - components",
  "caution": "CAUTION:\nAfter working on the brakes, before driving, check footbrake and parkbrake systems are functioning correctly",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "brakes-components.1",
    "no": 1,
    "text": "Drum brakes:\nDemount brake drum and check:\ncondition and thickness of brake linings and drum - replace as necessary\nbrake cylinder(s) - replace if leaking\nattachment of shoes and springs\nRemount drums\nAdjust brake shoes",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-components.2",
    "no": 2,
    "text": "Disc brakes (single and multi-disc):\nSingle disc - check:\ncondition and thickness of brake pads and discs - replace as necessary\nfree movement and condition of brake calipers\nMulti-disc - check:\ncondition and thickness of discs and fixed elements\ncondition and operation of springs and actuation mechanism,\nClean",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-components.3",
    "no": 3,
    "text": "Brake booster - check:\nfunction of the brake booster",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-components.4",
    "no": 4,
    "text": "ABS (if applicable) - check:\nfunctioning of ABS\nsensors",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "brakes-components.5",
    "no": 5,
    "text": "Park brakes, check:\ncorrect operation, condition and adjustment of:\nmechanical actuation components\nelectrical actuation components - including emergency release.\nadjustment mechanism\nGrease the handbrake cable and the brake shoe lever [where applicable]",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "chassis",
  "title": "Chassis",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "chassis.1",
    "no": 1,
    "text": "Chassis and frame, check:\nfor damage\nsigns of corrosion\nall bolts for proper torque / tightness\nintegrity of all riveted, welded connections and mounting points",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "chassis.2",
    "no": 2,
    "text": "Check condition of:\nside guards\nmudguards\nbumpers",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "chassis.3",
    "no": 3,
    "text": "Drawbar, check:\nmounting is secure and safe\ncorrect functioning of drawbar",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "electrical-general",
  "title": "Electrical - General",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "electrical-general.1",
    "no": 1,
    "text": "Accessories battery (typically 12V or 24V) - check:\nwater level, top-up as needed\nconnections - clean and protected from build-up of harmful deposits\ncondition of the main battery cables\nbattery is correctly secured, with covers and tray in place",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.2",
    "no": 2,
    "text": "Wiring, check for:\nchaffing, damage, wear (particularly around pivot points and through holes)\nintegrity of insulation - repair if damaged\nburning / overheating\ncondition and connectivity of connectors and plugs\nsigns of corrosion on fuse boxes and relay boards",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.3",
    "no": 3,
    "text": "Vehicle lighting - check:\ncorrect function of all lights",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.4",
    "no": 4,
    "text": "Check operation of starting circuit (key, start button, any security / access system)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.5",
    "no": 5,
    "text": "Check emergency stops",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.6",
    "no": 6,
    "text": "Check all sensors / warning lights / status lights (e.g. stabilizers up / down) for correct operation and interface with hydraulic systems or electrical actuators",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.7",
    "no": 7,
    "text": "Electric motor(s) - operational check for:\nbearing noise\nany other unusual noises",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.8",
    "no": 8,
    "text": "Electric motor(s) - visual check for :\nfree flow of ventilation\nmechanical damage\nsecure mountings",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-general.9",
    "no": 9,
    "text": "Telemetry pack batteries - check :\ncondition",
    "scope": "MAJOR",
    "note": "As per manufacturer / supplier recommendation or every two years if no information provided"
   }
  ]
 },
 {
  "id": "electrical-electric-gse-egse",
  "title": "Electrical - Electric GSE (eGSE)",
  "caution": "CAUTION:\nWorking with high voltages requires special training\nOnly conduct these mainteannce tasks if appropriately trained",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "electrical-electric-gse-egse.1",
    "no": 1,
    "text": "Battery (Lead-acid), check:\npresence and condition of all covers\nwater level - top-up as needed\ncell voltage\nbattery connectors\nventilation",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-electric-gse-egse.2",
    "no": 2,
    "text": "Battery (non lead-acid), check:\npresence and condition of all covers\nbattery connectors\nheating / cooling / ventilation\nbattery sub-systems and controls",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-electric-gse-egse.3",
    "no": 3,
    "text": "Accessories battery - (see under Electrical system)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-electric-gse-egse.4",
    "no": 4,
    "text": "Regenerative and power storage systems - check:\ncorrect operation",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-electric-gse-egse.5",
    "no": 5,
    "text": "Vehicle control systems - check:\ncorrect operation",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-electric-gse-egse.6",
    "no": 6,
    "text": "Isolation tests on high voltage components",
    "scope": "MAJOR",
    "note": "every 12 months or 1500 hrs"
   }
  ]
 },
 {
  "id": "electrical-internal-combusti",
  "title": "Electrical - Internal combustion engine (ICE)",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "electrical-internal-combusti.1",
    "no": 1,
    "text": "Check diagnostics for error codes",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-internal-combusti.2",
    "no": 2,
    "text": "Alternator / generator - check:\ncondition\ncharging rate",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-internal-combusti.3",
    "no": 3,
    "text": "Starter motor - check:\noperation / serviceability of motor",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-internal-combusti.4",
    "no": 4,
    "text": "Spark ignition engines\nIgnition system - check:\ndistributor / cap / rotor / leads\ncoil / coil pack\nSpark plugs (set gap / replace)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "electrical-internal-combusti.5",
    "no": 5,
    "text": "Check operation of cold start device",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "engine",
  "title": "Engine",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "engine.1",
    "no": 1,
    "text": "Check toothed timing belt and retainer / tensioner [if applicable]",
    "scope": "MAJOR",
    "note": "every 12 months or 1500 hrs"
   },
   {
    "key": "engine.2",
    "no": 2,
    "text": "Replace toothed timing belt and retainer / tensioner [if applicable]",
    "scope": "MAJOR",
    "note": "every 3 years or 3000 hrs - if no other info available"
   },
   {
    "key": "engine.3",
    "no": 3,
    "text": "Accessory belt / V-belt(s) - check:\nplay on the accessory belt retainer - replace if worn\ntension of belt - adjust if needed\ncondition of belt - replace if worn",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine.4",
    "no": 4,
    "text": "Adjust the inlet and exhaust valves [if applicable]",
    "scope": "MAJOR",
    "note": "every 5 years or 5000 hrs"
   },
   {
    "key": "engine.5",
    "no": 5,
    "text": "Engine brake assembly (if installed) - check for:\ncorrect operation",
    "scope": "MAJOR",
    "note": "every 5 years or 5000 hrs"
   },
   {
    "key": "engine.6",
    "no": 6,
    "text": "Engine mountings - check for:\ncorrectly secured to engine and chassis\ncondition of vibration damper",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "engine-air-intake-system",
  "title": "Engine air intake system",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace filters - every 12 months or 1500 hrs",
  "tasks": [
   {
    "key": "engine-air-intake-system.1",
    "no": 1,
    "text": "Air filter:\nClean air filter with air pressure or replace if too dirty\nCheck air intake hoses and connections for leaks / damage",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-air-intake-system.2",
    "no": 2,
    "text": "Turbocharger - check:\ncharge air piping\noil supply\nwaste-gate operation",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "engine-cooling-system",
  "title": "Engine - Cooling system",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace filters - every 12 months or 1500 hrs",
  "tasks": [
   {
    "key": "engine-cooling-system.1",
    "no": 1,
    "text": "Coolant level:\nCheck for any leaks and repair\nTop-up with correct coolant as required",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-cooling-system.2",
    "no": 2,
    "text": "Replace coolant (____ L/gall)",
    "scope": "MAJOR",
    "note": "every 2 years / 3000 hrs"
   },
   {
    "key": "engine-cooling-system.3",
    "no": 3,
    "text": "Check the specific density of the coolant / anti-freeze to ensure coolant remains functional",
    "scope": "MAJOR",
    "note": "annually"
   },
   {
    "key": "engine-cooling-system.4",
    "no": 4,
    "text": "Change coolant filter",
    "scope": "MAJOR",
    "note": "Replace filters - every 12 months or 1500 hrs"
   },
   {
    "key": "engine-cooling-system.5",
    "no": 5,
    "text": "Check water pump, repair / replace",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "engine-fuel-system",
  "title": "Engine - Fuel system",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "engine-fuel-system.1",
    "no": 1,
    "text": "Replace the fuel filter(s)",
    "scope": "ALL",
    "note": "Every 500 hrs"
   },
   {
    "key": "engine-fuel-system.2",
    "no": 2,
    "text": "Drain the water from the water seperator",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-fuel-system.3",
    "no": 3,
    "text": "Check for correct operation of fuel pump",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-fuel-system.4",
    "no": 4,
    "text": "Check engine demand throttle function",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-fuel-system.5",
    "no": 5,
    "text": "Check fuel tank, filler piping and cap for damage and leaks",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-fuel-system.6",
    "no": 6,
    "text": "Check all fuel lines and condition of other external fuel components",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "engine-lubrication-system",
  "title": "Engine - Lubrication system",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "engine-lubrication-system.1",
    "no": 1,
    "text": "Check engine oil level",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-lubrication-system.2",
    "no": 2,
    "text": "Check engine for oil leaks",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-lubrication-system.3",
    "no": 3,
    "text": "Replace the engine oil (____L/gall) and filter",
    "scope": "MAJOR",
    "note": "Conventional oil: either every 12 months or every 500 hrs (NOT whichever comes first) Synthetic oil: see engine OEM / oil supplier info"
   }
  ]
 },
 {
  "id": "engine-exhaust-emissions-sys",
  "title": "Engine - Exhaust & emissions systems",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "engine-exhaust-emissions-sys.1",
    "no": 1,
    "text": "Check condition of exhaust pipes, silencers, catalytic converters, soot filter and sensors",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-exhaust-emissions-sys.2",
    "no": 2,
    "text": "Exhaust after-treatment system - check:\nwarning lights / buzzer for catalyzer clog or any \"burn-off\"\nEGR (Exhaust Gas Recirculation) system operation, blockage of valve",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "engine-exhaust-emissions-sys.3",
    "no": 3,
    "text": "Check DEF level - top-up as needed\n(refilled as needed when refuelled)",
    "scope": "ALL",
    "note": "top up during service if needed"
   },
   {
    "key": "engine-exhaust-emissions-sys.4",
    "no": 4,
    "text": "Change DEF tank filter",
    "scope": "MAJOR",
    "note": "follow engine manufacturer recommendations where available, otherwise every 2 years / 2000 hrs"
   },
   {
    "key": "engine-exhaust-emissions-sys.5",
    "no": 5,
    "text": "Change DEF dosing unit filter",
    "scope": "MAJOR",
    "note": "follow engine manufacturer recommendations where available, otherwise every 5 years / 5000 hrs"
   }
  ]
 },
 {
  "id": "fuel-cell-hydrogen",
  "title": "Fuel cell / hydrogen",
  "caution": "",
  "checkNote": "See manufacturer's recommended intervals",
  "replaceNote": "See manufacturer's recommended intervals",
  "tasks": [
   {
    "key": "fuel-cell-hydrogen.1",
    "no": 1,
    "text": "See manufactuer's recommendations",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "heat-exchangers-radiator",
  "title": "Heat exchangers / radiator",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "heat-exchangers-radiator.1",
    "no": 1,
    "text": "All heat exchangers / radiator(s) - check:\nradiator pressure cap\nvisible damage and leaks\nhoses, pipes and clamps for leaks\nclogging - clear debris\ncorrect operation of cooling fan(s)\nmountings for integrity and secure attachment",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "hvac",
  "title": "HVAC",
  "caution": "",
  "checkNote": "Checks - annually / 1000 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "hvac.1",
    "no": 1,
    "text": "Auxilliary heater\nCheck:\noperation of controls\nloose, damaged or broken components\nfuel level (if applicable) - top-up as needed\npipes and hoses (including insulation)\nfilters, clean or replace as needed",
    "scope": "MAJOR",
    "note": ""
   },
   {
    "key": "hvac.2",
    "no": 2,
    "text": "Air conditioning / Ventilation\nCheck:\noperation of controls\nserviceability, cooling capacity\nloose, damaged or broken components\nrefrigerant levels - top-up as needed\npipes and hoses (including insulation)\nreturn air filters, replace as needed\noperation of motor / engine (if separate unit), drive belts, compressor and clutch\nclean evaporator and condenser coils, ducts and fans",
    "scope": "MAJOR",
    "note": ""
   }
  ]
 },
 {
  "id": "hydraulic-power-systems",
  "title": "Hydraulic power systems",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace fluids and filters - every 12 months / 1500 hrs",
  "tasks": [
   {
    "key": "hydraulic-power-systems.1",
    "no": 1,
    "text": "Replace hydraulic oil at interval specified or based on oil analysis",
    "scope": "MAJOR",
    "note": "Replace fluids and filters - every 12 months / 1500 hrs"
   },
   {
    "key": "hydraulic-power-systems.2",
    "no": 2,
    "text": "Check all hydraulic valves, pipes, carriers, hoses for damage, leaks and cracks\nPay particular attention to all system components in same compartment or in close proximity to high temperature elements such as exhaust systems and turbo chargers",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "hydraulic-power-systems.3",
    "no": 3,
    "text": "Check hydraulic tank level",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "hydraulic-power-systems.4",
    "no": 4,
    "text": "Check hydraulic pump(s) (and motor(s) - if applicable) operations\nVerify main and secondary system pressures",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "hydraulic-power-systems.5",
    "no": 5,
    "text": "Check all hydraulic cylinders / rams for leaks and damage",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "hydraulic-power-systems.6",
    "no": 6,
    "text": "Replace high pressure filters and return filters.",
    "scope": "MAJOR",
    "note": "Replace fluids and filters - every 12 months / 1500 hrs"
   },
   {
    "key": "hydraulic-power-systems.7",
    "no": 7,
    "text": "Replace all flexible hydraulic hoses",
    "scope": "MAJOR",
    "note": "every 5 years"
   },
   {
    "key": "hydraulic-power-systems.8",
    "no": 8,
    "text": "Check for air in the hydraulic system",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "lifting-telescoping-aligning",
  "title": "Lifting, telescoping, aligning mechanisms",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "lifting-telescoping-aligning.1",
    "no": 1,
    "text": "All lifting / stabilizer system elements (arms, masts, scissors) - check for:\nmechanical damage\nalignment\ncracks and structural integrity",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "lifting-telescoping-aligning.2",
    "no": 2,
    "text": "Pivot points and rolling / sliding elements - check for:\nexcessive wear\nLubricate",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "lifting-telescoping-aligning.3",
    "no": 3,
    "text": "Auto-levelling - check:\ncorrect function of all components and system",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "lifting-telescoping-aligning.5",
    "no": 5,
    "text": "Ensure all retention pins / bolts are properly secured",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "lubrication-non-engine",
  "title": "Lubrication (non-engine)",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "lubrication-non-engine.1",
    "no": 1,
    "text": "Carry out lubrication (grease, oil) of all areas including chassis, scissor lift, tail-lift and front platform\n(Refer to lubrication chart in manual)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "lubrication-non-engine.2",
    "no": 2,
    "text": "Check automatic lubrication system resevoirs, pipes, operation\n(Refer to lubrication chart in manual)",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "safety-systems-and-warning-l",
  "title": "Safety systems and warning logos",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "safety-systems-and-warning-l.1",
    "no": 1,
    "text": "Anti-collision system - check:\ncorrect operation\nmounting / alignment of platform sensors / cameras\naction of safety switches / compressible bumpers\nClean camera lens\nRun through all system display screen functions\nIncident logs\nSee if any faults are displayed on the \"errors\" screen",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "safety-systems-and-warning-l.2",
    "no": 2,
    "text": "Leading edge protection rubbers - check:\npresence\nsecure attachment\naging / hardening of cushion material which affects effective aircraft damage prevention capability",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "safety-systems-and-warning-l.3",
    "no": 3,
    "text": "Fire extinguishers, check:\npresence\nstate of charge / level\nseal\ndate / expiry date",
    "scope": "ALL",
    "note": "Replace extinguisher with new or refill if expired"
   },
   {
    "key": "safety-systems-and-warning-l.4",
    "no": 4,
    "text": "Check the condition of the antiskid coatings / flooring / step treads - replace if worn",
    "scope": "ALL",
    "note": "Replace if worn"
   },
   {
    "key": "safety-systems-and-warning-l.5",
    "no": 5,
    "text": "Check safety / warning stickers / logos for:\npresence\ncondition\npostion - unobstructed view\nReplace / reposition if needed",
    "scope": "ALL",
    "note": "Replace / reposition if needed"
   },
   {
    "key": "safety-systems-and-warning-l.6",
    "no": 6,
    "text": "Check the validity of the lifting safety checks by recognized authority / insurance company [if applicable]",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "safety-systems-and-warning-l.7",
    "no": 7,
    "text": "Check safety straps and sensors that prevent people being on stairs while stairs are moving",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "safety-systems-and-warning-l.8",
    "no": 8,
    "text": "Check stairs lock for correct function",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "steering",
  "title": "Steering",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace fluids and filters - every 12 months or 1500 hrs",
  "tasks": [
   {
    "key": "steering.1",
    "no": 1,
    "text": "Check power steering fluid level",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.2",
    "no": 2,
    "text": "Replace the power steering fluid filter [where applicable]",
    "scope": "MAJOR",
    "note": "Replace fluids and filters - every 12 months or 1500 hrs"
   },
   {
    "key": "steering.3",
    "no": 3,
    "text": "Replace the power steering fluid (____ L/gall)",
    "scope": "MAJOR",
    "note": "Replace fluids and filters - every 12 months or 1500 hrs"
   },
   {
    "key": "steering.4",
    "no": 4,
    "text": "Check steering fluid system and hoses for leaks and tightness",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.5",
    "no": 5,
    "text": "Check power steering pump for correct operation",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.6",
    "no": 6,
    "text": "Check electrical assist for power steering system",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.7",
    "no": 7,
    "text": "Check steering wheel, rack / box and column for play and atttachment [repair if needed]",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.8",
    "no": 8,
    "text": "Check steering axle for play and attachment [repair if needed]",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.9",
    "no": 9,
    "text": "Check steering blocking bolts for max angle left and right [adjust if necessary]",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.10",
    "no": 10,
    "text": "Check steering damper for leaks and function",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.11",
    "no": 11,
    "text": "Check steering linkage (universal joints, ball joints, tie-rod ends, kingpins) for slack, attachment, play",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "steering.12",
    "no": 12,
    "text": "Check free play and wheel alignment",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "transmission-power-take-off-",
  "title": "Transmission (Power take off (PTO) drive)",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "transmission-power-take-off-.1",
    "no": 1,
    "text": "Check correct operation of PTO engage / disengage system",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-power-take-off-.2",
    "no": 2,
    "text": "Check PTO shaft main and release bearing",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-power-take-off-.3",
    "no": 3,
    "text": "Check pulleys / belts for wear and alignment",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "transmission-differential",
  "title": "Transmission & differential",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "Replace fluids and filters - every 12 months or 1500 hrs",
  "tasks": [
   {
    "key": "transmission-differential.1",
    "no": 1,
    "text": "Driven axles, check differentials / reduction hubs / gearboxes / dropboxes:\noil level rear axle & hubs (____L/gal)\noil level front axle & hubs (____ L/gal)",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-differential.2",
    "no": 2,
    "text": "Check and clean axle ventilation / breathers",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-differential.3",
    "no": 3,
    "text": "Propeller shafts; Drive shafts; Constant velocity joints (CVJ); Universal joints (UJ), check:\nplay / slack / noisy\nstate of protective boots, replace if damaged / leaking\nsplines and their dust covers / protective boots\npropeller shaft intermediate bearings, seals and bearing mountings\npropshaft and driveshafts for balance / vibration",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-differential.4",
    "no": 4,
    "text": "Transmission mountings - check for:\ncorrectly secured to transmission and chassis",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-differential.5",
    "no": 5,
    "text": "Transmission, check:\nselector / shift lever operation\nfor oil leaks\ntransmission oil level",
    "scope": "ALL",
    "note": "[CVT / auto / multi-clutch etc. - get specific procedure and interval from transmission manufacturer if possible if OEM info not available]"
   },
   {
    "key": "transmission-differential.6",
    "no": 6,
    "text": "Replace transmission oil (____ L/gall) and filter(s) [if applicable]",
    "scope": "ALL",
    "note": "[CVT / auto / multi-clutch etc. - get specific procedure and interval from transmission manufacturer if possible if OEM info not available]"
   },
   {
    "key": "transmission-differential.7",
    "no": 7,
    "text": "Transmission, electrical check:\ninterlocks\ncables and connection\nerrors in the diagnostic display [if applicable]",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-differential.8",
    "no": 8,
    "text": "Clutch, check for:\nnoise (thrust bearing)\nslipping\nleaks and cracks in actuating cylinders, pipes and hoses\nhydraulic fluid level - top up if needed\ncables for fraying and correct adjustment",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "transmission-differential.9",
    "no": 9,
    "text": "Clutch, replace:\nhydraulic fluid",
    "scope": "MAJOR",
    "note": "Glycol based: annually / 1500 hrs Silicone based: see fluid manufacturer recommendation"
   }
  ]
 },
 {
  "id": "wheels-axles-suspension",
  "title": "Wheels, axles & suspension",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "wheels-axles-suspension.1",
    "no": 1,
    "text": "Shock absorbers, struts, anti-roll bars / sway bars, swivel poiints, ball joints, suspension arms and links - check:\nsecure attachment to axles and chassis\nwear\nmechanical damage\ndamage to any protective boots / covers",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.2",
    "no": 2,
    "text": "Check wheel alignment",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.3",
    "no": 3,
    "text": "Check spring leaves, spring coils, pins, bolts, shackles and attachment hardware",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.4",
    "no": 4,
    "text": "Air suspension system, check:\ncompressor\nmanifold\nvalves\npipes\nconnections\nsuspension units (bellows) for leaks\ntime to get to operating pressure",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.5",
    "no": 5,
    "text": "Check wheel bearing condition, adjust or replace, repack with grease",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.6",
    "no": 6,
    "text": "Check tires and rims for damage and wear",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.7",
    "no": 7,
    "text": "Check the tire pressure, check:\nfront (BAR/lb/in ______ )\nrear (BAR/lb/in ______ )\ntires for uneven / unusual wear",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "wheels-axles-suspension.8",
    "no": 8,
    "text": "Torque wheel nuts/bolts",
    "scope": "ALL",
    "note": ""
   }
  ]
 },
 {
  "id": "operational-check",
  "title": "Operational check",
  "caution": "",
  "checkNote": "Checks - every 4 months or 500 hrs",
  "replaceNote": "",
  "tasks": [
   {
    "key": "operational-check.1",
    "no": 1,
    "text": "Check all access points for damage and secure attachment",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "operational-check.2",
    "no": 2,
    "text": "Emergency systems, check:\nemergency parking brake release system\noperation of emergency pump and controls",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "operational-check.3",
    "no": 3,
    "text": "Ladders, handrails and step up points - check for:\ndamage\nsecure attachment\nintegrity / effectiveness of anti-slip measures",
    "scope": "ALL",
    "note": ""
   },
   {
    "key": "operational-check.4",
    "no": 4,
    "text": "Test the unit, checking all:\ncontrol functions\nsafety functions\nspeeds for conformance with specificed parameters",
    "scope": "ALL",
    "note": ""
   }
  ]
 }
] as PmSection[]
