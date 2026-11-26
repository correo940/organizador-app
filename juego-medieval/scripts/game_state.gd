extends Node
## Estado global de la partida (autoload "GS").

signal notify(text: String)

const SIM := preload("res://scripts/village_sim.gd")
const ARMY := preload("res://scripts/army.gd")
const REGION := preload("res://scripts/region_sim.gd")
const EVENTS := preload("res://scripts/events.gd")
const QUESTS := preload("res://scripts/quests.gd")
const SOCIAL := preload("res://scripts/social.gd")
const ECON := preload("res://scripts/economy.gd")
const POL := preload("res://scripts/politics.gd")
const CHAR := preload("res://scripts/character.gd")
const SIEGE := preload("res://scripts/siege.gd")
const WORLD := preload("res://scripts/world.gd")
const HOSTS := preload("res://scripts/hosts.gd")
const FOLK := preload("res://scripts/folk.gd")
const TL := preload("res://scripts/townlife.gd")
const FEST := preload("res://scripts/festivals.gd")
const INC := preload("res://scripts/incidents.gd")
const LEG := preload("res://scripts/legacy.gd")
const REALM := preload("res://scripts/realm.gd")
const STALLS := preload("res://scripts/stalls.gd")

const SAVE_PATH := "user://partida.json"
const SECONDS_PER_DAY := 150.0
const NIGHT_FAST := 4.0  # la noche pasa así de rápido: los días son largos y las noches cortas
const DAYS_PER_SEASON := 5
const SEASONS := ["Primavera", "Verano", "Otoño", "Invierno"]
const HOUSE_NAMES := ["Sin casa", "Choza", "Casa de piedra", "Casa solariega", "Casona", "Casa fuerte"]
const HOUSE_COSTS := [
	{"wood": 20, "stone": 10, "gold": 0},
	{"wood": 40, "stone": 30, "gold": 20},
	{"wood": 60, "stone": 60, "gold": 50},
	{"wood": 100, "stone": 120, "gold": 150},
	{"wood": 150, "stone": 220, "gold": 300},
]
const CHIEF_PRESTIGE := 150
const MALE_NAMES := ["Rodrigo", "Sancho", "Alonso", "Fernando", "Gonzalo", "Diego", "Martín", "Pedro", "Íñigo", "Bermudo", "Ramiro", "García", "Nuño", "Álvaro", "Tello", "Fruela", "Ordoño", "Vermudo", "Lope", "Fortún", "Gutierre", "Munio", "Pelayo", "Suero", "Vela", "Ximeno", "Galindo", "Aznar", "Gómez", "Rui", "Lain", "Mendo", "Osorio", "Pascual", "Domingo", "Esteban", "Juan", "Miguel", "Andrés", "Bernardo", "Gil", "Hernando", "Benito", "Simón"]
const FEMALE_NAMES := ["Urraca", "Jimena", "Elvira", "Sancha", "Teresa", "Leonor", "Berenguela", "Mencía", "Aldonza", "Constanza", "Toda", "Mayor", "Inés", "Blanca", "Oria", "Elo", "Goto", "Munia", "Onneca", "Velasquita", "Gontrodo", "Estefanía", "Eva", "Marina", "Juliana", "María", "Catalina", "Isabel", "Beatriz", "Juana", "Lucía", "Águeda", "Benita", "Elena", "Florencia", "Guiomar", "Leocadia", "Olalla", "Sol", "Violante", "Columba", "Romana", "Marta", "Ana"]
const SURNAMES := ["Ruiz", "Pérez", "Sánchez", "Fernández", "Díaz", "Muñoz", "Álvarez", "Gómez", "Martínez", "López", "Ordóñez", "Velázquez", "Íñiguez", "Garcés", "Bermúdez", "Núñez", "Téllez", "Ramírez", "Osorio", "Fáñez", "Gutiérrez", "Rodríguez", "Vermúdez", "Sáez", "Laínez", "Domínguez", "Esteban", "Gil", "Vela", "Peláez"]
const ENEMIES := ["los bandidos del bosque", "el señor de Valdeoscuro", "los invasores del norte", "un barón rebelde", "los saqueadores del río"]
## Casas de los vecinos (en 1/20 de metro): pegadas en hilera a ambos lados de la calle mayor.
const HOMES := [Vector2(920, 630), Vector2(920, 970), Vector2(800, 630), Vector2(800, 970), Vector2(680, 630), Vector2(680, 970), Vector2(560, 630), Vector2(560, 970)]
const OLD_HOMES := [Vector2(760, 620), Vector2(760, 1000), Vector2(980, 1180), Vector2(1380, 1180), Vector2(1640, 1040), Vector2(1660, 560), Vector2(900, 330), Vector2(1520, 300)]

## Objetos de inventario: id -> [nombre, precio, raciones de comida (0 = no se come)]
const ITEMS := {
	"trigo": ["Trigo", 2, 0], "harina": ["Harina", 4, 0], "pan": ["Pan", 6, 3],
	"zanahoria": ["Zanahorias", 2, 1], "remolacha": ["Remolachas", 2, 1], "col": ["Coles", 2, 1], "calabaza": ["Calabazas", 5, 2],
	"manzana": ["Manzanas", 2, 1], "bayas": ["Bayas", 1, 1], "setas": ["Setas", 3, 1],
	"huevos": ["Huevos", 2, 1], "leche": ["Leche", 3, 1], "carne": ["Carne", 7, 3], "pescado": ["Pescado", 4, 2],
	"lana": ["Lana", 6, 0], "cuero": ["Cuero", 9, 0],
	"tela": ["Tela", 18, 0], "piel": ["Piel curtida", 22, 0], "queso": ["Queso", 12, 3],
	"cerveza": ["Cerveza", 9, 1], "miel": ["Miel", 8, 2], "hierro": ["Hierro", 10, 0], "herramientas": ["Herramientas", 15, 0],
}
## Orden en que la familia se come las cosas (primero lo perecedero y barato).
const EAT_ORDER := ["bayas", "setas", "leche", "huevos", "manzana", "col", "zanahoria", "remolacha", "pescado", "calabaza", "carne", "miel", "queso", "pan"]
const CROPS := {
	"trigo": {"name": "Trigo", "model": "Wheat", "days": 8, "yield": [10, 14], "seed": 3},
	"zanahoria": {"name": "Zanahorias", "model": "Carrot", "days": 5, "yield": [6, 9], "seed": 2},
	"remolacha": {"name": "Remolachas", "model": "Beet", "days": 5, "yield": [6, 9], "seed": 2},
	"col": {"name": "Coles", "model": "Lettuce", "days": 4, "yield": [5, 7], "seed": 2},
	"calabaza": {"name": "Calabazas", "model": "Pumpkin", "days": 7, "yield": [3, 5], "seed": 3},
}
## Animales de granja: precio, máximo, pienso en invierno (raciones de trigo/remolacha), producto.
const ANIMALS := {
	"gallina": {"name": "Gallinas", "price": 8, "max": 12, "feed": 0.25, "product": "huevos", "per_day": 1.0},
	"oveja": {"name": "Ovejas", "price": 25, "max": 8, "feed": 0.5, "product": "lana", "per_day": 0.5},
	"cerdo": {"name": "Cerdos", "price": 20, "max": 8, "feed": 0.5, "product": "", "per_day": 0.0},
	"vaca": {"name": "Vacas", "price": 40, "max": 4, "feed": 1.0, "product": "leche", "per_day": 2.0},
}
const FIELD_PRICE := 25
## Calidad de las casas de los vecinos: empiezan humildes y cada familia la mejora con el tiempo.
const HOME_LEVELS := ["cabaña de madera", "casa de entramado", "casa de piedra"]
## Terrenos anexos a tu casa: se compran y en cada uno levantas una cosa.
const ANNEX_PRICE := 40
const ANNEX_TYPES := {
	"huerto": {"name": "Huerto", "desc": "un huerto propio junto a casa (una parcela de cultivo más)", "cost": {"wood": 8, "stone": 0, "gold": 10}},
	"corral": {"name": "Corral de ovejas", "desc": "+4 ovejas", "cost": {"wood": 20, "stone": 0, "gold": 10}, "animal": "oveja", "extra": 4},
	"establo": {"name": "Establo de vacas", "desc": "+2 vacas", "cost": {"wood": 30, "stone": 10, "gold": 20}, "animal": "vaca", "extra": 2},
	"gallinero": {"name": "Gallinero", "desc": "+6 gallinas", "cost": {"wood": 10, "stone": 0, "gold": 5}, "animal": "gallina", "extra": 6},
	"pocilga": {"name": "Pocilga", "desc": "+4 cerdos", "cost": {"wood": 15, "stone": 0, "gold": 10}, "animal": "cerdo", "extra": 4},
}
const FIELDS_OUT := 12  # parcelas de las afueras; después van los huertos de los anexos
## Edificios que se pueden levantar en los solares del pueblo.
const BUILDINGS := {
	"herreria": {"name": "Herrería", "cost": {"madera": 30, "piedra": 30, "oro": 20}, "desc": "Forja herramientas, espadas y armaduras con hierro."},
	"telar": {"name": "Telar", "cost": {"madera": 25, "piedra": 5, "oro": 10}, "desc": "Teje la lana para hacer tela."},
	"curtiduria": {"name": "Curtiduría", "cost": {"madera": 20, "piedra": 10}, "desc": "Curte el cuero para hacer piel."},
	"queseria": {"name": "Quesería", "cost": {"madera": 20, "piedra": 15, "oro": 10}, "desc": "Convierte la leche en queso."},
	"cerveceria": {"name": "Cervecería", "cost": {"madera": 35, "piedra": 20, "oro": 25}, "desc": "Elabora cerveza con trigo."},
	"establo": {"name": "Establo", "cost": {"madera": 40, "piedra": 10}, "desc": "Dobla el espacio del corral y los animales comen menos en invierno."},
	"granero": {"name": "Granero", "cost": {"madera": 40, "piedra": 20}, "desc": "Las cosechas rinden un 25% más."},
	"colmenar": {"name": "Colmenar", "cost": {"madera": 15, "oro": 10}, "desc": "Las abejas producen miel (en invierno no)."},
	"capilla": {"name": "Capilla", "cost": {"madera": 30, "piedra": 60, "oro": 40}, "desc": "+40 de prestigio y +3 cada estación."},
	"molino": {"name": "Molino de viento", "cost": {"madera": 60, "piedra": 20, "oro": 30}, "desc": "Muele mucho más grano: los panaderos producen bastante más (y más cuanto más crezca el pueblo)."},
	"cantera": {"name": "Cantera", "cost": {"madera": 30, "oro": 30}, "desc": "Canteros y mineros producen bastante más (y más cuanto más crezca el pueblo)."},
	"escuela": {"name": "Escuela", "cost": {"madera": 40, "piedra": 20, "oro": 30}, "desc": "Los niños del pueblo van a la escuela por la mañana; al hacerse mayores empiezan con ahorros y más contentos."},
	"hospital": {"name": "Hospital", "cost": {"madera": 40, "piedra": 40, "oro": 60}, "desc": "Tu familia recupera +2 de salud al día y las fiebres y la peste matan a la mitad."},
	"universidad": {"name": "Universidad", "cost": {"madera": 50, "piedra": 80, "oro": 120}, "tier": 2, "desc": "Educar a tus hijos sale gratis y tus habilidades suben un 50% más rápido. (Solo en una ciudad)"},
	"puerto": {"name": "Embarcadero", "cost": {"madera": 60, "oro": 40}, "desc": "Tus caravanas van por el río: el doble de rápido y casi sin asaltos."},
	"castillo": {"name": "Castillo", "cost": {"madera": 80, "piedra": 150, "oro": 150}, "tier": 1, "desc": "Fortaleza del señor: tu pueblo resiste mucho mejor los asaltos, tus tropas defienden mejor sus murallas y ganas +5 de prestigio cada estación. (Desde villa)"},
}
const MINE_COST := {"madera": 30, "oro": 20}
const RECIPES := {
	"telar": [{"in": {"lana": 2}, "out": {"tela": 1}}],
	"curtiduria": [{"in": {"cuero": 2}, "out": {"piel": 1}}],
	"queseria": [{"in": {"leche": 3}, "out": {"queso": 1}}],
	"cerveceria": [{"in": {"trigo": 3}, "out": {"cerveza": 2}}],
	"herreria": [
		{"in": {"hierro": 3, "madera": 2}, "tool": "hacha"},
		{"in": {"hierro": 3, "madera": 2}, "tool": "pico"},
		{"in": {"hierro": 3, "madera": 2}, "tool": "hoz"},
	],
}
const TOOLS := {"caña": "Caña de pescar", "hacha": "Hacha (doble de madera)", "pico": "Pico (doble de piedra y más hierro)", "hoz": "Hoz (+25% en las cosechas)"}

## Rasgos de carácter (tú y tus hijos) y educación de los hijos.
const TRAITS := {
	"valiente": "Valiente: +20% de daño en batalla",
	"robusto": "Robusto: +20 de vida en batalla",
	"astuto": "Astuto: gobierna mejor (+25% de rentas)",
	"piadoso": "Piadoso: +3 de prestigio cada estación",
	"enfermizo": "Enfermizo: -20 de vida en batalla",
}
const EDU := {
	"armas": "Armas, con el maestro de armas: +15 de vida y +3 de daño en batalla",
	"letras": "Letras, en el monasterio: +25% de rentas como gobernador",
	"oficio": "Oficio, en la herrería: aporta 5 de oro cada estación",
}
const EDU_COST := 30

var data := {}
var speed := 1.0
var popups: Array = []  # mensajes importantes (muertes) que la aldea muestra en ventana


## Nombres de todas las personas vivas del pueblo (nadie puede repetirse).
func used_names() -> Array:
	var used := []
	if data.has("player"):
		used.append(data["player"]["name"])
	if data.get("spouse") != null:
		used.append(data["spouse"]["name"])
	for c in data.get("children", []):
		used.append(c["name"])
	for v in data.get("villagers", []):
		used.append(v["name"])
		for k in v.get("kids", []):
			used.append(k["name"])
	return used


func rng_name(male: bool) -> String:
	var used := used_names()
	var pool: Array = (MALE_NAMES if male else FEMALE_NAMES).filter(func(n): return not n in used)
	if not pool.is_empty():
		return pool.pick_random()
	for extra in ["el Mozo", "el Joven", "el Viejo", "de Arriba", "de Abajo", "del Río", "del Monte"]:
		pool = (MALE_NAMES if male else FEMALE_NAMES).map(func(n): return "%s %s" % [n, extra]).filter(func(n): return not n in used)
		if not pool.is_empty():
			return pool.pick_random()
	return "%s %d" % [(MALE_NAMES if male else FEMALE_NAMES).pick_random(), randi_range(2, 99)]


func rng_surname() -> String:
	var used := []
	for v in data.get("villagers", []):
		used.append(v.get("surname", ""))
	var pool: Array = SURNAMES.filter(func(n): return not n in used)
	return (pool if not pool.is_empty() else SURNAMES).pick_random()


func full_name(v: Dictionary) -> String:
	return "%s %s" % [v["name"], v["surname"]] if v.get("surname", "") != "" else v["name"]


func new_villager(home: Vector2) -> Dictionary:
	var m := randf() < 0.5
	var v := {"name": rng_name(m), "surname": rng_surname(), "male": m, "age": randi_range(17, 34), "affection": 0, "hx": home.x, "hy": home.y}
	SIM.setup(v)
	return v


func new_game(pname: String, dynasty: String, male: bool) -> void:
	data = {
		"day": 1, "season": 0, "year": 1100, "time": 0.3, "total_days": 0, "taxed": -1,
		"gold": 15, "wood": 0, "stone": 0,
		"prestige": 0, "title": 0, "house_level": 0, "weapon": 0, "armor": 0,
		"dynasty": dynasty, "generation": 1,
		"player": {"name": pname, "male": male, "age": 18, "health": 100.0, "trait": TRAITS.keys().pick_random()},
		"spouse": null, "children": [], "villagers": [],
		"summons": null, "talked": [], "log": [], "quest": 0, "life": {"since": 1100},
	}
	for h in HOMES:
		data["villagers"].append(new_villager(h))
	ensure_economy()
	popups.clear()
	say("%s %s llega a la aldea con lo puesto. Empieza tu linaje." % [pname, dynasty])
	chronicle("%s %s llega a %s con lo puesto. Así empieza el linaje." % [pname, dynasty, data["town"]])
	popups.append({"title": "Bienvenido a %s" % data["town"], "text": "Llegas con lo puesto. Tu meta: levantar una casa, formar una familia y llegar a señor de ciudades.\n\nControles: WASD para andar, Shift para correr, clic derecho y ratón para girar la cámara, E para interactuar (mantén E para talar o picar), I para el inventario, M para el mapa, T para acelerar el tiempo.\n\nArriba a la derecha verás siempre tu objetivo actual y una pista.\n\nPrimer objetivo: %s\n%s" % [QUESTS.LIST[0]["goal"], QUESTS.LIST[0]["tip"]], "button": "¡A trabajar!"})


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
	var tt: float = data["time"]
	data["time"] += delta * speed / SECONDS_PER_DAY * (NIGHT_FAST if tt < 0.22 or tt > 0.85 else 1.0)
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
	if eat(family_size()):
		p["health"] = minf(100.0, p["health"] + 4.0 + (2.0 if has_building("hospital") else 0.0))
	else:
		p["health"] -= 15.0
		say("Tu familia pasa hambre. (-15 salud)")
	_steward_day()
	farm_day()
	SIM.day()
	ARMY.day()
	REGION.day()
	EVENTS.day()
	SIEGE.day()
	WORLD.day()
	HOSTS.day()
	HOSTS.rescue_day()
	FOLK.day()
	TL.day()
	FEST.day()
	INC.day()
	LEG.check()
	SOCIAL.day()
	QUESTS.check()
	if data["spouse"] != null and data["children"].size() < 6 and p["age"] >= 16 and p["age"] < 48 and data["spouse"]["age"] < 46 and randf() < 0.06:
		var m := randf() < 0.5
		var cname := rng_name(m)
		data["children"].append({"name": cname, "male": m, "age": 0, "trait": TRAITS.keys().pick_random()})
		data["prestige"] += 5
		say("¡Ha nacido tu %s %s! (+5 prestigio)" % ["hijo" if m else "hija", cname])
		chronicle("Nace %s, %s de %s." % [cname, "hijo" if m else "hija", p["name"]])
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
	if int(data["season"]) == 3:
		frost()
	if has_building("capilla"):
		data["prestige"] += 3
	if trait_of(data["player"]) == "piadoso":
		data["prestige"] += 3
	if has_building("castillo"):
		data["prestige"] += 5
	var crafts := 0
	for c in data["children"]:
		if c.get("edu", "") == "oficio" and int(c["age"]) >= 16:
			crafts += 5
	if crafts > 0:
		data["gold"] = int(data["gold"]) + crafts
		say("Tus hijos con oficio aportan %d de oro a la casa." % crafts)
	autosave()
	SIM.season()
	REGION.season()
	ECON.season()
	POL.season()
	WORLD.season()
	WORLD.season_bards()
	WORLD.tourney_season()
	TL.guild_season()
	REALM.season()
	REALM.climate_season()
	evolve_homes()
	STALLS.season()
	if data.get("game_over", false):
		return
	say("Comienza %s del año %d." % [["la primavera", "el verano", "el otoño", "el invierno"][int(data["season"])], int(data["year"])])
	if int(data["season"]) == 2:
		popups.append({"title": "Tiempo de cosecha", "text": "Llega el otoño: los campos están dorados y todo el pueblo sale a segar. Recoge tus parcelas antes de que llegue la helada.", "button": "A trabajar"})
	elif int(data["season"]) == 3:
		popups.append({"title": "Llega el invierno", "text": "La nieve cubre el pueblo. Los campos descansan, los caminos son lentos y hará falta leña y comida guardada para aguantar hasta la primavera.", "button": "Continuar"})
	if data["summons"] == null and not data.get("king", false) and data["player"]["age"] >= 16 and data["player"]["age"] <= 60 and randf() < 0.45:
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
	SIM.year()
	REGION.year()
	var s = data["spouse"]
	if s != null:
		s["age"] += 1
		if s["age"] >= 55 and randf() < (s["age"] - 52) * 0.04:
			say("Tu cónyuge %s ha fallecido a los %d años." % [s["name"], int(s["age"])])
			data["spouse"] = null
	if p["age"] >= 50 and randf() < (p["age"] - 47) * 0.04:
		player_death("murió de vejez")


## Rasgo de una persona (se asigna al azar si aún no tiene, p. ej. en partidas antiguas).
func trait_of(p: Dictionary) -> String:
	if not p.has("trait"):
		p["trait"] = TRAITS.keys().pick_random()
	return p["trait"]


## Bonos de batalla por rasgo y educación: [vida extra, multiplicador de daño, daño extra].
func battle_bonus(p: Dictionary) -> Array:
	var t := trait_of(p)
	var hp := (20.0 if t == "robusto" else 0.0) - (20.0 if t == "enfermizo" else 0.0) + (15.0 if p.get("edu", "") == "armas" else 0.0)
	return [hp, 1.2 if t == "valiente" else 1.0, 3.0 if p.get("edu", "") == "armas" else 0.0]


func player_death(reason: String) -> void:
	var p = data["player"]
	var text := "%s %s %s a los %d años." % [p["name"], data["dynasty"], reason, int(p["age"])]
	var ep: String = LEG.epithet(p, reason)
	text += " Será recordado como %s %s." % [p["name"], ep]
	chronicle(text)
	if not data.has("ancestors"):
		data["ancestors"] = []
	data["ancestors"].append({"name": p["name"], "male": p["male"], "age": int(p["age"]), "year": int(data["year"]), "reason": reason, "epithet": ep})
	data["life"] = {"since": int(data["year"])}
	data["summons"] = null
	if data["children"].is_empty():
		data["game_over"] = true
		popups.append({"title": "Fin del linaje", "text": text + "\n\nNo dejó herederos. El linaje %s se ha extinguido.\nGeneraciones: %d · Prestigio final: %d" % [data["dynasty"], int(data["generation"]), int(data["prestige"])]})
		if FileAccess.file_exists(save_path(slot)):
			DirAccess.remove_absolute(save_path(slot))
		return
	var heir_i := 0
	for i in data["children"].size():
		if data["children"][i]["age"] > data["children"][heir_i]["age"]:
			heir_i = i
	var heir = data["children"][heir_i]
	var siblings: int = data["children"].size() - 1
	var old_skills: Dictionary = p.get("skills", {})
	var skills := {}
	for k in old_skills:
		skills[k] = int(old_skills[k]) / 2
	data["player"] = {"name": heir["name"], "male": heir["male"], "age": heir["age"], "health": 100.0, "trait": trait_of(heir), "edu": heir.get("edu", ""), "skills": skills}
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
	if lvl >= 5:
		return "Tu casa ya es la mejor del pueblo."
	var c = HOUSE_COSTS[lvl]
	if data["wood"] < c["wood"] or data["stone"] < c["stone"] or data["gold"] < c["gold"]:
		return "Te faltan materiales."
	data["wood"] -= c["wood"]
	data["stone"] -= c["stone"]
	data["gold"] -= c["gold"]
	data["house_level"] = lvl + 1
	SFX.play("talar")
	data["prestige"] += 10 * (lvl + 1)
	say("Has construido: %s. (+%d prestigio)" % [HOUSE_NAMES[lvl + 1], 10 * (lvl + 1)])
	return ""


func marry(i: int) -> String:
	var v = data["villagers"][i]
	if v.has("partner"):
		return "%s ya está casado." % v["name"] if v["male"] else "%s ya está casada." % v["name"]
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
	chronicle("%s se casa con %s." % [data["player"]["name"], v["name"]])
	return ""


func claim_chief() -> String:
	if int(data["prestige"]) < CHIEF_PRESTIGE or int(data["house_level"]) < 2:
		return "Necesitas %d de prestigio y una Casa de piedra." % CHIEF_PRESTIGE
	data["title"] = 1
	chronicle("%s es elegido jefe de %s." % [data["player"]["name"], data["town"]])
	data["prestige"] += 30
	say("¡%s %s es ahora el jefe del pueblo!" % [data["player"]["name"], data["dynasty"]])
	return ""


# ---------------- Guardado ----------------

## Mayordomo: cosecha y vuelve a sembrar tus campos y vende lo que sobra. Cobra 4 de oro al día.
func _steward_day() -> void:
	if not data.get("steward", false):
		return
	if int(data["gold"]) < 4:
		data["steward"] = false
		say("Tu mayordomo se marcha: no tienes oro para pagarle.")
		return
	data["gold"] = int(data["gold"]) - 4
	for i in data["fields"].size():
		var f = data["fields"][i]
		if f["owned"] and field_ready(f):
			var crop: String = f["crop"]
			harvest(i)
			plant(i, crop)
	var earned := 0
	for k in ITEMS:
		var extra := inv(k) - 40
		if extra > 0 and int(ITEMS[k][1]) > 0:
			take(k, extra)
			earned += int(extra * int(ITEMS[k][1]) * 0.8)
	if earned > 0:
		data["gold"] = int(data["gold"]) + earned


func edu_cost() -> int:
	return 0 if has_building("universidad") else EDU_COST


## Siguiente aviso que mostrar: los avisos sin decisiones que se juntan se muestran en una sola ventana.
func next_popup() -> Dictionary:
	var first: Dictionary = popups.pop_front()
	if first.has("options") or popups.is_empty() or popups[0].has("options") or data.get("game_over", false):
		return first
	var parts := ["%s\n%s" % [first["title"].to_upper(), first["text"]]]
	while not popups.is_empty() and not popups[0].has("options") and parts.size() < 6:
		var p: Dictionary = popups.pop_front()
		parts.append("%s\n%s" % [p["title"].to_upper(), p["text"]])
	return {"title": "Novedades (%d)" % parts.size(), "text": "\n\n".join(parts), "button": first.get("button", "Continuar")}


## Crónica del linaje: los hechos importantes, con su año.
func chronicle(text: String) -> void:
	if not data.has("chronicle"):
		data["chronicle"] = []
	data["chronicle"].append({"y": int(data["year"]), "t": text})
	if data["chronicle"].size() > 300:
		data["chronicle"].pop_front()


## Consejo que sale una sola vez la primera vez que ves algo (se puede desactivar en Opciones).
func tip(id: String, title: String, text: String) -> void:
	if not SFX.settings.get("tips", true):
		return
	if not data.has("tips"):
		data["tips"] = []
	if id in data["tips"]:
		return
	data["tips"].append(id)
	popups.append({"title": "Consejo: " + title, "text": text, "button": "Entendido"})


## Dificultad: 0 fácil, 1 normal, 2 difícil.
func diff_mult(easy: float, hard: float) -> float:
	return [easy, 1.0, hard][int(data.get("difficulty", 1))]


## Ranuras de guardado: 1, 2 y 3 (la 1 es la partida antigua) y 0 = guardado automático.
var slot := 1


func save_path(s: int) -> String:
	return SAVE_PATH if s == 1 else ("user://partida_auto.json" if s == 0 else "user://partida_%d.json" % s)


func save_game() -> void:
	if data.is_empty() or data.get("game_over", false):
		return
	data["slot"] = slot
	var f := FileAccess.open(save_path(slot), FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


## Copia automática cada estación, aparte de tu ranura.
func autosave() -> void:
	if data.is_empty() or data.get("game_over", false):
		return
	data["slot"] = slot
	var f := FileAccess.open(save_path(0), FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


func has_save() -> bool:
	return [0, 1, 2, 3].any(func(s): return FileAccess.file_exists(save_path(s)))


## Ranura guardada más reciente.
func latest_slot() -> int:
	var best := -1
	var bt := -1
	for s in [0, 1, 2, 3]:
		if FileAccess.file_exists(save_path(s)):
			var t := FileAccess.get_modified_time(save_path(s))
			if t > bt:
				bt = t
				best = s
	return best


func slot_info(s: int) -> String:
	if not FileAccess.file_exists(save_path(s)):
		return "vacía"
	var p = JSON.parse_string(FileAccess.get_file_as_string(save_path(s)))
	if typeof(p) != TYPE_DICTIONARY:
		return "dañada"
	return "%s %s · año %d · generación %d" % [p["player"]["name"], p["dynasty"], int(p["year"]), int(p["generation"])]


func load_game(s := -1) -> bool:
	if s < 0:
		s = latest_slot()
	if s < 0 or not FileAccess.file_exists(save_path(s)):
		return false
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(save_path(s)))
	if typeof(parsed) != TYPE_DICTIONARY:
		return false
	data = parsed
	slot = int(data.get("slot", maxi(s, 1)))
	ensure_economy()
	popups.clear()
	return true


# ---------------- Economía del pueblo ----------------

## Crea (o migra desde partidas antiguas) inventario, parcelas y animales.
func ensure_economy() -> void:
	WORLD.ensure()
	# Partidas de antes del pueblo con calles: los vecinos se mudan a las casas nuevas.
	for v in data.get("villagers", []):
		var k := OLD_HOMES.find(Vector2(v["hx"], v["hy"]))
		if k >= 0:
			v["hx"] = HOMES[k].x
			v["hy"] = HOMES[k].y
	if not data.has("inv"):
		data["inv"] = {"pan": 4, "zanahoria": 6}
		if data.has("food"):
			data["inv"]["zanahoria"] = int(data["food"])
			data.erase("food")
	if not data.has("fields"):
		data["fields"] = []
		for i in 6:
			data["fields"].append({"owned": i < 2, "crop": "", "age": 0})
	while data["fields"].size() < FIELDS_OUT + 4:
		data["fields"].append({"owned": false, "crop": "", "age": 0})
	if not data.has("annex"):
		data["annex"] = ["", "", "", ""]
	if not data.has("animals"):
		data["animals"] = {"gallina": 0, "oveja": 0, "cerdo": 0, "vaca": 0}
	if not data.has("barn"):
		data["barn"] = {}
	if not data.has("picked"):
		data["picked"] = {}
	if not data.has("tools"):
		data["tools"] = []
	if not data.has("feed_debt"):
		data["feed_debt"] = 0.0
	if not data.has("buildings"):
		data["buildings"] = {}
	if not data.has("mine"):
		data["mine"] = false
	if not data.has("honey"):
		data["honey"] = 0.0
	SIM.ensure()
	ARMY.ensure()
	REGION.ensure()
	REALM.ensure()


func inv(item: String) -> int:
	return int(data["inv"].get(item, 0))


func add(item: String, n: int) -> void:
	data["inv"][item] = inv(item) + n


func take(item: String, n: int) -> bool:
	if inv(item) < n:
		return false
	data["inv"][item] = inv(item) - n
	return true


func food_total() -> int:
	var t := 0
	for k in data["inv"]:
		t += inv(k) * int(ITEMS[k][2])
	return t


## La familia come 'need' raciones. Devuelve false si no hay suficiente.
func eat(need: int) -> bool:
	for k in EAT_ORDER:
		while need > 0 and inv(k) > 0:
			take(k, 1)
			need -= int(ITEMS[k][2])
	return need <= 0


## Recursos de recolección (manzanos, bayas, setas) se reponen cada estación.
func can_pick(id: String) -> bool:
	return int(data["picked"].get(id, -1)) != season_index()


func mark_picked(id: String) -> void:
	data["picked"][id] = season_index()


func field_ready(f: Dictionary) -> bool:
	return f["crop"] != "" and int(f["age"]) >= int(CROPS[f["crop"]]["days"])


func field_stage(f: Dictionary) -> int:
	if f["crop"] == "":
		return 0
	return clampi(1 + int(f["age"]) * 4 / int(CROPS[f["crop"]]["days"]), 1, 4)


func plant(i: int, crop: String) -> String:
	var f = data["fields"][i]
	if int(data["season"]) == 3:
		return "En invierno la tierra está helada."
	var seed: int = CROPS[crop]["seed"]
	if data["gold"] < seed:
		return "No tienes oro para las semillas."
	data["gold"] -= seed
	f["crop"] = crop
	f["age"] = 0
	return ""


func harvest(i: int) -> String:
	var f = data["fields"][i]
	if not field_ready(f):
		return ""
	var c = CROPS[f["crop"]]
	var mult := 1.0 + (0.25 if has_building("granero") else 0.0) + (0.25 if "hoz" in data["tools"] else 0.0)
	var n := int(round(randi_range(int(c["yield"][0]), int(c["yield"][1])) * mult))
	add(f["crop"], n)
	f["crop"] = ""
	f["age"] = 0
	return "+%d %s" % [n, String(c["name"]).to_lower()]


func buy_field(i: int) -> String:
	if data["gold"] < FIELD_PRICE:
		return "Necesitas %d de oro." % FIELD_PRICE
	data["gold"] -= FIELD_PRICE
	data["fields"][i]["owned"] = true
	say("Has comprado una parcela de cultivo.")
	return ""


func frost() -> void:
	var lost := 0
	for f in data["fields"]:
		if f["crop"] != "" and not field_ready(f):
			f["crop"] = ""
			f["age"] = 0
			lost += 1
	if lost > 0:
		say("La helada del invierno arruina %d parcelas sin cosechar." % lost)


## Un día en la granja: crecen los cultivos y los animales producen, comen y crían.
func farm_day() -> void:
	var winter := int(data["season"]) == 3
	if not winter:
		for f in data["fields"]:
			if f["crop"] != "" and not field_ready(f):
				f["age"] += 1
				if field_ready(f):
					say("Tu parcela de %s está lista para cosechar." % String(CROPS[f["crop"]]["name"]).to_lower())
	var an = data["animals"]
	var fed := true
	if winter:
		data["feed_debt"] += _feed_need()
		while data["feed_debt"] >= 1.0 and (inv("trigo") > 0 or inv("remolacha") > 0):
			take("remolacha" if inv("remolacha") > 0 else "trigo", 1)
			data["feed_debt"] -= 1.0
		if data["feed_debt"] >= 2.0:
			fed = false
			data["feed_debt"] = 0.0
			for k in ["gallina", "oveja", "cerdo", "vaca"]:
				if int(an[k]) > 0 and randf() < 0.35:
					an[k] -= 1
					say("Un animal de tu corral ha muerto de hambre. (%s)" % ANIMALS[k]["name"].to_lower())
					break
	if has_building("colmenar") and not winter:
		data["honey"] = float(data["honey"]) + 1.0
	if not fed:
		return
	var barn = data["barn"]
	for k in ANIMALS:
		var a = ANIMALS[k]
		if a["product"] != "" and int(an[k]) > 0:
			var amount: float = float(barn.get(a["product"], 0.0)) + a["per_day"] * int(an[k])
			barn[a["product"]] = amount
	for k in ["gallina", "oveja", "cerdo"]:
		if int(an[k]) >= 2 and int(an[k]) < animal_max(k) and not winter and randf() < 0.12:
			an[k] += 1
			say("¡Ha nacido un animal en tu corral! (%s)" % ANIMALS[k]["name"].to_lower())


func _feed_need() -> float:
	var t := 0.0
	for k in ANIMALS:
		t += ANIMALS[k]["feed"] * int(data["animals"][k])
	return t * (0.7 if has_building("establo") else 1.0)


## Recoge del corral los productos acumulados.
func collect_barn() -> String:
	var parts := []
	for k in data["barn"].keys():
		var n := int(floor(float(data["barn"][k])))
		if n > 0:
			add(k, n)
			data["barn"][k] = float(data["barn"][k]) - n
			parts.append("+%d %s" % [n, String(ITEMS[k][0]).to_lower()])
	return ", ".join(parts) if not parts.is_empty() else ""


func buy_animal(k: String) -> String:
	var a = ANIMALS[k]
	if int(data["house_level"]) < 1:
		return "Necesitas una casa para tener animales."
	if int(data["animals"][k]) >= animal_max(k):
		return "No caben más en el corral."
	if data["gold"] < a["price"]:
		return "No tienes suficiente oro."
	data["gold"] -= a["price"]
	data["animals"][k] += 1
	return ""


func slaughter_pig() -> String:
	if int(data["animals"]["cerdo"]) < 1:
		return "No tienes cerdos."
	data["animals"]["cerdo"] -= 1
	add("carne", 6)
	add("cuero", 1)
	return "+6 carne, +1 cuero"


# ---------------- Edificios y talleres ----------------

func has_building(id: String) -> bool:
	return id in data["buildings"].values()


func animal_max(k: String) -> int:
	var extra := 0
	for a in data.get("annex", []):
		if ANNEX_TYPES.has(a) and ANNEX_TYPES[a].get("animal", "") == k:
			extra += int(ANNEX_TYPES[a]["extra"])
	return int(ANIMALS[k]["max"]) * (2 if has_building("establo") else 1) + extra


## Compra un terreno anexo a tu casa.
func buy_annex(i: int) -> String:
	if int(data["gold"]) < ANNEX_PRICE:
		return "Necesitas %d de oro." % ANNEX_PRICE
	data["gold"] = int(data["gold"]) - ANNEX_PRICE
	data["annex"][i] = "solar"
	say("Compras el terreno de al lado de tu casa.")
	return ""


func build_annex(i: int, kind: String) -> String:
	var c: Dictionary = ANNEX_TYPES[kind]["cost"]
	if int(data["wood"]) < c["wood"] or int(data["stone"]) < c["stone"] or int(data["gold"]) < c["gold"]:
		return "Te faltan materiales."
	data["wood"] = int(data["wood"]) - c["wood"]
	data["stone"] = int(data["stone"]) - c["stone"]
	data["gold"] = int(data["gold"]) - c["gold"]
	data["annex"][i] = kind
	if kind == "huerto":
		data["fields"][FIELDS_OUT + i]["owned"] = true
	SFX.play("talar")
	say("Has levantado: %s." % ANNEX_TYPES[kind]["name"])
	return ""


## Cada estación, alguna familia del pueblo mejora su casa (si le va bien).
func evolve_homes() -> void:
	for v in data["villagers"]:
		var lv := int(v.get("hlvl", 0))
		if lv >= 2:
			continue
		var ok := int(v.get("mood", 50)) >= (50 if lv == 0 else 60) and (lv == 0 or int(data["tier"]) >= 1 or int(data["commons"]) >= 60)
		if ok and randf() < (0.12 if lv == 0 else 0.06):
			v["hlvl"] = lv + 1
			say("%s ha levantado una %s." % [full_name(v), HOME_LEVELS[lv + 1]])


## Recursos unificados: madera, piedra y oro viven fuera del inventario.
func res(k: String) -> int:
	match k:
		"madera":
			return int(data["wood"])
		"piedra":
			return int(data["stone"])
		"oro":
			return int(data["gold"])
	return inv(k)


func res_add(k: String, n: int) -> void:
	match k:
		"madera":
			data["wood"] = int(data["wood"]) + n
		"piedra":
			data["stone"] = int(data["stone"]) + n
		"oro":
			data["gold"] = int(data["gold"]) + n
		_:
			add(k, n)


func can_pay(cost: Dictionary, times := 1) -> bool:
	for k in cost:
		if res(k) < int(cost[k]) * times:
			return false
	return true


func pay(cost: Dictionary, times := 1) -> void:
	for k in cost:
		res_add(k, -int(cost[k]) * times)


func cost_text(cost: Dictionary) -> String:
	var parts := []
	for k in cost:
		var nm: String = k if not ITEMS.has(k) else String(ITEMS[k][0]).to_lower()
		parts.append("%d %s" % [int(cost[k]), nm])
	return ", ".join(parts)


func construct(slot: int, id: String) -> String:
	var b = BUILDINGS[id]
	if has_building(id):
		return "Ya tienes ese edificio."
	if int(data["tier"]) < int(b.get("tier", 0)):
		return "Tu pueblo aún es demasiado pequeño para eso."
	if not can_pay(b["cost"]):
		return "Te faltan materiales: " + cost_text(b["cost"])
	pay(b["cost"])
	data["buildings"][str(slot)] = id
	SFX.play("talar")
	var pres := 40 if id == "capilla" else 5
	data["prestige"] += pres
	say("Has construido: %s. (+%d prestigio)" % [b["name"], pres])
	return ""


func build_mine() -> String:
	if not can_pay(MINE_COST):
		return "Te faltan materiales: " + cost_text(MINE_COST)
	pay(MINE_COST)
	data["mine"] = true
	data["prestige"] += 5
	say("Has abierto una mina de hierro. (+5 prestigio)")
	return ""


## Fabrica una receta 'times' veces. Devuelve el texto del resultado.
func craft(r: Dictionary, times := 1) -> String:
	if r.has("tool") and r["tool"] in data["tools"]:
		return "Ya tienes esa herramienta."
	if not can_pay(r["in"], times):
		return "Te faltan materiales."
	pay(r["in"], times)
	if r.has("tool"):
		data["tools"].append(r["tool"])
		return "Has forjado: " + TOOLS[r["tool"]]
	var parts := []
	for k in r["out"]:
		res_add(k, int(r["out"][k]) * times)
		parts.append("+%d %s" % [int(r["out"][k]) * times, String(ITEMS[k][0]).to_lower()])
	return ", ".join(parts)


func forge_cost(kind: String) -> Dictionary:
	var lvl := int(data[kind]) + 1
	if kind == "weapon":
		return {"hierro": 4 * lvl, "madera": 2}
	return {"hierro": 3 * lvl, "piel": 2 * lvl}
