extends RefCounted
## Dibujo procedural compartido (personas, paneles).


static func person(ci: CanvasItem, p: Vector2, tunic: Color, male: bool, walk: float, s: float = 1.0) -> void:
	var skin := Color(0.93, 0.76, 0.6)
	var hair := Color(0.3, 0.2, 0.1) if male else Color(0.5, 0.28, 0.1)
	var leg := Color(0.25, 0.18, 0.12)
	var sw := sin(walk * 12.0) * 4.0 * s
	ci.draw_circle(p + Vector2(0, 18) * s, 9.0 * s, Color(0, 0, 0, 0.22))
	ci.draw_line(p + Vector2(-4, 8) * s, p + Vector2(-4 * s + sw, 18 * s), leg, 3.0 * s)
	ci.draw_line(p + Vector2(4, 8) * s, p + Vector2(4 * s - sw, 18 * s), leg, 3.0 * s)
	if male:
		ci.draw_rect(Rect2(p + Vector2(-8, -8) * s, Vector2(16, 18) * s), tunic)
		ci.draw_line(p + Vector2(-8, 4) * s, p + Vector2(8, 4) * s, Color(0.3, 0.2, 0.1), 2.0 * s)
	else:
		ci.draw_circle(p + Vector2(0, -12) * s, 9.0 * s, hair)
		ci.draw_colored_polygon(PackedVector2Array([p + Vector2(-7, -8) * s, p + Vector2(7, -8) * s, p + Vector2(11, 14) * s, p + Vector2(-11, 14) * s]), tunic)
	ci.draw_circle(p + Vector2(0, -15) * s, 7.0 * s, skin)
	if male:
		ci.draw_arc(p + Vector2(0, -16) * s, 6.0 * s, PI, TAU, 8, hair, 4.0 * s)


static func panel_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.15, 0.11, 0.07, 0.94)
	sb.border_color = Color(0.85, 0.7, 0.35)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(16)
	return sb


## Tema de pergamino: paneles de papel envejecido con varas de madera y botones de madera tallada.
const INK := Color(0.24, 0.13, 0.05)
const TITLE := Color(0.5, 0.1, 0.05)
static var _theme: Theme
static func parchment_theme() -> Theme:
	if _theme != null:
		return _theme
	_theme = Theme.new()
	var p := StyleBoxTexture.new()
	p.texture = load("res://assets/ui/pergamino.png")
	p.texture_margin_top = 44
	p.texture_margin_bottom = 44
	p.texture_margin_left = 30
	p.texture_margin_right = 30
	p.content_margin_top = 46
	p.content_margin_bottom = 46
	p.content_margin_left = 44
	p.content_margin_right = 44
	_theme.set_stylebox("panel", "PanelContainer", p)
	_theme.set_color("font_color", "Label", INK)
	var le := StyleBoxFlat.new()
	le.bg_color = Color(0.96, 0.9, 0.76, 0.85)
	le.border_color = Color(0.45, 0.3, 0.15)
	le.set_border_width_all(2)
	le.set_corner_radius_all(4)
	le.set_content_margin_all(6)
	_theme.set_stylebox("normal", "LineEdit", le)
	_theme.set_stylebox("focus", "LineEdit", le)
	_theme.set_color("font_color", "LineEdit", INK)
	_theme.set_color("caret_color", "LineEdit", INK)
	# Botones de madera oscura con ribete dorado: limpios y legibles sobre el pergamino.
	for st in ["normal", "hover", "pressed", "focus", "disabled"]:
		var c := StyleBoxFlat.new()
		c.bg_color = {"normal": Color(0.33, 0.2, 0.1), "hover": Color(0.45, 0.28, 0.13), "pressed": Color(0.24, 0.14, 0.07), "focus": Color(0.38, 0.23, 0.11), "disabled": Color(0.5, 0.44, 0.36, 0.5)}[st]
		c.border_color = Color(0.85, 0.66, 0.32) if st != "disabled" else Color(0.55, 0.48, 0.4, 0.6)
		c.set_border_width_all(2)
		c.border_width_bottom = 3
		c.set_corner_radius_all(6)
		c.content_margin_left = 18
		c.content_margin_right = 18
		c.content_margin_top = 7
		c.content_margin_bottom = 7
		c.shadow_color = Color(0, 0, 0, 0.25)
		c.shadow_size = 2
		c.shadow_offset = Vector2(0, 2)
		_theme.set_stylebox(st, "Button", c)
	_theme.set_font_size("font_size", "Button", 17)
	_theme.set_color("font_color", "Button", Color(0.96, 0.88, 0.68))
	_theme.set_color("font_hover_color", "Button", Color(1, 0.95, 0.75))
	_theme.set_color("font_focus_color", "Button", Color(1, 0.95, 0.75))
	_theme.set_color("font_pressed_color", "Button", Color(0.9, 0.8, 0.6))
	_theme.set_color("font_disabled_color", "Button", Color(0.65, 0.6, 0.55))
	return _theme


## Ilustración para un aviso según su título ("" si no tiene).
static func event_picture(title: String) -> String:
	var l := title.to_lower()
	for k in [["peste", "peste"], ["saqueo", "saqueo"], ["caravana asaltada", "saqueo"], ["nacido", "nacimiento"], ["nacimiento", "nacimiento"], ["llamada del rey", "llamada"], ["a las armas", "llamada"], ["feria", "mercado"], ["mercado", "mercado"], ["mercader", "mercado"], ["fin del linaje", "fin"], ["larga vida al rey", "coronacion"], ["corona", "coronacion"], ["boda", "boda"], ["fuego", "incendio"], ["incendio", "incendio"], ["muere", "funeral"], ["fin del linaje", "funeral"], ["ha caído", "funeral"], ["asesinato", "funeral"], ["funeral", "funeral"], ["invierno", "invierno"], ["hambruna", "invierno"], ["cosecha", "cosecha"], ["victoria", "victoria"], ["larga vida", "victoria"], ["se rinde", "victoria"], ["campeón", "victoria"]]:
		if l.contains(k[0]):
			return "res://assets/ui/evento_%s.jpg" % k[1]
	return ""


## Retrato pintado de una persona según sexo, edad y rango ("" si no hay).
static func face_of(p: Dictionary, noble := false, royal := false) -> String:
	var male: bool = p.get("male", true)
	var age := int(p.get("age", 30))
	var k: String
	if age < 15:
		k = ("nino" if hash(String(p.get("name", ""))) % 2 == 0 else "nino2") if male else "nina"
	elif royal:
		k = "rey" if male else "reina"
	elif age >= 58:
		k = "anciano" if male else "anciana"
	elif noble:
		k = "senor" if male else "dama"
	else:
		k = "hombre" if male else "mujer"
	return "res://assets/ui/retrato_%s.png" % k


## Escudo de armas de cada señor de la región.
static func shield(i: int) -> String:
	return "res://assets/ui/escudo_%d.png" % (posmod(i, 5))


## Fila de retratos con nombre debajo (familia, corte...).
static func portrait_row(people: Array) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	for pe in people:
		var vb := VBoxContainer.new()
		var tr := TextureRect.new()
		tr.texture = load(pe[0])
		tr.custom_minimum_size = Vector2(84, 84)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		vb.add_child(tr)
		if String(pe[0]).contains("retrato_"):
			# Marco tallado alrededor de cada cara.
			var fr := TextureRect.new()
			fr.texture = load("res://assets/ui/marco_cara.png")
			fr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			fr.stretch_mode = TextureRect.STRETCH_SCALE
			fr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			fr.offset_left = -9
			fr.offset_top = -9
			fr.offset_right = 9
			fr.offset_bottom = 9
			tr.add_child(fr)
		var l := Label.new()
		l.text = pe[1]
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.add_theme_font_size_override("font_size", 13)
		vb.add_child(l)
		row.add_child(vb)
	return row


## Texto de un panel: si es largo va en una caja con barra de desplazamiento para no tapar los botones.
static func panel_text(text: String, width: float) -> Control:
	var b := Label.new()
	b.text = text
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.custom_minimum_size.x = width
	if text.length() < 420 and text.count("\n") < 9:
		return b
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(width + 16, 170)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.add_child(b)
	return sc


## Botones de un panel: con muchos, en dos columnas y con desplazamiento si no caben.
static func panel_buttons(box: Container, options: Array) -> Button:
	# "Cerrar" / "Volver" siempre fuera de la rejilla, abajo y a la vista.
	var tail := []
	while options.size() > 6 and String(options[-1][0]) in ["Cerrar", "Volver", "Salir"]:
		tail.push_front(options[-1])
		options = options.slice(0, options.size() - 1)
	var holder: Container = box
	if options.size() > 6:
		var g := GridContainer.new()
		g.columns = 2
		g.add_theme_constant_override("h_separation", 8)
		g.add_theme_constant_override("v_separation", 6)
		if options.size() > 12:
			var sc := ScrollContainer.new()
			sc.custom_minimum_size = Vector2(0, 260)
			sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
			box.add_child(sc)
			sc.add_child(g)
			g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		else:
			box.add_child(g)
		holder = g
	var first: Button = null
	for o in options:
		var btn := Button.new()
		btn.text = o[0]
		btn.custom_minimum_size.y = 34
		btn.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		btn.tooltip_text = o[0]
		if holder != box:
			btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			btn.custom_minimum_size.x = 300
			btn.add_theme_font_size_override("font_size", 14)
		if o.size() > 2 and not o[2]:
			btn.disabled = true
		btn.pressed.connect(o[1])
		holder.add_child(btn)
		if first == null and not btn.disabled:
			first = btn
	for o in tail:
		var cb := Button.new()
		cb.text = o[0]
		cb.custom_minimum_size.y = 34
		cb.pressed.connect(o[1])
		box.add_child(cb)
		if first == null:
			first = cb
	return first


## Bloque de imagen para paneles.
static func picture(path: String) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = load(path)
	tr.custom_minimum_size = Vector2(540, 260)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	return tr


static func bar_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.07, 0.04, 0.8)
	sb.set_content_margin_all(8)
	return sb
