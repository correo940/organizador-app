extends RefCounted
## Escenarios de inicio, logros (se guardan entre partidas) y apodos del linaje (cada cabeza de familia
## pasa a la crónica con un sobrenombre según lo que hizo en vida).

const SCENARIOS := [
	{"id": "campesino", "name": "Campesino", "desc": "Empiezas con lo puesto en una aldea. La historia completa."},
	{"id": "villa", "name": "Señor de una villa", "desc": "Ya eres jefe de una villa, con casa de piedra, familia y una pequeña tropa."},
	{"id": "rey", "name": "Rey en guerra", "desc": "Gobiernas una ciudad y varios pueblos, pero dos señores te han declarado la guerra."},
	{"id": "bastardo", "name": "Bastardo sin nada", "desc": "Hijo ilegítimo de un noble: sin oro, sin casa y mal visto. Pero valiente."},
]
const ACHIEVEMENTS := {
	"casa": "Un techo propio: construye tu casa",
	"boda": "Hasta que la muerte os separe: cásate",
	"jefe": "Voz del concejo: sé jefe del pueblo",
	"villa": "Villa: haz crecer tu pueblo hasta villa",
	"ciudad": "Ciudad: haz crecer tu pueblo hasta ciudad",
	"rey": "Corona: coronate rey de la región",
	"gen3": "Linaje: llega a la tercera generación",
	"gen5": "Dinastía: llega a la quinta generación",
	"victoria": "Primera sangre: gana una batalla",
	"veterano": "Señor de la guerra: gana 25 batallas",
	"campeon": "Campeón: gana la temporada de torneos",
	"conquista": "Conquistador: ten 5 pueblos además del tuyo",
	"rico": "Arcas llenas: reúne 1.000 de oro",
	"obras": "Mecenas: termina todas las obras públicas",
}


## Prepara la partida según el escenario elegido (después de new_game).
static func apply_scenario(id: String) -> void:
	var d = GS.data
	d["scenario"] = id
	match id:
		"villa":
			d["tier"] = 1
			d["title"] = 1
			d["house_level"] = 2
			d["gold"] = 300
			d["prestige"] = 200
			d["wood"] = 60
			d["stone"] = 40
			d["commons"] = 120
			d["army"]["milicia"] = 6
			d["army"]["lancero"] = 4
			d["spouse"] = {"name": GS.rng_name(not d["player"]["male"]), "male": not d["player"]["male"], "age": 24}
			d["player"]["age"] = 28
			for k in 2:
				var m := randf() < 0.5
				d["children"].append({"name": GS.rng_name(m), "male": m, "age": randi_range(2, 8), "trait": GS.TRAITS.keys().pick_random()})
			d["quest"] = 9
		"rey":
			d["tier"] = 2
			d["title"] = 1
			d["king"] = true
			d["house_level"] = 4
			d["gold"] = 800
			d["prestige"] = 600
			d["commons"] = 500
			d["wood"] = 150
			d["stone"] = 150
			d["army"]["infante"] = 15
			d["army"]["lancero"] = 10
			d["army"]["arquero"] = 10
			d["army"]["jinete"] = 5
			d["player"]["age"] = 35
			d["spouse"] = {"name": GS.rng_name(not d["player"]["male"]), "male": not d["player"]["male"], "age": 32}
			for k in 3:
				var m := randf() < 0.5
				d["children"].append({"name": GS.rng_name(m), "male": m, "age": randi_range(8, 18), "trait": GS.TRAITS.keys().pick_random()})
			var near: Array = GS.REGION.region()["towns"].filter(func(t): return not t.get("home", false) and t["owner"] == "señor")
			near.sort_custom(func(a, b): return Vector2(a["x"], a["z"]).distance_to(GS.REGION.home()) < Vector2(b["x"], b["z"]).distance_to(GS.REGION.home()))
			for t in near.slice(0, 4):
				t["owner"] = "jugador"
				t["vassal"] = false
				t["garrison"] = 6
				t["troops"] = 0
			var lords: Array = GS.REGION.region()["lords"]
			for i in mini(2, lords.size()):
				GS.REGION.NOBLES.declare_war(i, -1)
			d["quest"] = GS.QUESTS.LIST.size()
		"bastardo":
			d["gold"] = 0
			d["prestige"] = 0
			d["player"]["health"] = 70.0
			d["player"]["trait"] = "valiente"
			d["weapon"] = 1
			for v in d["villagers"]:
				v["affection"] = 0
				v["mood"] = maxi(0, int(v["mood"]) - 10)
	GS.chronicle("Comienza la historia: %s." % [s_name(id)])


static func s_name(id: String) -> String:
	for s in SCENARIOS:
		if s["id"] == id:
			return s["name"]
	return id


# ---------------- Logros ----------------

static func unlocked() -> Array:
	return SFX.settings.get("achievements", [])


static func _check(id: String) -> bool:
	var d = GS.data
	match id:
		"casa": return int(d["house_level"]) >= 1
		"boda": return d["spouse"] != null
		"jefe": return int(d["title"]) >= 1
		"villa": return int(d["tier"]) >= 1
		"ciudad": return int(d["tier"]) >= 2
		"rey": return d.get("king", false)
		"gen3": return int(d["generation"]) >= 3
		"gen5": return int(d["generation"]) >= 5
		"victoria": return int(d.get("wins", 0)) >= 1
		"veterano": return int(d.get("wins", 0)) >= 25
		"campeon": return d.get("champion", false)
		"conquista": return GS.ECON.my_towns().size() >= 5
		"rico": return int(d["gold"]) >= 1000
		"obras": return GS.TL.works_done().size() >= GS.TL.WORKS.size()
	return false


## Se comprueba cada día; los nuevos logros se anuncian y se guardan para siempre.
static func check() -> void:
	var got: Array = unlocked().duplicate()
	var new := []
	for id in ACHIEVEMENTS:
		if not id in got and _check(id):
			got.append(id)
			new.append(String(ACHIEVEMENTS[id]).split(":")[0])
	if new.is_empty():
		return
	SFX.settings["achievements"] = got
	SFX.save_settings()
	GS.popups.append({"title": "¡Logro conseguido!", "text": "\n".join(new.map(func(x): return "★ " + x)), "button": "Continuar"})


static func panel(parent: Node) -> void:
	var lines := []
	for id in ACHIEVEMENTS:
		lines.append(("★ " if id in unlocked() else "☆ ") + String(ACHIEVEMENTS[id]))
	var layer := CanvasLayer.new()
	parent.add_child(layer)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", preload("res://scripts/art.gd").panel_style())
	center.add_child(p)
	var b := VBoxContainer.new()
	p.add_child(b)
	var t := Label.new()
	t.text = "Logros (%d de %d)" % [unlocked().size(), ACHIEVEMENTS.size()]
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	b.add_child(t)
	var l := Label.new()
	l.text = "\n".join(lines)
	b.add_child(l)
	var c := Button.new()
	c.text = "Cerrar"
	c.pressed.connect(layer.queue_free)
	b.add_child(c)


# ---------------- Apodos ----------------

## Sobrenombre del cabeza de familia que muere, según su vida.
static func epithet(p: Dictionary, reason: String) -> String:
	var d = GS.data
	var life: Dictionary = d.get("life", {})
	var male: bool = p["male"]
	var years := int(d["year"]) - int(life.get("since", d["year"]))
	if life.get("crowned", false):
		return "el Grande" if male else "la Grande"
	if int(life.get("conquests", 0)) >= 3:
		return "el Conquistador" if male else "la Conquistadora"
	if int(life.get("wins", 0)) >= 10:
		return "el Batallador" if male else "la Batalladora"
	if years <= 3:
		return "el Breve" if male else "la Breve"
	if int(p["age"]) >= 68:
		return "el Viejo" if male else "la Vieja"
	if GS.trait_of(p) == "piadoso" or GS.has_building("capilla") and randf() < 0.3:
		return "el Piadoso" if male else "la Piadosa"
	if int(d["gold"]) >= 800:
		return "el Rico" if male else "la Rica"
	if "batalla" in reason or "luchando" in reason or "asaltando" in reason:
		return "el Valiente" if male else "la Valiente"
	return ["el Justo", "el Labrador", "el Prudente", "el Sencillo"].pick_random() if male else ["la Justa", "la Labradora", "la Prudente", "la Sencilla"].pick_random()


static func life_event(key: String) -> void:
	var d = GS.data
	if not d.has("life"):
		d["life"] = {"since": int(d["year"])}
	d["life"][key] = int(d["life"].get(key, 0)) + 1
