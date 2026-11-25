extends RefCounted
## Tu personaje: habilidades que suben con el uso, heridas, vejez y el arma que llevas.

const SKILLS := {
	"combate": "Combate: +5% de daño por nivel",
	"liderazgo": "Liderazgo: tus tropas pierden la moral un 4% más despacio por nivel",
	"comercio": "Comercio: vendes un 3% más caro por nivel",
	"diplomacia": "Diplomacia: +10% en las mejoras de relación por nivel",
}
## Armas: daño, alcance, pausa entre golpes y modelo.
const WEAPONS := {
	"espada": {"name": "Espada", "dmg": 1.0, "reach": 2.4, "cd": 0.75, "model": "weapons/Sword.glb", "size": 1.0, "price": 0, "desc": "Equilibrada."},
	"hacha": {"name": "Hacha de guerra", "dmg": 1.3, "reach": 2.2, "cd": 0.95, "model": "weapons/Axe.glb", "size": 1.1, "price": 60, "desc": "Golpes muy fuertes pero más lentos."},
	"lanza": {"name": "Lanza larga", "dmg": 0.9, "reach": 3.3, "cd": 0.8, "model": "weapons/Spear.glb", "size": 2.3, "price": 50, "desc": "Mucho alcance; ideal a caballo."},
	"maza": {"name": "Maza", "dmg": 1.1, "reach": 2.1, "cd": 0.8, "model": "weapons/Hammer_Small.glb", "size": 0.9, "price": 70, "desc": "Atraviesa las armaduras: +30% contra hombres de armas y caballería."},
}
const WOUNDS := {
	"cicatriz": "Cicatriz en la cara (+5 de prestigio: se te respeta)",
	"cojera": "Cojera: te mueves un 15% más despacio",
	"brazo": "Brazo mal curado: -10% de daño",
}


static func _p() -> Dictionary:
	return GS.data["player"]


static func level(skill: String) -> int:
	var xp := int(_p().get("skills", {}).get(skill, 0))
	return mini(10, int(sqrt(xp / 2.0)))


## Suma experiencia a una habilidad y avisa al subir de nivel.
static func practice(skill: String, n := 1) -> void:
	var p := _p()
	if not p.has("skills"):
		p["skills"] = {}
	var before := level(skill)
	p["skills"][skill] = int(p["skills"].get(skill, 0)) + (int(ceil(n * 1.5)) if GS.has_building("universidad") else n)
	if level(skill) > before:
		GS.say("Tu habilidad de %s sube a nivel %d." % [skill, level(skill)])


static func weapon() -> Dictionary:
	return WEAPONS[GS.data.get("weapon_type", "espada")]


static func has_wound(w: String) -> bool:
	return w in _p().get("wounds", [])


static func wound(w: String) -> void:
	var p := _p()
	if not p.has("wounds"):
		p["wounds"] = []
	if w in p["wounds"]:
		return
	p["wounds"].append(w)
	if w == "cicatriz":
		GS.data["prestige"] += 5
	GS.popups.append({"title": "Herida de guerra", "text": "La batalla te deja una marca: %s." % WOUNDS[w], "button": "Continuar"})


## Tras una batalla dura puede quedar una herida para siempre.
static func after_battle(hp_left: float, hp_max: float) -> void:
	if hp_left / maxf(1.0, hp_max) < 0.3 and randf() < 0.35:
		wound(WOUNDS.keys().pick_random())


static func speed_mult() -> float:
	return 0.85 if has_wound("cojera") else 1.0


static func damage_mult() -> float:
	return (1.0 + 0.05 * level("combate")) * (0.9 if has_wound("brazo") else 1.0) * float(weapon()["dmg"])


## Color del pelo según la edad: las canas llegan a partir de los 45.
static func hair(age: int, base: Color) -> Color:
	if age < 45:
		return base
	return base.lerp(Color(0.78, 0.78, 0.76), clampf((age - 45) / 15.0, 0.0, 0.85))


static func sell_mult() -> float:
	return 1.0 + 0.03 * level("comercio")


static func summary() -> String:
	var lines := []
	for s in SKILLS:
		lines.append("%s %d" % [s.capitalize(), level(s)])
	var w := ", ".join(_p().get("wounds", []).map(func(x): return String(WOUNDS[x]).split(" (")[0].split(":")[0]))
	return "Habilidades: " + " · ".join(lines) + "\nArma: " + String(weapon()["name"]) + ("\nHeridas: " + w if w != "" else "")


## El físico cura salud y, con suerte, alguna herida.
static func physician(v) -> void:
	var d = GS.data
	if int(d["gold"]) < 30:
		v._open_panel("Físico", "El físico cobra 30 de oro.", [["Cerrar", v._close_panel]])
		return
	d["gold"] = int(d["gold"]) - 30
	d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 30.0)
	var text := "El físico te sangra, te da unas hierbas y te manda reposo. (+30 salud)"
	var cur: Array = _p().get("wounds", []).filter(func(x): return x != "cicatriz")
	if not cur.is_empty() and randf() < 0.4:
		var w = cur.pick_random()
		_p()["wounds"].erase(w)
		text += "\n¡Y consigue curarte: %s!" % String(WOUNDS[w]).split(":")[0].split(" (")[0].to_lower()
	v._open_panel("Físico", text, [["Cerrar", v._close_panel]])


## Panel del armero (herrería del mercado): cambiar de arma.
static func armory(v, back: Callable) -> void:
	var d = GS.data
	var opts := []
	for k in WEAPONS:
		var w: Dictionary = WEAPONS[k]
		var cur: bool = d.get("weapon_type", "espada") == k
		opts.append(["%s%s — %s%s" % [w["name"], " (la llevas)" if cur else "", w["desc"], "" if int(w["price"]) == 0 else " %d oro" % int(w["price"])], func():
			d["gold"] = int(d["gold"]) - int(w["price"])
			d["weapon_type"] = k
			armory(v, back), not cur and int(d["gold"]) >= int(w["price"])])
	opts.append(["Volver", back])
	v._open_panel("Armero", "Elige tu arma de batalla. El nivel de tu espada del mercado mejora cualquier arma.", opts)
