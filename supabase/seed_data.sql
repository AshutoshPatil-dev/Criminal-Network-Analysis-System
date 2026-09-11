-- Nexus — case graph seed (demo dataset)
-- Run this in the Supabase SQL Editor to load the case graph used by the
-- Explore views. It is safe to re-run: the three case tables are cleared
-- and repopulated (reports, FIR documents and the audit log are untouched).

-- ---------------------------------------------------------------------------
-- Case graph (entities + relationships + crime events)
-- ---------------------------------------------------------------------------
truncate table public.crime_events, public.relationships, public.entities cascade;

insert into public.entities (id, type, name, attributes, risk_score) values
  ('dhruv',    'person', 'Dhruv Babar',     '{"age": "44", "address": "Dadar, Mumbai, Maharashtra", "role": "Kingpin", "aliases": "Chota Rajan, D.B."}'::jsonb, 96),
  ('aditya',   'person', 'Aditya Gurav',    '{"age": "33", "address": "Thane, Maharashtra", "role": "Enforcer", "aliases": "Adi"}'::jsonb, 84),
  ('anish',    'person', 'Anish Papadkar',  '{"age": "48", "address": "Bhosari, Pune, Maharashtra", "role": "Financier", "aliases": "Bhaiya"}'::jsonb, 78),
  ('divakar',  'person', 'Divakar Mukherjee', '{"age": "51", "address": "Garden Reach, Kolkata, West Bengal", "role": "Smuggler", "aliases": "Divu"}'::jsonb, 81),
  ('gauresh',  'person', 'Gauresh Gadhe',   '{"age": "29", "address": "Byculla, Mumbai, Maharashtra", "role": "Courier", "aliases": "Gau"}'::jsonb, 58),
  ('kalesh',   'person', 'Kalesh Laddha',   '{"age": "46", "address": "Malad, Mumbai, Maharashtra", "role": "Broker", "aliases": "K.L. Bhai"}'::jsonb, 74),
  ('kaustubh', 'person', 'Kaustubh Joshi',  '{"age": "38", "address": "Ghoti, Nashik, Maharashtra", "role": "Recruiter", "aliases": "K.J."}'::jsonb, 64),
  ('varad',    'person', 'Varad Kotkar',    '{"age": "31", "address": "Pimpri-Chinchwad, Pune, Maharashtra", "role": "Driver", "aliases": "Varad Bhau"}'::jsonb, 42),
  ('pranit',   'person', 'Pranit Bhule',    '{"age": "27", "address": "Dadar, Mumbai, Maharashtra", "role": "Handler", "aliases": ""}'::jsonb, 70),

  ('ph1',  'phone', '+91-9820085411', '{"carrier": "Airtel", "registeredTo": "dhruv"}'::jsonb, 90),
  ('ph2',  'phone', '+91-9987085422', '{"carrier": "Jio", "registeredTo": "aditya"}'::jsonb, 82),
  ('ph3',  'phone', '+91-9815085433', '{"carrier": "Vi", "registeredTo": "anish"}'::jsonb, 76),
  ('ph4',  'phone', '+91-9748085444', '{"carrier": "Jio", "registeredTo": "divakar"}'::jsonb, 78),
  ('ph5',  'phone', '+91-9833085455', '{"carrier": "BSNL", "registeredTo": "gauresh"}'::jsonb, 55),
  ('ph6',  'phone', '+91-9822085466', '{"carrier": "Jio", "registeredTo": "kalesh"}'::jsonb, 71),
  ('ph7',  'phone', '+91-9857085477', '{"carrier": "Airtel", "registeredTo": "kaustubh"}'::jsonb, 61),
  ('ph8',  'phone', '+91-9890085488', '{"carrier": "Vi", "registeredTo": "varad"}'::jsonb, 40),
  ('ph9',  'phone', '+91-9820085499', '{"carrier": "BSNL", "registeredTo": "pranit"}'::jsonb, 68),
  ('ph10', 'phone', '+91-8793000123', '{"carrier": "Jio", "registeredTo": "Unknown"}'::jsonb, 92),
  ('ph11', 'phone', '+91-8793000456', '{"carrier": "Airtel", "registeredTo": "Unknown"}'::jsonb, 88),
  ('ph12', 'phone', '+91-8793000789', '{"carrier": "Vi", "registeredTo": "Unknown"}'::jsonb, 85),

  ('v1', 'vehicle', 'MH-01 AB 9876', '{"make": "Mercedes GLE", "color": "Black", "registeredTo": "dhruv"}'::jsonb, 88),
  ('v2', 'vehicle', 'MH-02 CD 5432', '{"make": "Toyota Fortuner", "color": "White", "registeredTo": "aditya"}'::jsonb, 80),
  ('v3', 'vehicle', 'MH-03 EF 2109', '{"make": "Mahindra Thar", "color": "Black", "registeredTo": "gauresh"}'::jsonb, 55),
  ('v4', 'vehicle', 'WB-06 GH 7712', '{"make": "Hyundai Creta", "color": "Grey", "registeredTo": "divakar"}'::jsonb, 72),
  ('v5', 'vehicle', 'MH-14 IJ 3304', '{"make": "Tata 407 (goods)", "color": "Blue", "registeredTo": "varad"}'::jsonb, 38),

  ('loc1', 'location', 'Dadar East, Mumbai', '{"district": "Mumbai", "state": "Maharashtra", "type": "Residential"}'::jsonb, 68),
  ('loc2', 'location', 'Byculla Market, Mumbai', '{"district": "Mumbai", "state": "Maharashtra", "type": "Commercial"}'::jsonb, 62),
  ('loc3', 'location', 'Nhava Sheva Port', '{"district": "Raigad", "state": "Maharashtra", "type": "Port"}'::jsonb, 75),
  ('loc4', 'location', 'Bhosari Industrial Belt, Pune', '{"district": "Pune", "state": "Maharashtra", "type": "Industrial"}'::jsonb, 57),
  ('loc5', 'location', 'Ghoti Highway, Nashik', '{"district": "Nashik", "state": "Maharashtra", "type": "Highway"}'::jsonb, 49),
  ('loc6', 'location', 'Garden Reach Dockyard, Kolkata', '{"district": "Kolkata", "state": "West Bengal", "type": "Port"}'::jsonb, 74),

  ('org1', 'org', 'Dadar East Cooperative Development', '{"sector": "Real Estate", "est": "2016"}'::jsonb, 72),
  ('org2', 'org', 'Bhosari Auto Parts Pvt Ltd', '{"sector": "Manufacturing", "est": "2013"}'::jsonb, 66),
  ('org3', 'org', 'Eastern Seaboard Logistics', '{"sector": "Logistics", "est": "2015"}'::jsonb, 78);

insert into public.crime_events (id, fir_number, incident_date, location, involved_entity_ids) values
  ('c1', 'MH/2026/0741', '2026-03-22', 'Mumbai (Byculla), Maharashtra', '["dhruv", "aditya", "gauresh", "varad", "pranit"]'),
  ('c2', 'MH/2026/0722', '2026-03-14', 'Thane, Maharashtra', '["kalesh", "aditya", "dhruv"]'),
  ('c3', 'MH/2026/0803', '2026-04-02', 'Nhava Sheva, Maharashtra', '["divakar", "anish", "aditya", "gauresh"]'),
  ('c4', 'WB/2025/1198', '2025-12-10', 'Kolkata, West Bengal', '["divakar", "dhruv", "kaustubh"]'),
  ('c5', 'MH/2026/0688', '2026-02-27', 'Pune, Maharashtra', '["anish", "varad"]');

insert into public.relationships (source, target, type, counts, timestamps, linked_crime_event_id) values
  -- Core network calls around FIR #MH/2026/0741 (Byculla dacoity)
  ('dhruv', 'aditya', 'call', 41, '["2026-01-12", "2026-02-03", "2026-02-25", "2026-03-02", "2026-03-08", "2026-03-15", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21"]', 'c1'),
  ('dhruv', 'gauresh', 'call', 26, '["2026-01-20", "2026-02-14", "2026-03-05", "2026-03-18", "2026-03-19", "2026-03-20"]', 'c1'),
  ('dhruv', 'kalesh', 'call', 19, '["2026-02-10", "2026-02-22", "2026-03-06", "2026-03-12", "2026-03-17", "2026-03-18", "2026-03-20"]', 'c2'),
  ('dhruv', 'pranit', 'call', 15, '["2026-02-08", "2026-03-01", "2026-03-13", "2026-03-17", "2026-03-19", "2026-03-21"]', 'c1'),
  ('aditya', 'gauresh', 'call', 23, '["2026-02-05", "2026-02-20", "2026-03-09", "2026-03-16", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21"]', 'c1'),
  ('aditya', 'kalesh', 'call', 17, '["2026-02-18", "2026-03-04", "2026-03-10", "2026-03-12", "2026-03-13", "2026-03-14"]', 'c2'),
  ('gauresh', 'varad', 'call', 14, '["2026-02-21", "2026-03-07", "2026-03-15", "2026-03-18", "2026-03-19", "2026-03-20"]', 'c1'),
  ('gauresh', 'divakar', 'call', 9, '["2026-02-11", "2026-03-03", "2026-03-22", "2026-03-28", "2026-04-01"]', 'c3'),
  ('gauresh', 'kaustubh', 'call', 8, '["2026-01-30", "2026-02-26", "2026-03-20", "2026-03-29"]', null),
  ('kaustubh', 'divakar', 'call', 12, '["2025-11-20", "2025-12-02", "2025-12-08", "2025-12-09", "2025-12-10", "2026-03-30"]', 'c4'),
  ('kalesh', 'anish', 'call', 21, '["2026-01-25", "2026-02-11", "2026-02-19", "2026-03-08", "2026-03-19", "2026-03-27", "2026-03-31"]', null),
  ('anish', 'varad', 'call', 16, '["2026-01-18", "2026-02-05", "2026-02-20", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-03-09"]', 'c5'),

  -- Meetings
  ('dhruv', 'aditya', 'meeting', 7, '["2026-02-10", "2026-03-08", "2026-03-18", "2026-03-21"]', 'c1'),
  ('dhruv', 'kalesh', 'meeting', 4, '["2026-01-20", "2026-03-11", "2026-03-13"]', 'c2'),
  ('dhruv', 'pranit', 'meeting', 3, '["2026-03-14", "2026-03-19"]', 'c1'),
  ('anish', 'kalesh', 'meeting', 5, '["2026-02-27", "2026-03-10", "2026-03-26"]', null),

  -- Money trail (financing) → Anish Papadkar
  ('dhruv', 'anish', 'transaction', 9, '["2026-01-15", "2026-02-14", "2026-03-05", "2026-03-28"]', null),
  ('kalesh', 'anish', 'transaction', 7, '["2026-02-03", "2026-02-27", "2026-03-18"]', null),
  ('aditya', 'anish', 'transaction', 4, '["2026-03-01", "2026-04-01"]', 'c3'),

  -- Ownership (persons → phones / vehicles)
  ('dhruv', 'ph1', 'ownership', 1, '["2024-06-01"]', null),
  ('aditya', 'ph2', 'ownership', 1, '["2024-07-01"]', null),
  ('anish', 'ph3', 'ownership', 1, '["2024-05-01"]', null),
  ('divakar', 'ph4', 'ownership', 1, '["2023-09-01"]', null),
  ('gauresh', 'ph5', 'ownership', 1, '["2025-02-01"]', null),
  ('kalesh', 'ph6', 'ownership', 1, '["2024-08-01"]', null),
  ('kaustubh', 'ph7', 'ownership', 1, '["2025-01-01"]', null),
  ('varad', 'ph8', 'ownership', 1, '["2025-04-01"]', null),
  ('pranit', 'ph9', 'ownership', 1, '["2025-06-01"]', null),
  ('dhruv', 'v1', 'ownership', 1, '["2023-11-01"]', null),
  ('aditya', 'v2', 'ownership', 1, '["2023-08-01"]', null),
  ('gauresh', 'v3', 'ownership', 1, '["2025-03-01"]', null),
  ('divakar', 'v4', 'ownership', 1, '["2022-12-01"]', null),
  ('varad', 'v5', 'ownership', 1, '["2024-10-01"]', null),

  -- Burner phone usage before FIRs (unknown subscribers)
  ('ph10', 'aditya', 'call', 22, '["2026-03-19", "2026-03-19", "2026-03-20", "2026-03-20", "2026-03-21", "2026-03-21", "2026-03-22", "2026-03-22"]', 'c1'),
  ('ph11', 'kalesh', 'call', 9, '["2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"]', 'c2'),
  ('ph12', 'anish', 'call', 14, '["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02"]', 'c3'),

  -- Smuggling spike between Mumbai and the port (Nhava Sheva) before FIR #MH/2026/0803
  ('divakar', 'aditya', 'call', 30, '["2026-01-22", "2026-03-10", "2026-03-30", "2026-03-31", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-02", "2026-04-02"]', 'c3'),

  -- Organisation & location associations
  ('dhruv', 'org1', 'associate', 1, '["2016-06-01"]', null),
  ('kalesh', 'org1', 'associate', 1, '["2017-01-01"]', null),
  ('anish', 'org2', 'associate', 1, '["2015-03-01"]', null),
  ('varad', 'org2', 'associate', 1, '["2018-05-01"]', null),
  ('divakar', 'org3', 'associate', 1, '["2016-09-01"]', null),
  ('gauresh', 'org3', 'associate', 1, '["2020-02-01"]', null),
  ('dhruv', 'loc1', 'meeting', 3, '["2026-02-10", "2026-03-18", "2026-03-21"]', null),
  ('gauresh', 'loc2', 'meeting', 4, '["2026-03-15", "2026-03-19", "2026-04-01"]', 'c1'),
  ('divakar', 'loc3', 'meeting', 2, '["2026-03-30", "2026-04-02"]', 'c3'),
  ('anish', 'loc4', 'meeting', 3, '["2026-02-20", "2026-02-26"]', 'c5'),
  ('kaustubh', 'loc5', 'meeting', 2, '["2025-12-05", "2026-03-29"]', null),
  ('divakar', 'loc6', 'meeting', 4, '["2025-11-25", "2025-12-08", "2026-03-28"]', 'c4'),

  -- Co-accused per FIR
  ('dhruv', 'aditya', 'co-accused', 1, '["2026-03-22"]', 'c1'),
  ('dhruv', 'gauresh', 'co-accused', 1, '["2026-03-22"]', 'c1'),
  ('aditya', 'gauresh', 'co-accused', 1, '["2026-03-22"]', 'c1'),
  ('varad', 'pranit', 'co-accused', 1, '["2026-03-22"]', 'c1'),
  ('kalesh', 'aditya', 'co-accused', 1, '["2026-03-14"]', 'c2'),
  ('divakar', 'anish', 'co-accused', 1, '["2026-04-02"]', 'c3'),
  ('divakar', 'kaustubh', 'co-accused', 1, '["2025-12-10"]', 'c4'),
  ('anish', 'varad', 'co-accused', 1, '["2026-02-27"]', 'c5');