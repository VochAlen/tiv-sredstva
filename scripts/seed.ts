// Seed: STVARNI GSE inventar Aerodroma Tivat (izvor: "Aerodromska oprema
// Aerodrom Tivat - ažurirano avg. 2026") + kvalifikacije i vozačke dozvole
// potrebne da bi zaduživanje uopšte bilo moguće.
// Pokrenite: bun run db:seed  (ili: npm run seed:js za čist Node/JS)

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// =====================================================
// OPREMA - stvarna flota (78 sredstava, bez Thunderlift 4000E koji
// "stiže u oktobru" 2026 i još fizički nije na aerodromu)
// =====================================================
const equipment = [
  { code: 'GPU-01', name: 'GUINAULT GA 100 V 40', type: 'GPU', serialNumber: 'Int.br. 15 (T)', location: 'Platforma - stajanka', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2004
  { code: 'GPU-02', name: 'HITZINGER GPU 90 MDE 18', type: 'GPU', serialNumber: 'Int.br. 70 (T)', location: 'Platforma - stajanka', status: 'OUT_OF_SERVICE', department: 'TEHNICKA_SLUZBA', notes: 'Oštećen izlazni kabl za napajanje - čeka rezervni dio' }, // god. 2011
  { code: 'GPU-03', name: 'BERTOLI 18D/90TE', type: 'GPU', serialNumber: 'Int.br. 60 (T)', location: 'Platforma - stajanka', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2024
  { code: 'GPU-04', name: 'BERTOLI 18D/90TE', type: 'GPU', serialNumber: 'Int.br. 61 (T)', location: 'Platforma - stajanka', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2024
  { code: 'STA-01', name: 'GUINAULT 500 GS 250 – MAX V 4', type: 'AIR_STARTER', serialNumber: 'Int.br. 37 (T)', location: 'Platforma - stajanka', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2008
  { code: 'TOW-01', name: 'IMT 539', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 1 (H)', location: 'Radionica GSE / Platforma', status: 'MAINTENANCE', department: 'TEHNICKA_SLUZBA', notes: 'Redovni godišnji servis motora' }, // god. 1980
  { code: 'TOW-02', name: 'IMT 539', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 3 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA', notes: 'Bez kabine' }, // god. 1980
  { code: 'TOW-03', name: 'IMT 539', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 5 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA', notes: 'Bez kabine' }, // god. 1980
  { code: 'TOW-04', name: 'IMT 539', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 6 (T)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA', notes: 'Sa kabinom' }, // god. 1980
  { code: 'TOW-05', name: 'IMT 539', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 34 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA', notes: 'Bez kabine' }, // god. 2008
  { code: 'TOW-06', name: 'IMT 539', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 35 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA', notes: 'Sa kabinom' }, // god. 2008
  { code: 'TOW-07', name: 'Agromehanika AGT 835 TS - sa kabinom', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 38 (T)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-08', name: 'Agromehanika AGT 850 TS - sa kabinom', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 39 (T)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-09', name: 'Agromehanika AGT 835 TS - sa kabinom', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 40 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-10', name: 'Agromehanika AGT 835 TS - bez kabine', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 41 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-11', name: 'Agromehanika AGT 835 TS - bez kabine', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 42 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-12', name: 'Agromehanika AGT 835 TS - bez kabine', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 50 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-13', name: 'Agromehanika AGT 835 TS - bez kabine', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 51 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-14', name: 'Agromehanika AGT 835 TS - bez kabine', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 52 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2014
  { code: 'TOW-15', name: 'AVRO GSE ST 470 E', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 84 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'TOW-16', name: 'AVRO GSE ST 470 E', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 85 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'TOW-17', name: 'AVRO GSE ST 470 E', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 86 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'TOW-18', name: 'AVRO GSE ST 470 E', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 87 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'TOW-19', name: 'AVRO GSE ST 470 E', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 88 (H)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'TOW-20', name: 'Rakovica - sa kabinom', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 17 (T)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 1993
  { code: 'TOW-21', name: 'SOLIS Indija Solis – sa kabinom', type: 'TOW_TRACTOR', serialNumber: 'Int.br. 53 (T)', location: 'Radionica GSE / Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2019
  { code: 'BLT-01', name: 'AVIOGEI NS 450', type: 'BELT_LOADER', serialNumber: 'Int.br. 64 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2011
  { code: 'BLT-02', name: 'AVIOGEI NS 450', type: 'BELT_LOADER', serialNumber: 'Int.br. 63 (H)', location: 'Platforma A', status: 'MAINTENANCE', department: 'SLUZBA_PO', notes: 'Zamjena trake u toku' }, // god. 2011
  { code: 'BLT-03', name: 'AVIOGEI NS 450', type: 'BELT_LOADER', serialNumber: 'Int.br. 30 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2005
  { code: 'BLT-04', name: 'AVIOGEI NS 450', type: 'BELT_LOADER', serialNumber: 'Int.br. 29 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2005
  { code: 'BLT-05', name: 'AVIOGEI NS 450 L', type: 'BELT_LOADER', serialNumber: 'Int.br. 65 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2018
  { code: 'BLT-06', name: 'AVIOGEI NS 450 L', type: 'BELT_LOADER', serialNumber: 'Int.br. 66 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2018
  { code: 'BLT-07', name: 'AVIOGEI NS 450 L', type: 'BELT_LOADER', serialNumber: 'Int.br. 67 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2018
  { code: 'BLT-08', name: 'AVRO GSE BL30E', type: 'BELT_LOADER', serialNumber: 'Int.br. 75 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'BLT-09', name: 'AVRO GSE BL30E', type: 'BELT_LOADER', serialNumber: 'Int.br. 76 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'BLT-10', name: 'AVRO GSE BL30E', type: 'BELT_LOADER', serialNumber: 'Int.br. 77 (H)', location: 'Platforma A', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2026 - NOVO
  { code: 'STR-01', name: 'AVIOGEI SI 18-39/male – samohodne', type: 'STAIRS', serialNumber: 'Int.br. 54 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2011
  { code: 'STR-02', name: 'AVIOGEI SI 22-45/srednje-samoh.', type: 'STAIRS', serialNumber: 'Int.br. 74 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2011
  { code: 'STR-03', name: 'AVIOGEI SI 22-45/srednje – samohodne', type: 'STAIRS', serialNumber: 'Int.br. 83 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2011
  { code: 'STR-04', name: 'AVIOGEI SI 22-45 / srednje - samohodne', type: 'STAIRS', serialNumber: 'Int.br. 33 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2004
  { code: 'STR-05', name: 'AVIOGEI SI 22-45 / srednje - samohodne', type: 'STAIRS', serialNumber: 'Int.br. 32 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2004
  { code: 'STR-06', name: 'TBD TPS 2436 – električne', type: 'STAIRS', serialNumber: 'Int.br. 55 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2023
  { code: 'STR-07', name: 'TBD TPS 2436 - električne', type: 'STAIRS', serialNumber: 'Int.br. 56 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2023
  { code: 'STR-08', name: 'TBD TPS 2436 - električne', type: 'STAIRS', serialNumber: 'Int.br. 57 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2023
  { code: 'STR-09', name: 'TBD TPS 2436 - električne', type: 'STAIRS', serialNumber: 'Int.br. 58 (H)', location: 'Platforma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2023
  { code: 'CGO-01', name: 'TREPEL LOADER CHAMP 70W; 7t', type: 'CARGO_LOADER', serialNumber: 'Int.br. 48 (H)', location: 'Teretni terminal', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2008
  { code: 'WTR-01', name: 'AVIOGEI VASM 2000', type: 'WATER', serialNumber: 'Int.br. 16 (H)', location: 'Servisna saobraćajnica', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2004
  { code: 'LAV-01', name: 'AVIOGEI VSTM 2000 V', type: 'LAVATORY', serialNumber: 'Int.br. 31 (H)', location: 'Servisna saobraćajnica', status: 'OUT_OF_SERVICE', department: 'SLUZBA_PO', notes: 'Curenje na crijevu za pražnjenje - prijavljeno radionici' }, // god. 2008
  { code: 'LAV-02', name: 'AVIOGEI VSTM 2000 VE', type: 'LAVATORY', serialNumber: 'Int.br. 44 (H)', location: 'Servisna saobraćajnica', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2023
  { code: 'PBK-01', name: 'LEKTRO AP8750CX', type: 'PUSHBACK', serialNumber: 'Int.br. 71 (H)', location: 'Head-of-stand', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2010
  { code: 'PBK-02', name: 'LEKTRO AP8850SDA', type: 'PUSHBACK', serialNumber: 'Int.br. 72 (H)', location: 'Head-of-stand', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2025 - NOVO
  { code: 'FLT-01', name: 'TOYOTA Traigo 8FBMT30', type: 'FORKLIFT', serialNumber: 'Int.br. 11 (T)', location: 'Teretni terminal', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2017
  { code: 'DLY-01', name: 'FSM Prtljažna kolica kavez', type: 'DOLLY', serialNumber: null, location: 'Terminal - prtljažni prostor', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. x
  { code: 'DLY-02', name: 'TIPS CARGO 2515 B', type: 'DOLLY', serialNumber: null, location: 'Terminal - prtljažni prostor', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2016
  { code: 'DLY-03', name: 'TIPS CARGO 0024C', type: 'DOLLY', serialNumber: null, location: 'Terminal - prtljažni prostor', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2016
  { code: 'DLY-04', name: 'AVIOGEI RC 25 T', type: 'DOLLY', serialNumber: null, location: 'Terminal - prtljažni prostor', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2010
  { code: 'DLY-05', name: 'ZODIAC EQUIPMENT BDK 20 HR (kavez kolica) kom 11', type: 'DOLLY', serialNumber: null, location: 'Terminal - prtljažni prostor', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2024
  { code: 'BUS-01', name: 'MERCEDES BENZ. V – class rise v 220 d (GA)', type: 'BUS', serialNumber: 'Int.br. PGCGK32 (H)', location: 'Terminal - ukrcajna zona', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2020
  { code: 'SVC-01', name: 'TOYOTA Hilux Bezbjednost', type: 'SERVICE_CAR', serialNumber: 'Int.br. PGMN731 (S)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2013
  { code: 'SVC-02', name: 'TOYOTA Hilux Vatrogasci', type: 'SERVICE_CAR', serialNumber: 'Int.br. PGCG799 (F)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2013
  { code: 'SVC-03', name: 'TOYOTA Hilux RC22 2.4D-4D 4X4DC M/T6', type: 'SERVICE_CAR', serialNumber: 'Int.br. PGCGP80 (S)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2024 - NOVO
  { code: 'SVC-04', name: 'DACIA DUSTER LGV Comfort 1.5 blue DC', type: 'SERVICE_CAR', serialNumber: 'Int.br. PGCGL45 (T)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2022
  { code: 'SVC-05', name: 'VW Caddy', type: 'SERVICE_CAR', serialNumber: 'Int.br. PG MN 930 (T)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2007
  { code: 'SVC-06', name: 'ATTIVA 4.6', type: 'SERVICE_CAR', serialNumber: 'Int.br. 13 (H)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2019
  { code: 'SVC-07', name: 'ATTIVA 4.6', type: 'SERVICE_CAR', serialNumber: 'Int.br. 20 (S)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2019
  { code: 'SVC-08', name: 'ATTIVA 6LC.5', type: 'SERVICE_CAR', serialNumber: 'Int.br. 28 (H)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2019
  { code: 'SVC-09', name: 'ATTIVA 6LC.5', type: 'SERVICE_CAR', serialNumber: 'Int.br. 91 (T)', location: 'Landside - uprava aerodroma', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2019
  { code: 'FIR-01', name: 'ROSENBAUER Panther 6X6', type: 'FIRE_TRUCK', serialNumber: 'Int.br. PGCGB89 (F)', location: 'Vatrogasna stanica', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2005
  { code: 'FIR-02', name: 'ROSENBAUER Panther 6X6', type: 'FIRE_TRUCK', serialNumber: 'Int.br. PGCGB90 (F)', location: 'Vatrogasna stanica', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2005
  { code: 'FIR-03', name: 'Rosenbauer Panther 6x6', type: 'FIRE_TRUCK', serialNumber: 'Int.br. PGCGS36 (F)', location: 'Vatrogasna stanica', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2025
  { code: 'FLM-01', name: 'FIAT Fiorino', type: 'FOLLOW_ME', serialNumber: 'Int.br. PGCGK64 (F)', location: 'Kontrolni toranj / apron', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2019
  { code: 'FLM-02', name: 'OPEL', type: 'FOLLOW_ME', serialNumber: 'Int.br. PGCGU46 (F)', location: 'Kontrolni toranj / apron', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2026 - NOVO
  { code: 'AMB-01', name: 'Renault Master', type: 'AMBULANCE', serialNumber: 'Int.br. PGCG068 (H)', location: 'Zdravstvena stanica aerodroma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2015
  { code: 'AMB-02', name: 'Renault Master', type: 'AMBULANCE', serialNumber: 'Int.br. PGCGJ47 (H)', location: 'Zdravstvena stanica aerodroma', status: 'AVAILABLE', department: 'SLUZBA_PO' }, // god. 2019
  { code: 'SVC-10', name: 'VW GOLF V Aerodroma Tivat', type: 'SERVICE_CAR', serialNumber: 'Int.br. PGMN655', location: 'Landside parking', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2008
  { code: 'SVC-11', name: 'VW GOLF V Aerodroma Tivat', type: 'SERVICE_CAR', serialNumber: 'Int.br. PG CG C09', location: 'Landside parking', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2008
  { code: 'SVC-12', name: 'VW GOLF V Aerodroma Tivat', type: 'SERVICE_CAR', serialNumber: 'Int.br. PGMN967', location: 'Landside parking', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2005
  { code: 'SVC-13', name: 'Audi A6 Direktor ATV', type: 'SERVICE_CAR', serialNumber: 'Int.br. PG CG 440', location: 'Landside parking', status: 'AVAILABLE', department: 'TEHNICKA_SLUZBA' }, // god. 2008
]

// =====================================================
// ZAPOSLENI
// =====================================================
const employees = [
  { cardId: 'EMP-1001', name: 'Marko Radulović', department: 'Ramp', role: 'Operator', pin: '1001' },
  { cardId: 'EMP-1002', name: 'Ivana Vuković', department: 'Ramp', role: 'Operator', pin: '1002' },
  { cardId: 'EMP-1003', name: 'Petar Backović', department: 'Ramp', role: 'Senior Operator', pin: '1003' },
  { cardId: 'EMP-1004', name: 'Ana Perović', department: 'Maintenance', role: 'Tehničar - mehanika', pin: '1004' },
  { cardId: 'EMP-1005', name: 'Boris Jovanović', department: 'Operations', role: 'Šef službe GSE', pin: '1005' },
  { cardId: 'EMP-1006', name: 'Nikola Đurović', department: 'Fire & Rescue', role: 'Vatrogasac', pin: '1006' },
  { cardId: 'EMP-1007', name: 'Jelena Mijušković', department: 'Security', role: 'Bezbjednost', pin: '1007' },
  { cardId: 'EMP-1008', name: 'Stefan Kovačević', department: 'Medical', role: 'Medicinar', pin: '1008' },
  { cardId: 'EMP-1009', name: 'Vladimir Stanić', department: 'Maintenance', role: 'Tehničar - elektrika', pin: '1009' },
  { cardId: 'EMP-1010', name: 'Filip Bulatović', department: 'Maintenance', role: 'Tehničar - hidraulika', pin: '1010' },
]

// =====================================================
// KVALIFIKACIJE PO TIPU OPREME (EquipmentQualification)
// KRITIČNO: bez ovoga checkOutEquipment odbija SVAKO zaduživanje, jer
// aplikacija sada obavezno provjerava kvalifikaciju radnika za tip opreme.
// =====================================================
const RAMP_TYPES = ['GPU', 'AIR_STARTER', 'TOW_TRACTOR', 'BELT_LOADER', 'CARGO_LOADER', 'STAIRS', 'WATER', 'LAVATORY', 'PUSHBACK', 'FORKLIFT', 'DOLLY', 'BUS']
const FIRE_TYPES = ['FIRE_TRUCK', 'SERVICE_CAR']
const SECURITY_TYPES = ['SERVICE_CAR', 'FOLLOW_ME']
const MEDICAL_TYPES = ['AMBULANCE', 'SERVICE_CAR']
const ALL_TYPES = [...new Set([...RAMP_TYPES, ...FIRE_TYPES, ...SECURITY_TYPES, ...MEDICAL_TYPES])]

const qualificationsByCard: Record<string, string[]> = {
  'EMP-1001': RAMP_TYPES,
  'EMP-1002': RAMP_TYPES,
  'EMP-1003': RAMP_TYPES,
  'EMP-1004': ALL_TYPES, // mehaničar mora moći test-vozati sve nakon popravke
  'EMP-1005': ALL_TYPES, // šef službe - nadzor nad svime
  'EMP-1006': FIRE_TYPES,
  'EMP-1007': SECURITY_TYPES,
  'EMP-1008': MEDICAL_TYPES,
  'EMP-1009': ALL_TYPES,
  'EMP-1010': ALL_TYPES,
}

// =====================================================
// KVALIFIKACIJE RADIONICE PO KATEGORIJI KVARA (MaintenanceSkill)
// KRITIČNO: bez ovoga markRepaired odbija SVAKO označavanje popravke, jer
// aplikacija sada provjerava da li tehničar smije popravljati baš tu
// kategoriju kvara (mehanika/elektrika/hidraulika/bezbjednost/opšte).
// Namjerno različiti radnici imaju različite specijalnosti - to je i poenta.
// =====================================================
const maintenanceSkillsByCard: Record<string, string[]> = {
  'EMP-1004': ['MEHANIKA', 'OPSTE'], // Ana - mehanika
  'EMP-1009': ['ELEKTRIKA', 'OPSTE'], // Vladimir - elektrika
  'EMP-1010': ['HIDRAULIKA', 'MEHANIKA'], // Filip - hidraulika
  'EMP-1005': ['MEHANIKA', 'ELEKTRIKA', 'HIDRAULIKA', 'BEZBJEDNOST', 'OPSTE'], // šef - sve (nadzor/zamjena)
}

// =====================================================
// VOZAČKE DOZVOLE ZA AIRSIDE (DriverAuthorization - ADR.OPS.C.005)
// KRITIČNO: bez ovoga checkOutEquipment TAKOĐE odbija svako zaduživanje.
// =====================================================
const validUntil = new Date()
validUntil.setFullYear(validUntil.getFullYear() + 1)

async function main() {
  console.log('Seeding STVARNI GSE inventar Aerodroma Tivat...')

  for (const e of equipment) {
    await db.equipment.upsert({
      where: { code: e.code },
      // Kolona department sada postoji u šemi - ponovno seedanje popunjava službu i postojećoj opremi
      update: { department: (e as any).department ?? null },
      create: {
        code: e.code,
        name: e.name,
        type: e.type,
        serialNumber: (e as any).serialNumber ?? null,
        location: e.location,
        status: e.status,
        notes: (e as any).notes ?? null,
        department: (e as any).department ?? null,
      },
    })
  }
  console.log(`Seeded ${equipment.length} stvarnih sredstava`)

  const createdEmployees: Record<string, string> = {}
  for (const emp of employees) {
    const created = await db.employee.upsert({
      where: { cardId: emp.cardId },
      update: { name: emp.name, department: emp.department, role: emp.role, pin: emp.pin },
      create: emp,
    })
    createdEmployees[emp.cardId] = created.id
  }
  console.log(`Seeded ${employees.length} zaposlenih`)

  let qualCount = 0
  for (const emp of employees) {
    const types = qualificationsByCard[emp.cardId] ?? []
    for (const equipmentType of types) {
      await db.equipmentQualification.upsert({
        where: { employeeId_equipmentType: { employeeId: createdEmployees[emp.cardId], equipmentType } },
        update: {},
        create: {
          employeeId: createdEmployees[emp.cardId],
          employeeCardId: emp.cardId,
          employeeName: emp.name,
          equipmentType,
          qualificationLevel: emp.cardId === 'EMP-1005' ? 'INSTRUCTOR' : emp.cardId === 'EMP-1003' ? 'SENIOR' : 'OPERATOR',
          trainedAt: new Date('2025-01-15'),
          validUntil,
          certifiedBy: 'Šef službe GSE',
        },
      })
      qualCount++
    }
  }
  console.log(`Seeded ${qualCount} kvalifikacija`)

  for (const emp of employees) {
    await db.driverAuthorization.upsert({
      where: { employeeCardId: emp.cardId },
      update: {},
      create: {
        employeeCardId: emp.cardId,
        employeeName: emp.name,
        category1: true,
        category2: emp.cardId === 'EMP-1003' || emp.cardId === 'EMP-1005',
        category3: emp.cardId === 'EMP-1005',
        licenseNumber: `ADP-${emp.cardId.slice(-4)}`,
        issuedAt: new Date('2025-01-15'),
        validUntil,
        issuedBy: 'Operativna služba Aerodroma Tivat',
        trainingCompleted: true,
        trainingDate: new Date('2025-01-15'),
        trainingExpiry: validUntil,
        active: true,
      },
    })
  }
  console.log(`Seeded ${employees.length} airside vozačkih dozvola`)

  let skillCount = 0
  for (const [cardId, categories] of Object.entries(maintenanceSkillsByCard)) {
    const emp = employees.find((e) => e.cardId === cardId)
    if (!emp) continue
    for (const category of categories) {
      await db.maintenanceSkill.upsert({
        where: { employeeCardId_category: { employeeCardId: cardId, category } },
        update: {},
        create: {
          employeeCardId: cardId,
          employeeName: emp.name,
          category,
          level: cardId === 'EMP-1005' ? 'SENIOR' : 'CERTIFIED',
          certifiedBy: 'Šef službe GSE',
          validUntil,
        },
      })
      skillCount++
    }
  }
  console.log(`Seeded ${skillCount} kvalifikacija radionice po kategoriji kvara`)

  // Uputstva za upotrebu - postojeći PDF-ovi u /public/manuals/ (generički,
  // vezani za tip opreme, ne za konkretno stvarno sredstvo)
  const manuals = [
    { equipmentType: 'TOW_TRACTOR', title: 'Tow Tractor - Operating Manual', manualUrl: '/manuals/tow-tractor-ast2.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.0' },
    { equipmentType: 'TOW_TRACTOR', title: 'Tow Tractor - Safety Procedures', manualUrl: '/manuals/tow-tractor-safety.pdf', manualType: 'SAFETY', language: 'en', version: 'v1.0' },
    { equipmentType: 'GPU', title: 'GPU - Operating Manual', manualUrl: '/manuals/gpu-itw-1400.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.0' },
    { equipmentType: 'BELT_LOADER', title: 'Belt Loader - Operating Manual', manualUrl: '/manuals/belt-loader-tb150.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.0' },
    { equipmentType: 'PUSHBACK', title: 'Pushback (Lektro towbarless) - Operating Manual', manualUrl: '/manuals/pushback-ast1x.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.0' },
    { equipmentType: 'STAIRS', title: 'Passenger Stairs - Operating Manual', manualUrl: '/manuals/stairs.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.0' },
    { equipmentType: 'BUS', title: 'Cobus/Mercedes V-class - Operating Manual', manualUrl: '/manuals/cobus-3000.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.0' },
  ]

  for (const m of manuals) {
    const existing = await db.equipmentManual.findFirst({
      where: { equipmentType: m.equipmentType, title: m.title },
    })
    if (!existing) {
      await db.equipmentManual.create({ data: m })
    }
  }
  console.log(`Seeded ${manuals.length} uputstava za upotrebu`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
