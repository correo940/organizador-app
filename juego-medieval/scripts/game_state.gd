extends Node
## Estado global de la partida (autoload "GS").

signal notify(text: String)

const SAVE_PATH := "user://partida.json"
const SECONDS_PER_DAY := 40.0
const DAYS_PER_SEASON := 5
const SEASONS := ["Primavera", "Verano", "Otoño", "Invierno"]
const HOUSE_NAMES := ["Sin casa", "Choza", "Casa de piedra", "Casa solariega"]
const HOUSE_COSTS := [
	{"wood": 20, "stone": 10, "gold": 0},
	{"wood": 40, "stone": 30, "gold": 20},
	{"wood": 60, "stone": 60, "gold": 50},
]
const CHIEF_PRESTIGE := 150
const MALE_NAMES := ["Rodrigo", "Sancho", "Alonso", "Fernando", "Gonzalo", "Diego", "Martín", "Pedro", "Íñigo", "Bermudo", "Ramiro", "García", "Nuño", "Álvaro", "Tello"]
const FEMALE_NAMES := ["Urraca", "Jimena", "Elvira", "Sancha", "Teresa", "Leonor", "Berenguela", "Mencía", "Aldonza", "Constanza", "Toda", "Mayor", "Inés", "Blanca", "Oria"]
const ENEMIES := ["los bandidos del bosque", "el señor de Valdeoscuro", "los invasores del norte", "un barón rebelde", "los saqueadores del río"]
const HOMES := [Vector2(760, 620), Vector2(760, 1000), Vector2(980, 1180), Vector2(1380, 1180), Vector2(1640, 1040), Vector2(1660, 560), Vector2(900, 330), Vector2(1520, 300)]

var data := {}
var speed := 1.0
var popups: Array = []  # mensajes importantes (muertes) que la aldea muestra en ventana


func rng_name(male: bool) -> String:
	return (MALE_NAMES if male else FEMALE_NAMES).pick_random()


func new_villager(home: Vector2) -> Dictionary:
	var m := randf() < 0.5
	return {"name": rng_name(m), "male": m, "age": randi_range(17, 34), "affection": 0, "hx": home.x, "hy": home.y}


func new_game(pname: String, dynasty: String, male: bool) -> void:
	data = {
		"day": 1, "season": 0, "year": 1100, "time": 0.3, "total_days": 0, "taxed": -1,
		"gold": 15, "wood": 0, "stone": 0, "food": 12,
		"prestige": 0, "title": 0, "house_level": 0, "weapon": 0, "armor": 0,
		"dynasty": dynasty, "generation": 1,
		"player": {"name": pname, "male": male, "age": 18, "health": 100.0},
		"spouse": null, "children": [], "villagers": [],
		"summons": null, "talked": [], "log": [],
	}
	for h in HOMES:
		data["villagers"].append(new_villager(h))
	popups.clear()
	say("%s %s llega a la aldea con lo puesto. Empieza tu linaje." % [pname, dynasty])


func say(text: String) -> void:
	data["log"].append(text)
	if data["log"].size() > 8:
		data["log"].pop_front()
	notify.emit(text)


func family_size() -> int:
	return 1 + (1 if data["spouse"] != null else 0) + data["children"].size()


func season_index() -> int:
	return int(data["year"]) * 4 + int(data["season"])


# ---------------- Tiempo ----------------

func advance(delta: float) -> void:
	if data.get("game_over", false):
		return
	data["time"] += delta * speed / SECONDS_PER_DAY
	if data["time"] >= 1.0:
		data["time"] -= 1.0
		next_day()


func sleep() -> void:
	if data["time"] > 0.25:
		next_day()
	data["time"] = 0.25
	var p = data["player"]
	p["health"] = minf(100.0, p["health"] + 10.0)
	say("Descansas en casa hasta el amanecer.")


func next_day() -> void:
	if data.get("game_over", false):
		return
	data["total_days"] += 1
	data["day"] += 1
	data["talked"] = []
	var p = data["player"]
	data["food"] -= family_size()
	if data["food"] < 0:
		data["food"] = 0
		p["health"] -= 15.0
		say("Tu familia pasa hambre. (-15 salud)")
	else:
		p["health"] = minf(100.0, p["health"] + 4.0)
	if data["spouse"] != null and data["children"].size() < 6 and p["age"] >= 16 and p["age"] < 48 and data["spouse"]["age"] < 46 and randf() < 0.06:
		var m := randf() < 0.5
		var cname := rng_name(m)
		data["children"].append({"name": cname, "male": m, "age": 0})
		data["prestige"] += 5
		say("¡Ha nacido tu %s %s! (+5 prestigio)" % ["hijo" if m else "hija", cname])
	if data["summons"] != null and data["total_days"] > data["summons"]["deadline"]:
		data["summons"] = null
		data["prestige"] = maxi(0, int(data["prestige"]) - 20)
		data["gold"] = maxi(0, int(data["gold"]) - 10)
		say("No acudiste a la llamada del rey: multa de 10 oro y -20 prestigio.")
	if data["day"] > DAYS_PER_SEASON:
		data["day"] = 1
		next_season()
	if p["health"] <= 0:
		player_death("murió de hambre y enfermedad")


func next_season() -> void:
	data["season"] += 1
	if data["season"] >= 4:
		data["season"] = 0
		data["year"] += 1
		new_year()
	if data.get("game_over", false):
		return
	say("Comienza %s del año %d." % [["la primavera", "el verano", "el otoño", "el invierno"][int(data["season"])], int(data["year"])])
	if data["summons"] == null and data["player"]["age"] >= 16 and data["player"]["age"] <= 60 and randf() < 0.45:
		data["summons"] = {"deadline": int(data["total_days"]) + 4, "enemy": ENEMIES.pick_random()}
		if int(data["title"]) == 1:
			say("¡El rey ordena que lleves la milicia del pueblo contra %s! Ve al campamento del este (4 días)." % data["summons"]["enemy"])
		else:
			say("¡El rey te llama a las armas contra %s! Ve al campamento del este (4 días)." % data["summons"]["enemy"])
	save_game()


func new_year() -> void:
	var p = data["player"]
	p["age"] += 1
	for c in data["children"]:
		c["age"] += 1
		if int(c["age"]) == 16:
			say("%s ya es adulto y puede ser tu heredero." % c["name"])
	for v in data["villagers"]:
		v["age"] += 1
	var s = data["spouse"]
	if s != null:
		s["age"] += 1
		if s["age"] >= 55 and randf() < (s["age"] - 52) * 0.04:
			say("Tu cónyuge %s ha fallecido a los %d años." % [s["name"], int(s["age"])])
			data["spouse"] = null
	if p["age"] >= 50 and randf() < (p["age"] - 47) * 0.04:
		player_death("murió de vejez")


func player_death(reason: String) -> void:
	var p = data["player"]
	var text := "%s %s %s a los %d años." % [p["name"], data["dynasty"], reason, int(p["age"])]
	data["summons"] = null
	if data["children"].is_empty():
		data["game_over"] = true
		popups.append({"title": "Fin del linaje", "text": text + "\n\nNo dejó herederos. El linaje %s se ha extinguido.\nGeneraciones: %d · Prestigio final: %d" % [data["dynasty"], int(data["generation"]), int(data["prestige"])]})
		if FileAccess.file_exists(SAVE_PATH):
			DirAccess.remove_absolute(SAVE_PATH)
		return
	var heir_i := 0
	for i in data["children"].size():
		if data["children"][i]["age"] > data["children"][heir_i]["age"]:
			heir_i = i
	var heir = data["children"][heir_i]
	var siblings: int = data["children"].size() - 1
	data["player"] = {"name": heir["name"], "male": heir["male"], "age": heir["age"], "health": 100.0}
	data["children"] = []
	data["spouse"] = null
	data["generation"] += 1
	data["prestige"] = int(data["prestige"]) / 2
	var extra := "\n\nSus %d hermanos se marchan a buscar fortuna." % siblings if siblings > 0 else ""
	popups.append({"title": "Muere el cabeza de familia", "text": text + "\n\nSu heredero %s (%d años) hereda la casa y los bienes. Generación %d.%s" % [heir["name"], int(heir["age"]), int(data["generation"]), extra]})
	say("%s es ahora el cabeza del linaje %s." % [heir["name"], data["dynasty"]])
	save_game()


# ---------------- Acciones ----------------

func try_build_house() -> String:
	var lvl := int(data["house_level"])
	if lvl >= 3:
		return "Tu casa ya es la mejor del pueblo."
	var c = HOUSE_COSTS[lvl]
	if data["wood"] < c["wood"] or data["stone"] < c["stone"] or data["gold"] < c["gold"]:
		return "Te faltan materiales."
	data["wood"] -= c["wood"]
	data["stone"] -= c["stone"]
	data["gold"] -= c["gold"]
	data["house_level"] = lvl + 1
	data["prestige"] += 10 * (lvl + 1)
	say("Has construido: %s. (+%d prestigio)" % [HOUSE_NAMES[lvl + 1], 10 * (lvl + 1)])
	return ""


func marry(i: int) -> String:
	var v = data["villagers"][i]
	if data["spouse"] != null:
		return "Ya estás casado."
	if int(data["house_level"]) < 1:
		return "Necesitas una casa propia para casarte."
	if data["player"]["age"] < 16:
		return "Eres demasiado joven."
	data["spouse"] = {"name": v["name"], "male": v["male"], "age": v["age"]}
	data["villagers"][i] = new_villager(Vector2(v["hx"], v["hy"]))
	data["prestige"] += 10
	say("¡Te has casado con %s! (+10 prestigio)" % v["name"])
	return ""


func claim_chief() -> String:
	if int(data["prestige"]) < CHIEF_PRESTIGE or int(data["house_level"]) < 2:
		return "Necesitas %d de prestigio y una Casa de piedra." % CHIEF_PRESTIGE
	data["title"] = 1
	data["prestige"] += 30
	say("¡%s %s es ahora el jefe del pueblo!" % [data["player"]["name"], data["dynasty"]])
	return ""


# ---------------- Guardado ----------------

func save_game() -> void:
	if data.is_empty() or data.get("game_over", false):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func load_game() -> bool:
	if not has_save():
		return false
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if typeof(parsed) != TYPE_DICTIONARY:
		return false
	data = parsed
	popups.clear()
	return true
