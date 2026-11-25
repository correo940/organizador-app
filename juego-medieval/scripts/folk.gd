extends RefCounted
## La gente del pueblo: carácter y gustos de cada vecino, amistades y enemistades entre ellos,
## la escuela de los niños y los ancianos (consejos, historias y herencias).

const PERS := {
	"alegre": "Alegre",
	"gruñón": "Gruñón",
	"chismoso": "Chismoso",
	"trabajador": "Trabajador",
	"tímido": "Tímido",
	"generoso": "Generoso",
}
const LIKES := ["pan", "queso", "miel", "cerveza", "manzana", "carne", "pescado", "tela"]
const LINES := {
	"alegre": ["¡Qué buen día hace! Da gusto verte.", "¡Hoy me siento con suerte! ¿Y tú?", "En la próxima fiesta pienso bailar hasta el alba."],
	"gruñón": ["¿Otra vez tú? Bueno, ¿qué quieres?", "Este pueblo ya no es lo que era.", "Los jóvenes de hoy no saben trabajar."],
	"chismoso": ["¿Te has enterado? Dicen que %s anda en amores...", "No se lo digas a nadie, pero %s debe dinero a medio pueblo.", "Me han contado que %s se pelea con todo el mundo."],
	"trabajador": ["No tengo mucho tiempo, el trabajo no se hace solo.", "Si madrugas, la tierra te lo devuelve.", "Este año pienso sacar el doble."],
	"tímido": ["Ho... hola. Perdona, no te había visto.", "Eh... buen día, señor.", "Prefiero no hablar mucho, si no te importa."],
	"generoso": ["Toma, llévate esto, que a mí me sobra.", "Si alguna vez necesitas algo, mi puerta está abierta.", "Hay que ayudarse entre vecinos, ¿no crees?"],
}


static func pers(v: Dictionary) -> String:
	if not v.has("pers"):
		v["pers"] = PERS.keys().pick_random()
		v["likes"] = LIKES.pick_random()
	return v["pers"]


static func greeting(v: Dictionary) -> String:
	var p := pers(v)
	var line: String = LINES[p].pick_random()
	if "%s" in line:
		var others: Array = GS.data["villagers"].filter(func(o): return o["name"] != v["name"])
		line = line % (others.pick_random()["name"] if not others.is_empty() else "alguien")
	return line


## Cuánto afecto gana al charlar según su carácter.
static func chat_mult(v: Dictionary) -> float:
	return {"alegre": 1.4, "gruñón": 0.6, "tímido": 0.8, "generoso": 1.2}.get(pers(v), 1.0)


# ---------------- Relaciones entre vecinos ----------------

static func _key(a: String, b: String) -> String:
	return a + "|" + b if a < b else b + "|" + a


static func rel(a: String, b: String) -> int:
	return int(GS.data.get("vrel", {}).get(_key(a, b), 0))


static func _add(a: String, b: String, n: int) -> void:
	if not GS.data.has("vrel"):
		GS.data["vrel"] = {}
	GS.data["vrel"][_key(a, b)] = clampi(rel(a, b) + n, -100, 100)


static func friends_text(v: Dictionary) -> String:
	var fr := []
	var en := []
	for o in GS.data["villagers"]:
		if o["name"] == v["name"]:
			continue
		var r := rel(v["name"], o["name"])
		if r >= 40:
			fr.append(o["name"])
		elif r <= -40:
			en.append(o["name"])
	return "Amigos: %s · Enemistades: %s" % [", ".join(fr) if not fr.is_empty() else "ninguno", ", ".join(en) if not en.is_empty() else "ninguna"]


## Cada día dos vecinos se cruzan: se hacen amigos, discuten o se pelean; los enemistados acaban yéndose.
static func day() -> void:
	var d = GS.data
	var vil: Array = d["villagers"]
	if vil.size() < 2:
		return
	var a = vil.pick_random()
	var b = vil.pick_random()
	if a == b:
		return
	var pa := pers(a)
	var pb := pers(b)
	var n := randi_range(-6, 10)
	if pa == "gruñón" or pb == "gruñón":
		n -= 6
	if (pa == "chismoso") != (pb == "chismoso") and randf() < 0.4:
		n -= 8
	if pa == pb or pa == "generoso" or pb == "generoso":
		n += 5
	if Vector2(a["hx"], a["hy"]).distance_to(Vector2(b["hx"], b["hy"])) < 15:
		n += 3
	_add(a["name"], b["name"], n)
	var r := rel(a["name"], b["name"])
	if r <= -40 and randf() < 0.25:
		GS.say("%s y %s discuten a gritos en la plaza." % [a["name"], b["name"]])
		a["mood"] = maxi(0, int(a["mood"]) - 5)
		b["mood"] = maxi(0, int(b["mood"]) - 5)
	if r <= -80 and randf() < 0.2:
		var leaver = a if int(a["mood"]) < int(b["mood"]) else b
		var other = b if leaver == a else a
		if not leaver.has("partner") and leaver.get("kids", []).is_empty():
			vil.erase(leaver)
			GS.say("Harto de pelearse con %s, %s se marcha del pueblo." % [other["name"], leaver["name"]])
	elif r >= 70 and a["male"] != b["male"] and not a.has("partner") and not b.has("partner") and not a.has("suitor") and not b.has("suitor") and randf() < 0.2:
		a["suitor"] = b["name"]
		b["suitor"] = a["name"]
		GS.say("La amistad entre %s y %s se convierte en noviazgo." % [a["name"], b["name"]])
	if pa == "generoso" and int(a["affection"]) >= 40 and randf() < 0.03:
		var it: String = LIKES.pick_random()
		GS.add(it, 2)
		GS.say("%s te deja un regalo en la puerta: 2 de %s." % [a["name"], String(GS.ITEMS[it][0]).to_lower()])


# ---------------- Niños y escuela ----------------

## Al hacerse mayor, con escuela eligen el oficio que más hace falta y empiezan con ahorros.
static func grown_up(nv: Dictionary) -> void:
	if GS.has_building("escuela"):
		nv["gold"] = int(nv["gold"]) + 15
		nv["mood"] = mini(100, int(nv.get("mood", 60)) + 10)
		nv["schooled"] = true


# ---------------- Ancianos ----------------

static func is_elder(v: Dictionary) -> bool:
	return int(v["age"]) >= 55


static func elder_options(v: Dictionary, panel: Callable) -> Array:
	if not is_elder(v):
		return []
	var d = GS.data
	var si := GS.season_index()
	var opts := []
	opts.append(["Pedirle consejo (una vez por estación)", func():
		v["advised"] = si
		var roll := randi() % 4
		var text := ""
		match roll:
			0:
				d["prestige"] += 3
				text = "«Escucha más de lo que hablas, y la gente te seguirá.» (+3 prestigio)"
			1:
				var best := ""
				var bp := 0
				for c in GS.CROPS:
					var p := int(GS.ITEMS.get(c, ["", 0])[1]) * int(GS.CROPS[c]["yield"][1])
					if p > bp:
						bp = p
						best = c
				text = "«En estas tierras, lo que más rinde es %s. Siémbrala y no te faltará.»" % String(GS.CROPS[best]["name"]).to_lower()
			2:
				d["player"]["health"] = minf(100.0, float(d["player"]["health"]) + 10.0)
				text = "Te da un remedio de hierbas de su abuela. (+10 salud)"
			_:
				d["gold"] = int(d["gold"]) + 5
				text = "«Guarda siempre algo para el invierno.» Y te da unas monedas que tenía escondidas. (+5 oro)"
		v["affection"] = mini(100, int(v["affection"]) + 5)
		panel.call(text), int(v.get("advised", -1)) != si])
	opts.append(["Escuchar historias del pueblo", func():
		var ch: Array = d.get("chronicle", [])
		var tales := ["«Cuando yo era mozo, aquí no había más que cuatro chozas y un pozo.»", "«Una vez vino el rey en persona y se le cayó la corona al barro. ¡Cómo nos reímos!»", "«En el invierno del hambre comimos bellotas. Que no vuelva nunca.»"]
		if not ch.is_empty():
			var e = ch.pick_random()
			tales.append("«¿Te acuerdas del año %d? %s Aún se habla de ello.»" % [int(e["y"]), e["t"]])
		v["affection"] = mini(100, int(v["affection"]) + 3)
		panel.call(tales.pick_random())])
	return opts


## Al morir, el anciano que te apreciaba te deja su herencia.
static func inheritance(v: Dictionary) -> void:
	if int(v.get("affection", 0)) < 60:
		return
	var g := int(v.get("gold", 0))
	if g > 0:
		GS.data["gold"] = int(GS.data["gold"]) + g
	GS.popups.append({"title": "Una herencia", "text": "%s, que tanto te apreciaba, te deja en herencia sus ahorros: %d de oro y sus recuerdos." % [v["name"], g], "button": "Continuar"})
