extends RefCounted
## Economía enlazada del pueblo: herramientas que se gastan y se compran al herrero, muebles del
## carpintero, jornaleros contratados con un bando en la plaza (mina, campos, bosque) y el mayordomo.

## Usos que aguanta cada herramienta antes de romperse.
const WEAR := {"hacha": 120, "pico": 90, "hoz": 6, "caña": 80}
## Precio de cada herramienta en el herrero del pueblo: [oro, hierro que gasta el herrero].
const SMITH_PRICE := {"hacha": [18, 1], "pico": [22, 2], "hoz": [15, 1], "caña": [6, 0]}
## Muebles: [nombre, madera, oro, efecto].
const FURNITURE := {
	"cama": ["Cama de madera con colchón de lana", 25, 15, "al dormir recuperas toda la fuerza (sin cama, solo 70)"],
	"mesa": ["Mesa y bancos", 20, 8, "tu familia aprovecha mejor la comida (come un 15% menos)"],
	"arcon": ["Arcón con cerradura", 15, 12, "los ladrones nocturnos se llevan la mitad"],
	"hogar": ["Hogar de piedra con chimenea", 10, 20, "en invierno gastas la mitad de leña y no pasas frío"],
}
## Jornaleros: [nombre, sueldo diario, lo que hacen].
const JOBS := {
	"mina": ["Mineros para tu mina", 3, "+1 hierro y +2 piedra al día cada uno (hace falta la mina abierta)"],
	"bosque": ["Leñadores", 2, "+5 madera al día cada uno"],
	"campos": ["Jornaleros del campo", 2, "cosechan y siembran tus parcelas; con 2 o más, rinden un 20% más"],
	"cantera": ["Canteros", 2, "+4 piedra al día cada uno"],
}


static func ensure() -> void:
	var d = GS.data
	if not d.has("wear"):
		d["wear"] = {}
		for t in d["tools"]:
			d["wear"][t] = WEAR.get(t, 50)
	if not d.has("furniture"):
		d["furniture"] = []
	if not d.has("hired"):
		d["hired"] = {"mina": 0, "bosque": 0, "campos": 0, "cantera": 0}


static func has(f: String) -> bool:
	ensure()
	return f in GS.data["furniture"]


## Gasta un uso de la herramienta; si se rompe, desaparece.
static func use_tool(t: String) -> void:
	ensure()
	var d = GS.data
	if not t in d["tools"]:
		return
	d["wear"][t] = int(d["wear"].get(t, WEAR.get(t, 50))) - 1
	if int(d["wear"][t]) <= 0:
		d["tools"].erase(t)
		d["wear"].erase(t)
		GS.popups.append({"title": "Se te ha roto: %s" % GS.TOOLS[t].split(" (")[0], "text": "De tanto usarla, la herramienta se ha partido. Cómprale otra al herrero del pueblo o forja una en tu herrería.", "button": "Vaya"})


static func tool_state(t: String) -> String:
	ensure()
	if not t in GS.data["tools"]:
		return "no tienes"
	return "%d%%" % int(100.0 * float(GS.data["wear"].get(t, 0)) / float(WEAR.get(t, 50)))


## ¿Hay alguien en el pueblo que forje? Un vecino herrero o tu propia herrería.
static func smith() -> String:
	for v in GS.data["villagers"]:
		if v["job"] == "herrero":
			return GS.full_name(v)
	if GS.has_building("herreria"):
		return "tu herrería"
	return "un buhonero de paso (más caro: no hay herrero en el pueblo)"


## Herramientas forjadas que hay en el pueblo (en casa del herrero o en el mercado).
static func forged_stock() -> int:
	var SIM := preload("res://scripts/village_sim.gd")
	var n := int(SIM.mstock().get("herramientas", 0))
	for vv in GS.data["villagers"]:
		if vv["job"] == "herrero":
			n += SIM.vinv(vv, "herramientas")
	return n


static func _take_forged() -> void:
	var SIM := preload("res://scripts/village_sim.gd")
	for vv in GS.data["villagers"]:
		if vv["job"] == "herrero" and SIM.vinv(vv, "herramientas") > 0:
			SIM.vadd(vv, "herramientas", -1)
			return
	var ms: Dictionary = SIM.mstock()
	ms["herramientas"] = maxi(0, int(ms.get("herramientas", 0)) - 1)


static func smith_panel(v) -> void:
	ensure()
	var d = GS.data
	var who := smith()
	var peddler := who.begins_with("un buhonero")
	var village_smith := not peddler and who != "tu herrería"
	var stock := forged_stock()
	var opts := []
	var text := "Herramientas de %s. Cada herramienta se gasta con el uso y acaba rompiéndose.\nTu oro: %d" % [who, int(d["gold"])]
	if village_smith:
		text += "\nEl herrero forja con hierro y madera del pueblo. Herramientas hechas: %d." % stock
		if stock == 0:
			text += "\n\nAhora no tiene nada forjado: le falta hierro. Vende hierro en el mercado (o contrata mineros) y en unos días tendrá herramientas."
			d["demand"]["hierro"] = int(d["demand"].get("hierro", 0)) + 4
	for t in SMITH_PRICE:
		var pr: Array = SMITH_PRICE[t].duplicate()
		if peddler:
			pr[0] = int(pr[0] * 1.6)
		elif village_smith and stock <= 1:
			pr[0] = int(pr[0] * 1.3)
		var owned: bool = t in d["tools"]
		var can: bool = int(d["gold"]) >= int(pr[0]) and (not village_smith or stock > 0 or t == "caña")
		opts.append(["%s — %d oro%s" % [GS.TOOLS[t].split(" (")[0], int(pr[0]), " (tienes una al %s)" % tool_state(t) if owned else ""], func():
			d["gold"] = int(d["gold"]) - int(pr[0])
			if not t in d["tools"]:
				d["tools"].append(t)
			d["wear"][t] = WEAR[t]
			if village_smith and t != "caña":
				_take_forged()
			for vv in d["villagers"]:
				if vv["job"] == "herrero":
					vv["affection"] = mini(100, int(vv["affection"]) + 3)
					vv["gold"] = int(vv["gold"]) + int(pr[0]) / 2
			SFX.play("monedas")
			smith_panel(v), can])
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("El herrero", text, opts)


static func carpenter() -> String:
	for v in GS.data["villagers"]:
		if v["job"] == "carpintero":
			return GS.full_name(v)
	for v in GS.data["villagers"]:
		if v["job"] == "leñador":
			return GS.full_name(v)
	return ""


static func furniture_panel(v) -> void:
	ensure()
	var d = GS.data
	var opts := []
	var who := carpenter()
	var text := "Muebles para tu casa. %s\nTienes %d madera y %d oro." % ["Te los hace %s, el leñador del pueblo." % who if who != "" else "No hay leñador en el pueblo: te los harás tú (cuestan el doble de madera).", int(d["wood"]), int(d["gold"])]
	if int(d["house_level"]) < 1:
		text = "Primero necesitas una casa donde poner los muebles."
	else:
		for k in FURNITURE:
			var f: Array = FURNITURE[k]
			var wood: int = int(f[1]) * (1 if who != "" else 2)
			var gold: int = int(f[2]) if who != "" else 0
			if has(k):
				continue
			opts.append(["%s (%d madera%s): %s" % [f[0], wood, ", %d oro" % gold if gold > 0 else "", f[3]], func():
				d["wood"] = int(d["wood"]) - wood
				d["gold"] = int(d["gold"]) - gold
				d["furniture"].append(k)
				GS.say("Ya tienes en casa: %s." % String(f[0]).to_lower())
				furniture_panel(v), int(d["wood"]) >= wood and int(d["gold"]) >= gold])
		var have := []
		for k in d["furniture"]:
			have.append(FURNITURE[k][0])
		if not have.is_empty():
			text += "\n\nYa tienes: " + ", ".join(have) + "."
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Muebles", text, opts)


# ---------------- Bando y jornaleros ----------------

static func max_hire() -> int:
	return maxi(2, int(GS.data["commons"]) / 8)


static func hired_total() -> int:
	ensure()
	var n := 0
	for k in GS.data["hired"]:
		n += int(GS.data["hired"][k])
	return n


static func board(v) -> void:
	ensure()
	var d = GS.data
	var opts := []
	var lines := ["Bando del pueblo: \"Se busca gente para trabajar\".", "Del pueblo llano puedes contratar hasta %d jornaleros (tienes %d). Se les paga cada día; si no hay oro, se marchan." % [max_hire(), hired_total()], ""]
	for k in JOBS:
		var j: Array = JOBS[k]
		var n := int(d["hired"][k])
		lines.append("%s: %d · %d oro/día cada uno · %s" % [j[0], n, int(j[1]), j[2]])
		var ok: bool = hired_total() < max_hire() and (k != "mina" or d["mine"])
		opts.append(["Contratar: %s" % String(j[0]).to_lower(), func():
			d["hired"][k] = int(d["hired"][k]) + 1
			GS.say("Un vecino acude al bando: trabajará para ti (%s)." % String(j[0]).to_lower())
			board(v), ok])
		opts.append(["Despedir: %s" % String(j[0]).to_lower(), func():
			d["hired"][k] = maxi(0, int(d["hired"][k]) - 1)
			board(v), n > 0])
	lines.append("")
	lines.append("Mayordomo: %s (4 oro/día; cosecha, siembra y vende lo que sobra)." % ("contratado" if d.get("steward", false) else "no tienes"))
	opts.append([("Despedir al mayordomo" if d.get("steward", false) else "Contratar un mayordomo"), func():
		d["steward"] = not d.get("steward", false)
		board(v)])
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Bando: se busca gente", "\n".join(lines), opts)


## Cada día: sueldos y trabajo de los jornaleros.
static func day() -> void:
	ensure()
	var d = GS.data
	var cost := 0
	for k in JOBS:
		cost += int(d["hired"][k]) * int(JOBS[k][1])
	if cost == 0:
		return
	if int(d["gold"]) < cost:
		for k in d["hired"]:
			d["hired"][k] = 0
		GS.say("No tienes oro para pagar a tus jornaleros: se marchan todos.")
		return
	d["gold"] = int(d["gold"]) - cost
	var winter := int(d["season"]) == 3
	var h: Dictionary = d["hired"]
	if d["mine"]:
		GS.add("hierro", int(h["mina"]))
		d["stone"] = int(d["stone"]) + 2 * int(h["mina"])
	d["wood"] = int(d["wood"]) + int(h["bosque"]) * (2 if winter else 5)
	d["stone"] = int(d["stone"]) + 4 * int(h["cantera"])
	if int(h["campos"]) > 0:
		for i in d["fields"].size():
			var f = d["fields"][i]
			if f["owned"] and GS.field_ready(f):
				var crop: String = f["crop"]
				GS.harvest(i)
				if int(h["campos"]) >= 2:
					GS.add(crop, 2)
				GS.plant(i, crop)
			elif f["owned"] and f["crop"] == "" and not winter:
				GS.plant(i, "trigo")
