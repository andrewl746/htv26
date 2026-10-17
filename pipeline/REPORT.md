# Pipeline report (Yuvi) — paste into /docs/decisions.md via Simone

## Y1: permits fields and rule check

**Rule A works** (after one classifier fix, below). 446 multiplex permits issued 2023-05-01 to 2024-11-30 vs the City's 452 (-1.3%).

Classifier fix: spec 4.3 step 5 says a structure type or use that names 2 to 6 units also makes a multiplex. Taken literally that gives 1,278 (+183%) because ~830 permits create 1 unit in a '2 Unit - Detached' structure (a suite added to a house). Counting only permits that create 2 to 6 units gives 446. Units created decides; named counts are reported but do not make a multiplex.

```
== Y1 permits report ==
active   rows  202,039   issued 1985-12-25 to 2026-10-14   no issue date 14,971
cleared  rows  444,342   issued 1979-11-27 to 2026-10-09   no issue date 35,021
total rows 646,381
rows repeating a (PERMIT_NUM, REVISION_NUM) pair: 5,082

DWELLING_UNITS_CREATED parsed as a number: 243,710 of 243,710 non-null (100.0%); null: 402,671
integer between 1 and 6: 43,139
integer between 1 and 6 and issued since 2022-01-01: 12,786

Rule A funnel:
    646,381  rows loaded
    182,261  issued on or after 2022-01-01
     12,786  units created 1 to 6
      8,301  STRUCTURE_TYPE not SFD* (or suite/laneway work)
      7,397  one row per project
  rows removed by the one-per-project step: 904
rows with units created = 1 whose structure/use names 2 to 6 units (kind other, not multiplex): 2,422

Rule A rows by kind (since 2022):
kind
other              2582
laneway_garden     1693
multiplex          1592
secondary_suite    1530

Issued 2023-05-01 to 2024-11-30 by kind:
kind
other              897
secondary_suite    530
laneway_garden     528
multiplex          446
multiplex in window: 446  vs the City's 452: -1.3%

Distinct STRUCTURE_TYPE (rows with units 1 to 6 issued since 2022-01-01; top 40 of 30):
STRUCTURE_TYPE
SFD - Detached                  3494
2 Unit - Detached               3463
Laneway / Rear Yard Suite       1908
3+ Unit - Detached              1095
SFD - Townhouse                  801
2 Unit - Semi-detached           674
Stacked Townhouses               343
3+ Unit - Semi-detached          290
SFD - Semi-Detached              199
2 Unit - Townhouse               151
Multiple Unit Building           136
Apartment Building                66
Duplex                            36
3+ Unit - Townhouse               34
Triplex                           24
Other                             22
Mixed Use/Res w Non Res           17
Multiple Use/Non Residential      12
Boarding/Lodging House             5
Triplex/Semi-Detached              5
Office                             2
Apartment Hotel                    1
Restaurant 30 Seats or Less        1
Other (New Housing)                1
Industrial                         1
Medical/Dental Office              1
Motel/Hotel                        1
Hospital                           1
Live/Work Unit                     1
Duplex/Semi-Detached               1

Distinct WORK (rows with units 1 to 6 issued since 2022-01-01; top 40 of 21):
WORK
New Building                     5357
Multiple Projects                2148
New Laneway / Rear Yard Suite    1948
Second Suite (New)               1703
Interior Alterations              922
Other(SR)                         188
Addition(s)                       140
New Building - By Renovation      138
New Building - Lead               117
New Building-Certified             56
Finishing Basements                26
Other(BA)                          16
Change of Use                      14
Accessory Building(s)               3
Walk-Out Stair                      2
Garage                              2
New Building Certified - Lead       2
Building Permit Related(PS)         1
Underpinning                        1
Fire Damage                         1
Deck                                1

Distinct PROPOSED_USE (rows with units 1 to 6 issued since 2022-01-01; top 40 of 1816):
PROPOSED_USE
Sfd                              1612
Sfd-Detached                      797
2 Unit Detached                   709
Sfd - Detached                    453
Sfd-Townhouse                     431
2 Unit - Detached                 417
Sfd Detached                      406
2 Unit Dwelling                   387
Stacked Townhouse                 274
Garden Suite                      238
Fourplex                          210
Sfd - Townhouse                   191
Laneway Suite                     149
2 Unit Sfd                        145
New House                         125
Duplex                            106
Single Family                     104
2 Unit-Detached                    99
Triplex                            94
3 Unit Detached                    89
2 Units-Detached                   88
2-Unit Dwelling                    85
Detached Sfd                       84
2 Unit                             81
2 Units Detached                   74
2 Unit Semi                        69
4 Unit Detached                    66
2-Unit Detached                    64
Sfd + Garden Suite                 55
2-Unit                             52
2 Unit - Semi Detached             51
4 Unit Dwelling                    50
2 Unit Semi Detached               50
3 Unit Dwelling                    49
Single Family Dwelling             48
Sfd-Detached/Garden Suite          46
Sfd - Detached + Garden Suite      45
3 Unit - Detached                  43
Sfd-Detached/Laneway Suite         42
2 Units                            39

Distinct STRUCTURE_TYPE among kept rows by kind (top 25):
kind             STRUCTURE_TYPE              
laneway_garden   Laneway / Rear Yard Suite       1630
                 2 Unit - Detached                 38
                 2 Unit - Semi-detached            13
                 3+ Unit - Detached                 4
                 2 Unit - Townhouse                 3
                 SFD - Detached                     2
                 3+ Unit - Semi-detached            2
                 SFD - Townhouse                    1
multiplex        3+ Unit - Detached               844
                 2 Unit - Detached                320
                 3+ Unit - Semi-detached          180
                 Multiple Unit Building            64
                 2 Unit - Semi-detached            45
                 Apartment Building                43
                 3+ Unit - Townhouse               23
                 Triplex                           18
                 Mixed Use/Res w Non Res           12
                 Duplex                            12
                 Other                             11
                 Multiple Use/Non Residential       5
                 Triplex/Semi-Detached              5
                 Boarding/Lodging House             4
                 2 Unit - Townhouse                 3
                 Motel/Hotel                        1
                 Office                             1
                 Apartment Hotel                    1
other            2 Unit - Detached               1670
                 2 Unit - Semi-detached           375
                 3+ Unit - Detached               166
                 2 Unit - Townhouse                90
                 3+ Unit - Semi-detached           84
                 Multiple Unit Building            72
                 Duplex                            23
                 Laneway / Rear Yard Suite         21
                 Apartment Building                18
                 Stacked Townhouses                17
                 Other                             11
                 3+ Unit - Townhouse                9
                 Multiple Use/Non Residential       7
                 Triplex                            6
                 Mixed Use/Res w Non Res            5
                 Office                             1
                 Live/Work Unit                     1
                 Medical/Dental Office              1
                 Industrial                         1
                 Restaurant 30 Seats or Less        1
                 Other (New Housing)                1
                 Hospital                           1
                 Boarding/Lodging House             1
secondary_suite  2 Unit - Detached               1251
                 2 Unit - Semi-detached           205
                 2 Unit - Townhouse                36
                 3+ Unit - Detached                15
                 3+ Unit - Semi-detached           11
                 SFD - Detached                     6
                 Laneway / Rear Yard Suite          4
                 Duplex/Semi-Detached               1
                 Stacked Townhouses                 1
```

## Y3: permits file checks

```
== permits ==
  rows 7,397; with coordinates 7,342; with a ward 7,342
  geocode method: geo_id 7,283, street_match 59, none 55
  [PASS] geocode rate 90% or better: 99.3%
  GEO_ID -> ADDRESS_POINT_ID join rate (T5): 98.5%
  issued 2023-05-01 to 2024-11-30 by kind: {'other': 897, 'secondary_suite': 530, 'laneway_garden': 528, 'multiplex': 446}
  [PASS] multiplex count within 15% of the City's 452: 446 (-1.3%)
  multiplex permits since 2023-05-01 by ward (compare with the Toronto Multiplex Tracker map):
   01:38  02:33  03:104  04:81  05:92  06:63  07:27  08:79  09:177  10:34  11:99  12:71  13:5  14:81  15:26  16:20  17:27  18:83  19:68  20:93  21:46  22:16  23:7  24:28  25:29
   wards with at least one: 25 of 25; no ward: 17
  [PASS] permit_counts.json: ward totals plus unlocated equal the city total: 1427 + 17 = 1444
  [PASS] permits.geojson carries only id, d, w, u, k (no permit numbers or addresses): 7,342 points

ALL CHECKS PASSED
```
