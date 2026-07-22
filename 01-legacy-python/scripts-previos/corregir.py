"""Corrección de los 5 instrumentos administrados al evaluado."""

# ============ NEO-FFI ============
# a=0, b=1, c=2, d=3, e=4 (inverso: a=4, b=3, c=2, d=1, e=0)

letter = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}

neo_resp = {
    1: "A", 2: "E", 3: "C", 4: "E", 5: "D", 6: "B", 7: "E", 8: "D", 9: "E", 10: "D",
    11: "A", 12: "C", 13: "E", 14: "D", 15: "E", 16: "B", 17: "A", 18: "D", 19: "C", 20: "D",
    21: "A", 22: "D", 23: "B", 24: "D", 25: "E", 26: "B", 27: "A", 28: "D", 29: "B", 30: "D",
    31: "A", 32: "E", 33: "D", 34: "E", 35: "E", 36: "B", 37: "B", 38: "B", 39: "E", 40: "E",
    41: "E", 42: "D", 43: "A", 44: "E", 45: "E", 46: "E", 47: "E", 48: "D", 49: "B", 50: "D",
    51: "B", 52: "E", 53: "E", 54: "E", 55: "B", 56: "E", 57: "A", 58: "A", 59: "A", 60: "B",
}

# Claves estándar NEO-FFI (Costa & McCrae)
# Cada dimensión: items con signo '+' (directo) o '-' (invertido)
neo_key = {
    "N": [("+",1),("-",6),("+",11),("+",16),("+",21),("+",26),("+",31),("+",36),("-",41),("-",46),("+",51),("-",56)],
    "E": [("+",2),("+",7),("+",12),("-",17),("+",22),("-",27),("+",32),("-",37),("-",42),("+",47),("+",52),("-",57)],
    "O": [("+",3),("-",8),("+",13),("+",18),("-",23),("+",28),("+",33),("-",38),("-",43),("+",48),("+",53),("-",58)],
    "A": [("+",4),("-",9),("-",14),("+",19),("+",24),("+",29),("-",34),("+",39),("+",44),("+",49),("-",54),("-",59)],
    "C": [("-",5),("+",10),("+",15),("+",20),("+",25),("+",30),("+",35),("+",40),("+",45),("-",50),("-",55),("-",60)],
}
# Nota: en el NEO-FFI estándar el ítem 19 ("Si alguien empieza a pelearse...") es invertido para A.
# Ajuste: item 19 en A → inverso.
neo_key["A"] = [("+",4),("-",9),("-",14),("-",19),("+",24),("+",29),("-",34),("+",39),("+",44),("+",49),("-",54),("-",59)]

def score_neo(dim):
    total = 0
    for sign, item in neo_key[dim]:
        val = letter[neo_resp[item]]
        if sign == "-":
            val = 4 - val
        total += val
    return total

neo_raw = {d: score_neo(d) for d in "NEOAC"}
print("NEO raw:", neo_raw)

# Tabla baremo Varones+Mujeres → T-score
neo_baremo = {
    "N": {14:50,13:49,12:47,11:46,10:44,9:42,8:41,7:39,6:38,5:36,4:35,3:34,2:32,1:30,0:25,
          15:51,16:53,17:54,18:55,19:56,20:58,21:59,22:60,23:61,24:62,25:63,26:64,27:65,28:66,29:67,30:68,31:69,32:70,33:71,34:72,35:73,36:75,37:75,38:75,39:75,40:75,41:75,42:75,43:75,44:75,45:75,46:75,47:75,48:75},
    "E": {32:50,31:48,30:47,29:45,28:44,27:42,26:41,25:39,24:38,23:37,22:35,21:33,20:32,19:31,18:30,17:29,16:27,15:26,14:25,13:25,
          33:51,34:53,35:54,36:56,37:55,38:56,39:61,40:63,41:64,42:66,43:68,44:70,45:72,46:75,47:75,48:75},
    "O": {28:50,27:48,26:47,25:45,24:44,23:42,22:41,21:39,20:38,19:37,18:36,17:34,16:33,15:31,14:30,13:29,12:28,11:25,
          29:51,30:53,31:54,32:56,33:57,34:59,35:61,36:62,37:64,38:65,39:67,40:69,41:71,42:72,43:73,44:75},
    "A": {32:50,31:48,30:46,29:44,28:42,27:40,26:39,25:38,24:37,23:36,22:33,21:32,20:30,19:29,18:27,17:26,16:25,
          33:53,34:55,35:58,36:57,37:59,38:61,39:62,40:64,41:65,42:67,43:68,44:70,45:72,46:74,47:75,48:75},
    "C": {35:50,34:47,33:46,32:44,31:42,30:40,29:39,28:38,27:37,26:35,25:34,24:33,23:32,22:30,21:29,20:28,19:27,18:26,17:26,16:25,
          36:51,37:53,38:54,39:56,40:57,41:59,42:61,43:62,44:65,45:67,46:69,47:72,48:75},
}
neo_t = {d: neo_baremo[d].get(neo_raw[d], "—") for d in "NEOAC"}
print("NEO T:", neo_t)

def nivel_t(t):
    if t >= 66: return "Muy Alto"
    if t >= 56: return "Alto"
    if t >= 45: return "Promedio"
    if t >= 35: return "Bajo"
    return "Muy Bajo"

neo_niv = {d: nivel_t(neo_t[d]) for d in "NEOAC"}
print("NEO nivel:", neo_niv)

# ============ CELID-A ============
celid = {
    1:1,2:4,3:3,4:5,5:2,6:4,7:5,8:1,9:2,10:4,11:2,12:5,13:5,14:5,15:5,16:4,17:5,
    18:4,19:4,20:1,21:4,22:4,23:4,24:3,25:4,26:5,27:1,28:5,29:5,30:4,31:3,32:1,33:4,34:4,
}

def mean(items): return sum(celid[i] for i in items)/len(items)

carisma = mean([3,21,33,34])
est_int = mean([4,15,23,25,28,29,30])
inspir = mean([19,22,24])
cons_ind = mean([13,14,17])
transf_total = (celid[3]+celid[21]+celid[33]+celid[34] + celid[4]+celid[15]+celid[23]+celid[25]+celid[28]+celid[29]+celid[30] + celid[19]+celid[22]+celid[24] + celid[13]+celid[14]+celid[17]) / 17

rec_cont = mean([8,10,11,12,16])
dir_exc = mean([2,5,7,9,18,26])
trans_total = (celid[8]+celid[10]+celid[11]+celid[12]+celid[16] + celid[2]+celid[5]+celid[7]+celid[9]+celid[18]+celid[26]) / 11

laissez = mean([1,6,20,27,31,32])

print("CELID-A:")
print(f"  Carisma: {carisma:.2f}")
print(f"  Estim.Int: {est_int:.2f}")
print(f"  Inspiración: {inspir:.2f}")
print(f"  Consid.Ind: {cons_ind:.2f}")
print(f"  Transf.Total: {transf_total:.2f}")
print(f"  Rec.Cont: {rec_cont:.2f}")
print(f"  Dir.Exc: {dir_exc:.2f}")
print(f"  Trans.Total: {trans_total:.2f}")
print(f"  Laissez-Faire: {laissez:.2f}")

# Baremos CELID-A - percentiles
def percentil(valor, tabla):
    """tabla = [(percentil, corte), ...] ordenada desc por percentil."""
    for p, c in tabla:
        if valor >= c:
            return p
    return 1

celid_bar = {
    "Carisma": [(99,5.00),(95,4.75),(90,4.75),(75,4.25),(50,4.00),(25,3.75),(10,3.23),(5,3.00)],
    "EstimInt": [(99,5.00),(95,4.86),(90,4.71),(75,4.43),(50,4.00),(25,3.43),(10,3.14),(5,2.94)],
    "Inspir": [(99,5.00),(95,5.00),(90,4.67),(75,4.33),(50,3.67),(25,3.33),(10,3.00),(5,2.67)],
    "ConsInd": [(99,5.00),(95,5.00),(90,5.00),(75,4.67),(50,4.00),(25,3.67),(10,3.33),(5,3.00)],
    "TransfTot": [(99,4.94),(95,4.70),(90,4.48),(75,4.20),(50,3.96),(25,3.65),(10,3.28),(5,3.20)],
    "RecCont": [(99,4.80),(95,4.60),(90,4.40),(75,3.80),(50,3.40),(25,2.80),(10,2.40),(5,2.00)],
    "DirExc": [(99,4.83),(95,4.50),(90,4.30),(75,3.83),(50,3.33),(25,3.00),(10,2.50),(5,2.33)],
    "TransTot": [(99,4.38),(95,4.25),(90,4.07),(75,3.72),(50,3.33),(25,3.00),(10,2.66),(5,2.34)],
    "Laissez": [(99,4.20),(95,3.83),(90,3.33),(75,2.83),(50,2.33),(25,1.83),(10,1.67),(5,1.33)],
}

def nivel_pct(p):
    if p >= 75: return "Alto"
    if p >= 25: return "Medio"
    return "Bajo"

print("  Percentiles:")
for k,v in [("Carisma",carisma),("EstimInt",est_int),("Inspir",inspir),("ConsInd",cons_ind),("TransfTot",transf_total),("RecCont",rec_cont),("DirExc",dir_exc),("TransTot",trans_total),("Laissez",laissez)]:
    p = percentil(v, celid_bar[k])
    print(f"    {k}: valor={v:.2f} P~{p} → {nivel_pct(p)}")

# ============ POTENLID ============
poten = {1:5,2:2,3:1,4:4,5:1,6:4,7:4,8:5,9:1}
m_intr = poten[1]+poten[6]+poten[8]
m_extr = poten[2]+poten[4]+poten[7]
m_soc = poten[3]+poten[5]+poten[9]
print(f"\nPOTENLID:")
print(f"  Intrínseca: {m_intr}")
print(f"  Extrínseca: {m_extr}")
print(f"  Social Normativa: {m_soc}")

poten_bar = {
    "Intr": [(99,15),(95,15),(90,15),(75,13),(50,11),(25,9),(10,6),(5,5)],
    "Extr": [(99,15),(95,13),(90,11),(75,9),(50,6),(25,3),(10,3),(5,3)],
    "Soc":  [(99,15),(95,13),(90,12),(75,10),(50,8),(25,6),(10,5),(5,3)],
}
for k,v in [("Intr",m_intr),("Extr",m_extr),("Soc",m_soc)]:
    p = percentil(v, poten_bar[k])
    print(f"    {k}: P~{p} → {nivel_pct(p)}")

# ============ CAMIN-A ============
cam = {1:7,2:5,3:7,4:6,5:6,6:7,7:7,8:5,9:6,10:6,11:6,12:5}
directivo = cam[1]+cam[5]+cam[9]
considerado = cam[2]+cam[6]+cam[10]
participativo = cam[3]+cam[7]+cam[11]
orientado = cam[4]+cam[8]+cam[12]
print(f"\nCAMIN-A:")
print(f"  Directivo: {directivo}")
print(f"  Considerado: {considerado}")
print(f"  Participativo: {participativo}")
print(f"  Orientado a Metas: {orientado}")

cam_bar = {
    "Dir": [(99,21),(95,21),(90,21),(75,19),(50,18),(25,15),(10,12),(5,11)],
    "Cons": [(99,21),(95,21),(90,20),(75,19),(50,17),(25,15),(10,13),(5,12)],
    "Part": [(99,21),(95,21),(90,20),(75,18),(50,16),(25,13),(10,10),(5,9)],
    "Or":   [(99,21),(95,21),(90,19),(75,17),(50,15),(25,12),(10,10),(5,8)],
}
for k,v in [("Dir",directivo),("Cons",considerado),("Part",participativo),("Or",orientado)]:
    p = percentil(v, cam_bar[k])
    print(f"    {k}: P~{p} → {nivel_pct(p)}")

# ============ CONLID-A ============
con = {1:4,2:3,3:5,4:4,5:3,6:4,7:5,8:5,9:4,10:4,11:5,12:4,13:5,14:3,15:3,16:5,17:5,18:5}
tarea = con[2]+con[5]+con[8]+con[11]+con[14]+con[17]
rel = con[1]+con[4]+con[7]+con[10]+con[13]+con[16]
camb = con[3]+con[6]+con[9]+con[12]+con[15]+con[18]
print(f"\nCONLID-A:")
print(f"  Tarea: {tarea}")
print(f"  Relaciones: {rel}")
print(f"  Cambio: {camb}")

con_bar = {
    "Tar": [(99,30),(95,30),(90,29),(75,27),(50,24),(25,22),(10,19),(5,17)],
    "Rel": [(99,30),(95,30),(90,29),(75,28),(50,26),(25,24),(10,21),(5,19)],
    "Camb":[(99,30),(95,28),(90,26),(75,24),(50,21),(25,18),(10,16),(5,14)],
}
for k,v in [("Tar",tarea),("Rel",rel),("Camb",camb)]:
    p = percentil(v, con_bar[k])
    print(f"    {k}: P~{p} → {nivel_pct(p)}")
