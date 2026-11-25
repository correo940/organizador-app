extends RefCounted
## Economía de tus tierras: caravanas comerciales propias, especialización e impuestos de tus pueblos,
## y las grandes crisis de la región (hambrunas y peste).

const R := preload("res://scripts/region_sim.gd")
const SPECS := {
	"minera": {"name": "Minera", "out": {"hierro": 6, "piedra": 15}},
	"maderera": {"name": "Maderera", "out": {"madera": 30}},
	"granjera": {"name": "Granjera", "out": {"trigo": 20, "carne": 5}},
	"pesquera": {"name": "Pesquera", "out": {"pescado": 14}},
}
const SPEC_COST := 50
const TAX_NAMES := ["bajos", "normales", "altos"]
const TAX_MULT := [0.6, 1.0, 1.6]
const CARAVAN_N := 10


# ---------------- Caravanas propias ----------------

## Envía una caravana con 10 unidades de un producto a vender en el mercado de otro pueblo.
static func send_caravan(from_id: int, to_id: int, item: String, escort: bool) -> String:
	var d = GS.data
	if GS.res(item) < CARAVAN_N:
		return "No tienes %d de ese producto." % CARAVAN_N
	if escort and GS.ARMY.total() < 5:
		return "No tienes 5 soldados para escoltarla."
	var a := R.town(from_id)
	var b := R.town(to_id)
	GS.res_add(item, -CARAVAN_N)
	var guards := 0
	if escort:
		var left := 5
		for k in ["milicia", "lancero", "infante", "arquero", "arquero_jinete", "jinete"]:
			var n := mini(left, int(d["army"][k]))
			d["army"][k] = int(d["army"][k]) - n
			left -= n
		guards = 5
	R.region()["caravans"].append({"from": from_id, "to": to_id, "x": float(a["x"]), "z": float(a["z"]), "mine": true, "item": item, "n": CARAVAN_N, "escort": guards})
	return ""


## Lo que hace cada día una caravana tuya; devuelve true si ha terminado (llegó o la asaltaron).
static func caravan_day(c: Dictionary, t: Dictionary, arrived: bool) -> bool:
	var d = GS.data
	var item_name: String = String(GS.ITEMS[c["item"]][0]).to_lower() if GS.ITEMS.has(c["item"]) else String(c["item"])
	if arrived:
		var price := R.market_price(t, c["item"], false)
		var gold := int(round(price * int(c["n"]) * GS.CHAR.sell_mult()))
		GS.CHAR.practice("comercio", 2)
		R.market_trade(t, c["item"], int(c["n"]), false)
		d["gold"] = int(d["gold"]) + gold
		d["army"]["milicia"] = int(d["army"]["milicia"]) + int(c["escort"])
		SFX.play("monedas")
		GS.say("Tu caravana vende %d de %s en %s: +%d oro.%s" % [int(c["n"]), item_name, t["name"], gold, " La escolta vuelve a casa." if int(c["escort"]) > 0 else ""])
		return true
	if randf() < (0.025 if int(c["escort"]) > 0 else 0.08):
		if int(c["escort"]) > 0 and randf() < 0.75:
			c["escort"] = int(c["escort"]) - 1
			GS.say("Unos bandidos atacan tu caravana, pero la escolta los rechaza (cae un soldado).")
			return false
		GS.popups.append({"title": "Caravana asaltada", "text": "Unos bandidos han asaltado tu caravana camino de %s y se han llevado %d de %s." % [t["name"], int(c["n"]), item_name], "button": "Continuar"})
		return true
	return false


## Panel para elegir producto y destino de una caravana.
static func caravan_panel(v, from_id: int) -> void:
	GS.tip("caravana", "las caravanas", "Una caravana lleva 10 unidades a vender al mercado que elijas; cuanto más lejos, más días tarda. Con escolta de 5 soldados es difícil que la asalten; los soldados vuelven al llegar.")
	var opts := []
	for k in R.TRADE_ITEMS:
		if GS.res(k) >= CARAVAN_N:
			var nm: String = k.capitalize() if k in ["madera", "piedra"] else String(GS.ITEMS[k][0])
			opts.append(["%s (tienes %d)" % [nm, GS.res(k)], func(): _dest_panel(v, from_id, k)])
	if opts.is_empty():
		v._say("Necesitas al menos %d unidades de algún producto para formar una caravana." % CARAVAN_N)
		return
	opts.append(["Cerrar", v._close_panel])
	v._open_panel("Caravana comercial", "Elige qué llevar (%d unidades). Venderás al precio del mercado de destino. Sin escolta, los bandidos pueden asaltarla por el camino." % CARAVAN_N, opts)


static func _dest_panel(v, from_id: int, item: String) -> void:
	var a := R.town(from_id)
	var dests: Array = R.region()["towns"].filter(func(t): return t.has("market") and int(t["id"]) != from_id and (t["owner"] == "jugador" or not R.NOBLES.at_war(-1, int(t["lord"]))))
	dests.sort_custom(func(x, y): return R.market_price(x, item, false) > R.market_price(y, item, false))
	var opts := []
	for t in dests.slice(0, 6):
		var dist := Vector2(t["x"], t["z"]).distance_to(Vector2(a["x"], a["z"]))
		var days := int(ceil(dist / (R.DAY_DIST * 0.7)))
		var price := R.market_price(t, item, false)
		var tid := int(t["id"])
		opts.append(["%s: %d oro (%d por unidad), %d días" % [t["name"], price * CARAVAN_N, price, days], func():
			_send(v, from_id, tid, item, false)])
		if GS.ARMY.total() >= 5:
			opts.append(["   … con escolta de 5 soldados", func(): _send(v, from_id, tid, item, true)])
	opts.append(["Volver", func(): caravan_panel(v, from_id)])
	v._open_panel("¿Adónde la envías?", "Mercados donde mejor se paga, de más a menos.", opts)


static func _send(v, from_id: int, to_id: int, item: String, escort: bool) -> void:
	var err := send_caravan(from_id, to_id, item, escort)
	v._say(err if err != "" else "La caravana parte hacia %s." % R.town(to_id)["name"])


# ---------------- Tus pueblos: especialización e impuestos ----------------

static func town_options(v, t: Dictionary, refresh: Callable) -> Array:
	var d = GS.data
	var opts := []
	var spec: String = t.get("spec", "")
	if spec == "":
		for k in SPECS:
			opts.append(["Especializar: %s (%d oro)" % [SPECS[k]["name"], SPEC_COST], func():
				d["gold"] = int(d["gold"]) - SPEC_COST
				t["spec"] = k
				refresh.call(), int(d["gold"]) >= SPEC_COST])
	var tax := int(t.get("tax", 1))
	for i in 3:
		if i != tax:
			opts.append(["Poner impuestos %s (%d%% de rentas)" % [TAX_NAMES[i], int(TAX_MULT[i] * 100)], func():
				t["tax"] = i
				refresh.call()])
	opts.append(["Enviar una caravana comercial desde aquí", func(): caravan_panel(v, int(t["id"]))])
	return opts


static func town_text(t: Dictionary) -> String:
	var spec: String = t.get("spec", "")
	var hint := ""
	if spec == "":
		hint = "\nPuedes especializarlo; cada estación te enviará: " + "; ".join(SPECS.keys().map(func(k): return "%s: %s" % [SPECS[k]["name"], ", ".join(SPECS[k]["out"].keys().map(func(x): return "%d %s" % [int(SPECS[k]["out"][x]), x]))]))
	return hint + "\nEspecialidad: %s · Impuestos %s · Descontento %d/100" % [SPECS[spec]["name"] if spec != "" else "ninguna", TAX_NAMES[int(t.get("tax", 1))], int(t.get("unrest", 0))]


static func tax_mult(t: Dictionary) -> float:
	return TAX_MULT[int(t.get("tax", 1))]


## Cada estación: producción de tus pueblos especializados, descontento por impuestos y crisis regionales.
static func season() -> void:
	var d = GS.data
	var got := {}
	for t in R.region()["towns"]:
		if t["owner"] != "jugador" or t.get("home", false):
			continue
		var spec: String = t.get("spec", "")
		if spec != "":
			var k: float = maxf(0.5, int(t["pop"]) / 100.0)
			for it in SPECS[spec]["out"]:
				var n := int(round(int(SPECS[spec]["out"][it]) * k))
				GS.res_add(it, n)
				got[it] = int(got.get(it, 0)) + n
		var tax := int(t.get("tax", 1))
		t["unrest"] = clampi(int(t.get("unrest", 0)) + [-10, -3, 15][tax], 0, 100)
		if int(t["unrest"]) >= 70:
			_revolt(t)
	if not got.is_empty():
		GS.say("Tus pueblos especializados envían: " + ", ".join(got.keys().map(func(x): return "%d %s" % [int(got[x]), x])) + ".")
	_crisis()


static func _revolt(t: Dictionary) -> void:
	var need := int(t["pop"]) / 40 + 2
	if int(t["garrison"]) >= need:
		t["garrison"] = int(int(t["garrison"]) * 0.7)
		t["unrest"] = 35
		GS.popups.append({"title": "Revuelta en %s" % t["name"], "text": "Los vecinos de %s se levantan contra tus impuestos. Tu guarnición sofoca la revuelta, pero pierde hombres." % t["name"], "button": "Continuar"})
		return
	var ni: int = R.NOBLES.new_house()
	if ni == -1:
		t["unrest"] = 50
		return
	t["owner"] = "señor"
	t["lord"] = ni
	t["vassal"] = false
	t["troops"] = int(t["garrison"]) + 6
	t["garrison"] = 0
	t["unrest"] = 0
	R.NOBLES.declare_war(-1, ni)
	GS.chronicle("%s se subleva contra tus impuestos y se independiza." % t["name"])
	GS.popups.append({"title": "¡%s se independiza!" % t["name"], "text": "Hartos de tus impuestos, los vecinos de %s expulsan a tus soldados y se entregan a %s, que te declara la guerra." % [t["name"], R.NOBLES.full(R.NOBLES.lord(ni))], "button": "Continuar"})


static func _crisis() -> void:
	var d = GS.data
	if int(d.get("crisis_cd", 0)) > 0:
		d["crisis_cd"] = int(d["crisis_cd"]) - 1
		return
	var roll := randf()
	if roll < 0.05:
		d["crisis_cd"] = 6
		for t in R.region()["towns"]:
			if t.has("pop"):
				t["pop"] = int(int(t["pop"]) * 0.9)
			if t.has("market"):
				for k in ["trigo", "harina", "pan", "carne"]:
					t["market"]["mult"][k] = 2.0
		d["commons"] = int(int(d["commons"]) * 0.93)
		for v in d["villagers"]:
			v["mood"] = maxi(0, int(v["mood"]) - 15)
		GS.popups.append({"title": "Hambruna en la región", "text": "Las malas cosechas se han extendido por toda la región. El pan escasea y su precio se dobla en todos los mercados; muere gente en todos los pueblos.\n\nEs buen momento para vender grano... o para repartirlo.", "button": "Continuar"})
	elif roll < 0.075:
		d["crisis_cd"] = 10
		for t in R.region()["towns"]:
			if t.has("pop"):
				t["pop"] = int(int(t["pop"]) * 0.8)
		var lost := int(int(d["commons"]) * 0.15)
		d["commons"] = int(d["commons"]) - lost
		var extra := ""
		if randf() < 0.35:
			d["player"]["health"] = maxf(1.0, float(d["player"]["health"]) - 35.0)
			extra = "\nTú también enfermas gravemente (-35 salud)."
		var young: Array = d["children"].filter(func(c): return int(c["age"]) < 6)
		if not young.is_empty() and randf() < 0.3:
			var c = young.pick_random()
			d["children"].erase(c)
			extra += "\nLa peste se lleva a tu %s %s." % ["hijo" if c["male"] else "hija", c["name"]]
		GS.popups.append({"title": "¡La peste!", "text": "Una peste terrible recorre la región: uno de cada cinco vecinos muere en todos los pueblos. En el tuyo mueren %d personas.%s" % [lost, extra], "button": "Continuar"})
