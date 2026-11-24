extends RefCounted
## Ventana de comercio con un aldeano: comprar, vender y trueque.

const SIM := preload("res://scripts/village_sim.gd")


static func _name(k: String) -> String:
	if k == "madera" or k == "piedra":
		return k.capitalize()
	return GS.ITEMS[k][0]


static func _btn(text: String, cb: Callable, enabled: bool) -> Button:
	var b := Button.new()
	b.text = text
	b.disabled = not enabled
	b.pressed.connect(cb)
	return b


static func _label(text: String, header := false) -> Label:
	var l := Label.new()
	l.text = text
	if header:
		l.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	return l


## Lo que el jugador podría dar a cambio de 'value' oro: [objeto, cantidad] o [].
static func _barter_offer(vil: Dictionary, value: int) -> Array:
	var w := SIM.wants(vil)
	for k in w:
		var unit := SIM.price(k)
		var qty := int(ceil(float(value) / unit))
		if GS.res(k) >= qty and qty <= int(w[k]) + 2:
			return [k, qty]
	return []


static func open(v, i: int) -> void:
	var d = GS.data
	var vil = d["villagers"][i]
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	var mood: int = vil["mood"]
	box.add_child(_label("%s es %s. Tiene %d de oro y está %s.  Tu oro: %d" % [GS.full_name(vil), SIM.job_name(vil).to_lower(), int(vil["gold"]), "contento" if mood >= 60 else ("tranquilo" if mood >= 35 else "preocupado"), int(d["gold"])]))

	var sells := GridContainer.new()
	sells.columns = 4
	sells.add_theme_constant_override("h_separation", 10)
	for h in ["Te vende", "Le sobra", "", ""]:
		sells.add_child(_label(h, true))
	var any := false
	for k in vil["inv"].keys():
		var spare: int = SIM.vinv(vil, k) - SIM.keep(vil, k)
		if spare <= 0:
			continue
		any = true
		var p := int(ceil(SIM.price(k) * 1.2))
		sells.add_child(_label(_name(k)))
		sells.add_child(_label(str(spare)))
		sells.add_child(_btn("Comprar 1 (-%d oro)" % p, func():
			d["gold"] -= p
			vil["gold"] += p
			SIM.vadd(vil, k, -1)
			GS.res_add(k, 1)
			vil["affection"] = mini(100, int(vil["affection"]) + 1)
			open(v, i), int(d["gold"]) >= p))
		var offer := _barter_offer(vil, p)
		if offer.is_empty():
			sells.add_child(_label("(nada que le interese)"))
		else:
			sells.add_child(_btn("Cambiar por %d %s" % [offer[1], _name(offer[0]).to_lower()], func():
				GS.res_add(offer[0], -offer[1])
				SIM.vadd(vil, offer[0], offer[1])
				SIM.vadd(vil, k, -1)
				GS.res_add(k, 1)
				vil["affection"] = mini(100, int(vil["affection"]) + 2)
				open(v, i), true))
	if not any:
		sells.add_child(_label("Ahora no le sobra nada."))
		for n in 3:
			sells.add_child(Control.new())
	box.add_child(sells)

	var buys := GridContainer.new()
	buys.columns = 4
	buys.add_theme_constant_override("h_separation", 10)
	for h in ["Te compra", "Quiere", "Tú tienes", ""]:
		buys.add_child(_label(h, true))
	var w := SIM.wants(vil)
	for k in w:
		var p := SIM.price(k)
		buys.add_child(_label(_name(k)))
		buys.add_child(_label(str(w[k])))
		buys.add_child(_label(str(GS.res(k))))
		buys.add_child(_btn("Vender 1 (+%d oro)" % p, func():
			GS.res_add(k, -1)
			SIM.vadd(vil, k, 1)
			vil["gold"] -= p
			d["gold"] += p
			vil["affection"] = mini(100, int(vil["affection"]) + 1)
			open(v, i), GS.res(k) >= 1 and int(vil["gold"]) >= p))
	if w.is_empty():
		buys.add_child(_label("No necesita nada."))
		for n in 3:
			buys.add_child(Control.new())
	box.add_child(buys)

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(720, 400)
	scroll.add_child(box)
	v._open_custom("Comerciar con %s" % GS.full_name(vil), scroll)
