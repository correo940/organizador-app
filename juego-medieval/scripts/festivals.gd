extends RefCounted
## Fiestas del calendario (una por estación), juegos populares durante la fiesta,
## y bodas y funerales del pueblo a los que puedes asistir.

const FEASTS := [
	{"name": "Fiesta de Mayo", "desc": "Cruces de flores, música y baile en la plaza."},
	{"name": "Noche de San Juan", "desc": "Hogueras, saltos sobre el fuego y baile hasta el alba."},
	{"name": "Fiesta de la Cosecha", "desc": "Se celebra la cosecha con un gran banquete en la plaza."},
	{"name": "Navidad", "desc": "Misa del gallo, hogueras y dulces para los niños."},
]
const FEAST_DAY := 3
const GAMES := {
	"arco": {"name": "Tiro con arco", "skill": "combate"},
	"carrera": {"name": "Carrera alrededor del pueblo", "skill": ""},
	"lucha": {"name": "Lucha cuerpo a cuerpo", "skill": "combate"},
	"piedra": {"name": "Lanzamiento de piedra", "skill": ""},
}


static func feast_today() -> Dictionary:
	var d = GS.data
	if int(d["day"]) != FEAST_DAY:
		return {}
	return FEASTS[int(d["season"])]


static func key() -> String:
	return "%d-%d" % [int(GS.data["year"]), int(GS.data["season"])]


## Al empezar el día de fiesta: aviso y ánimo del pueblo.
static func day() -> void:
	var d = GS.data
	var f := feast_today()
	if not f.is_empty():
		for v in d["villagers"]:
			v["mood"] = mini(100, int(v["mood"]) + 8)
		GS.say("¡Hoy es %s! %s Ve a la plaza a celebrarlo." % [f["name"], f["desc"]])
	var c = d.get("ceremony", null)
	if c != null and int(c["day"]) < int(d["total_days"]):
		d["ceremony"] = null


## Unirse a la fiesta: afecto de todos, salud y prestigio (una vez por fiesta).
static func join(v) -> void:
	var d = GS.data
	var f := feast_today()
	if d.get("feast_joined", "") == key():
		_games(v)
		return
	d["feast_joined"] = key()
	d["prestige"] += 3
	d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 5.0)
	for vv in d["villagers"]:
		vv["affection"] = mini(100, int(vv["affection"]) + 3)
	v.player.play_once("Interact")
	v._open_panel(f["name"], "Comes, bebes y bailas con tus vecinos. Todos te aprecian un poco más. (+3 prestigio, +5 salud)\n\n¿Te apuntas a los juegos?", [["Ver los juegos", func(): _games(v)], ["Seguir bailando", v._close_panel]])


static func _games(v) -> void:
	var d = GS.data
	var played: Array = d.get("games_played", [])
	if d.get("games_key", "") != key():
		played = []
		d["games_key"] = key()
	d["games_played"] = played
	var opts := []
	for g in GAMES:
		opts.append([GAMES[g]["name"], func(): _play(v, g), not g in played])
	opts.append(["Volver a la fiesta", v._close_panel])
	v._open_panel("Juegos populares", "Cada juego, una vez por fiesta. Ganar da fama y algo de oro.", opts)


static func _play(v, g: String) -> void:
	var d = GS.data
	d["games_played"].append(g)
	var chance := 0.35
	match g:
		"arco":
			chance += 0.05 * GS.CHAR.level("combate")
		"lucha":
			chance += 0.05 * GS.CHAR.level("combate") + (0.15 if GS.trait_of(d["player"]) == "robusto" else 0.0) + 0.05 * int(d["weapon"])
		"carrera":
			chance += float(d["player"]["health"]) / 400.0 - (0.25 if GS.CHAR.has_wound("cojera") else 0.0) - maxf(0, int(d["player"]["age"]) - 35) * 0.01
		"piedra":
			chance += (0.2 if GS.trait_of(d["player"]) == "robusto" else 0.0) + 0.02 * int(d["armor"])
	v.player.play_once("Sword_Attack" if g in ["lucha", "arco"] else "Interact")
	var text: String
	if randf() < chance:
		d["prestige"] += 6
		d["gold"] = int(d["gold"]) + 10
		if g in ["arco", "lucha"]:
			GS.CHAR.practice("combate")
		text = "¡Ganas %s! El pueblo te aclama. (+6 prestigio, +10 oro)" % GAMES[g]["name"].to_lower()
		SFX.play("campana", -8.0)
	else:
		var winner = d["villagers"].pick_random() if not d["villagers"].is_empty() else {"name": "un forastero"}
		text = "%s gana %s. Tú quedas segundo; la próxima vez será." % [winner["name"], GAMES[g]["name"].to_lower()]
	v._open_panel(GAMES[g]["name"], text, [["Otro juego", func(): _games(v)], ["Volver a la fiesta", v._close_panel]])


# ---------------- Bodas y funerales ----------------

static func ceremony(kind: String, title: String, names: Array) -> void:
	GS.data["ceremony"] = {"kind": kind, "title": title, "names": names, "day": int(GS.data["total_days"]), "attended": false}


static func attend(v) -> void:
	var d = GS.data
	var c = d["ceremony"]
	c["attended"] = true
	for vv in d["villagers"]:
		if vv["name"] in c["names"] or vv.get("partner", "") in c["names"]:
			vv["affection"] = mini(100, int(vv["affection"]) + 15)
		else:
			vv["affection"] = mini(100, int(vv["affection"]) + 2)
	d["prestige"] += 2
	var text: String = "Asistes a %s. Los novios te lo agradecen de corazón y el banquete dura hasta la noche." % c["title"].to_lower() if c["kind"] == "boda" else "Acompañas a la familia en %s. Agradecen que el señor del pueblo esté con ellos en un día así." % c["title"].to_lower()
	v._open_panel(c["title"], text + " (+2 prestigio)", [["Cerrar", v._close_panel]])
