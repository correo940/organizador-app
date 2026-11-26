extends RefCounted
## Piezas del HUD del pueblo: retrato con escudo, barras, minimapa redondo con reloj de sol y ranuras.

const GOLD := Color(0.85, 0.7, 0.35)
const DARK := Color(0.12, 0.09, 0.06, 0.92)


static func frame_style(radius := 8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = DARK
	sb.border_color = GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(8)
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 4
	return sb


## Retrato: medallón con el escudo de la familia y la inicial.
class Portrait extends Control:
	var initial := "R"
	var col := Color(0.55, 0.1, 0.1)
	var face: Texture2D = null
	var frame: Texture2D = load("res://assets/ui/marco_retrato.png")

	func _draw() -> void:
		var c := size / 2
		var full := minf(size.x, size.y) / 2
		if frame != null:
			# Retrato pintado (o el escudo si no hay) dentro del marco tallado.
			var hole := full * 0.57
			if face != null:
				draw_texture_rect(face, Rect2(c - Vector2(hole, hole), Vector2(hole, hole) * 2), false)
			else:
				var sh: Texture2D = load("res://assets/ui/escudo_castillo.png")
				draw_texture_rect(sh, Rect2(c - Vector2(hole, hole) * 0.85, Vector2(hole, hole) * 1.7), false)
			draw_texture_rect(frame, Rect2(c - Vector2(full, full), Vector2(full, full) * 2), false)
			return
		_shield(c, full - 2)

	func _shield(c: Vector2, r: float) -> void:
		draw_circle(c, r + 2, Color(0.08, 0.06, 0.04))
		draw_circle(c, r, Color(0.35, 0.26, 0.15))
		draw_arc(c, r, 0, TAU, 48, GOLD, 3.0, true)
		# Escudo en el centro.
		var w := r * 1.0
		var pts := PackedVector2Array([c + Vector2(-w * 0.55, -w * 0.6), c + Vector2(w * 0.55, -w * 0.6), c + Vector2(w * 0.55, w * 0.05), c + Vector2(0, w * 0.7), c + Vector2(-w * 0.55, w * 0.05)])
		draw_colored_polygon(pts, col)
		pts.append(pts[0])
		draw_polyline(pts, GOLD, 2.0, true)
		var f := ThemeDB.fallback_font
		var fs := int(r * 0.8)
		var ts := f.get_string_size(initial, HORIZONTAL_ALIGNMENT_CENTER, -1, fs)
		draw_string(f, c + Vector2(-ts.x / 2, fs * 0.3), initial, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 0.92, 0.7))


## Barra con nombre y valor (salud, despensa...).
class Bar extends Control:
	var label := ""
	var value := 1.0
	var col := Color(0.75, 0.12, 0.1)
	var icon: Texture2D = null

	func _draw() -> void:
		var x0 := size.y * 1.1 if icon != null else 0.0
		var r := Rect2(Vector2(x0, 0), Vector2(size.x - x0, size.y))
		draw_rect(r, Color(0.05, 0.04, 0.03, 0.9))
		draw_rect(Rect2(r.position + Vector2(2, 2), Vector2((r.size.x - 4) * clampf(value, 0, 1), r.size.y - 4)), col)
		draw_rect(Rect2(r.position + Vector2(2, 2), Vector2((r.size.x - 4) * clampf(value, 0, 1), (r.size.y - 4) * 0.4)), Color(1, 1, 1, 0.15))
		draw_rect(r, GOLD, false, 1.5)
		if icon != null:
			draw_texture_rect(icon, Rect2(Vector2(-2, -3), Vector2(size.y + 6, size.y + 6)), false)
		var f := ThemeDB.fallback_font
		draw_string_outline(f, Vector2(x0 + 8, size.y * 0.72), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color.BLACK)
		draw_string(f, Vector2(x0 + 8, size.y * 0.72), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color.WHITE)


## Minimapa redondo centrado en el jugador (norte arriba) y reloj de sol y luna.
class Minimap extends Control:
	var v  # la aldea
	var scale_px := 0.75
	var frame: Texture2D = load("res://assets/ui/marco_mapa.png")
	var t_acc := 0.0

	func _process(delta: float) -> void:
		t_acc += delta
		if t_acc > 0.1:
			t_acc = 0.0
			queue_redraw()

	func _w2m(p: Vector2, c: Vector2, o: Vector2) -> Vector2:
		return c + (p - o) * scale_px

	func _draw() -> void:
		if v == null or v.player == null:
			return
		var BLD := preload("res://scripts/buildings.gd")
		var FARM := preload("res://scripts/farm.gd")
		var c := Vector2(size.x / 2, size.y / 2)
		var full := minf(size.x, size.y) / 2
		var r := full * 0.51 if frame != null else full - 4
		var fo: Vector3 = v.cam.focus if v.cam.rts else v.player.position
		var o := Vector2(fo.x, fo.z)
		draw_circle(c, r + 6, Color(0.08, 0.06, 0.04))
		draw_circle(c, r, Color(0.36, 0.42, 0.22))
		var inside := func(p: Vector2) -> bool: return p.distance_to(c) < r - 2
		# Campos, estanque, calles, plaza, casas y talleres.
		for rc in FARM.field_rects():
			var a := _w2m(rc.position, c, o)
			if inside.call(a + rc.size * scale_px / 2):
				draw_rect(Rect2(a, rc.size * scale_px), Color(0.45, 0.33, 0.18))
		# Bosque, lago e islote.
		var lc := _w2m(Vector2(v.LAKE_C.x, v.LAKE_C.z), c, o)
		var pts := PackedVector2Array()
		for k in 32:
			var a := k * TAU / 32.0
			var q := lc + Vector2(cos(a) * v.LAKE_R.x, sin(a) * v.LAKE_R.y) * scale_px
			if inside.call(q):
				pts.append(q)
		if pts.size() > 2:
			draw_colored_polygon(Geometry2D.convex_hull(pts), Color(0.25, 0.45, 0.65))
		var ic := _w2m(Vector2(v.ISLAND.x, v.ISLAND.z), c, o)
		if inside.call(ic):
			draw_circle(ic, v.ISLAND_R * scale_px, Color(0.36, 0.44, 0.2))
		for k in range(0, v.trees.size(), 3):
			var tp := _w2m(Vector2(v.trees[k]["p"].x, v.trees[k]["p"].z), c, o)
			if inside.call(tp):
				draw_circle(tp, 1.6, Color(0.2, 0.32, 0.14))
		if v.boat_node:
			var bp := _w2m(Vector2(v.boat_node.position.x, v.boat_node.position.z), c, o)
			if inside.call(bp):
				draw_circle(bp, 2.5, Color(0.9, 0.85, 0.7))
		var pp := _w2m(Vector2(FARM.POND.x, FARM.POND.z), c, o)
		if inside.call(pp):
			draw_circle(pp, FARM.POND_R * scale_px, Color(0.25, 0.45, 0.65))
		for st in BLD.STREETS:
			var a := _w2m(st[0], c, o)
			var b := _w2m(st[1], c, o)
			var n := 12
			for k in n:
				var p1 := a.lerp(b, float(k) / n)
				var p2 := a.lerp(b, float(k + 1) / n)
				if inside.call(p1) and inside.call(p2):
					draw_line(p1, p2, Color(0.62, 0.5, 0.33), maxf(2.0, st[2] * scale_px))
		var pz := _w2m(Vector2(v.PLAZA.x, v.PLAZA.z), c, o)
		if inside.call(pz):
			draw_rect(Rect2(pz - Vector2(10, 10) * scale_px, Vector2(20, 20) * scale_px), Color(0.72, 0.66, 0.55))
		for h in GS.HOMES:
			var hp := _w2m(h * 0.05, c, o)
			if inside.call(hp):
				draw_rect(Rect2(hp - Vector2(2.5, 2.5) * scale_px, Vector2(5, 5) * scale_px), Color(0.6, 0.35, 0.22))
		for sl in BLD.SLOTS:
			var sp := _w2m(Vector2(sl.x, sl.z), c, o)
			if inside.call(sp):
				draw_rect(Rect2(sp - Vector2(3, 3) * scale_px, Vector2(6, 6) * scale_px), Color(0.5, 0.45, 0.4))
		var hp2 := _w2m(Vector2(v.house_pos().x, v.house_pos().z), c, o)
		if inside.call(hp2):
			draw_circle(hp2, 5, Color(1.0, 0.8, 0.2))
		# Vecinos y el jugador (flecha según hacia dónde mira).
		for a in v.villagers:
			var vp := _w2m(Vector2(a.position.x, a.position.z), c, o)
			if inside.call(vp):
				draw_circle(vp, 2.2, Color(0.95, 0.95, 0.9))
		var rot: float = v.player.rotation.y
		var fwd := Vector2(sin(rot), cos(rot))
		var side := Vector2(fwd.y, -fwd.x)
		var pc := _w2m(Vector2(v.player.position.x, v.player.position.z), c, o)
		if inside.call(pc):
			draw_colored_polygon(PackedVector2Array([pc + fwd * 9, pc - fwd * 5 + side * 6, pc - fwd * 2, pc - fwd * 5 - side * 6]), Color(0.95, 0.2, 0.15))
		if frame != null:
			draw_texture_rect(frame, Rect2(c - Vector2(full, full), Vector2(full, full) * 2), false)
		else:
			draw_arc(c, r, 0, TAU, 64, GOLD, 3.0, true)
		# Reloj: medio disco de día y noche con el sol o la luna en su sitio.
		var cc := Vector2(26, 26)
		var t: float = GS.data["time"]
		draw_circle(cc, 23, Color(0.08, 0.06, 0.04))
		draw_circle(cc, 20, Color(0.15, 0.22, 0.4) if t < 0.22 or t > 0.85 else Color(0.85, 0.65, 0.35))
		var ang := t * TAU + PI / 2
		var sp2 := cc + Vector2(cos(ang), sin(ang)) * 12
		draw_circle(sp2, 5, Color(1.0, 0.85, 0.3) if t >= 0.22 and t <= 0.85 else Color(0.85, 0.88, 1.0))
		draw_arc(cc, 21, 0, TAU, 32, GOLD, 2.0, true)


## Ranura de la barra inferior: icono (texto), cantidad y tecla.
static func slot(label: String, key: String, icon: String = "") -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxTexture.new()
	sb.texture = load("res://assets/ui/ranura.png")
	sb.set_texture_margin_all(22)
	sb.set_content_margin_all(13)
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(86, 58)
	var vb := VBoxContainer.new()
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_theme_constant_override("separation", 0)
	p.add_child(vb)
	var l := Label.new()
	l.name = "L"
	l.text = label
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", 14)
	if icon != "":
		var tr := TextureRect.new()
		tr.texture = load(icon)
		tr.custom_minimum_size = Vector2(34, 34)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		vb.add_child(tr)
		vb.move_child(tr, 0)
		p.custom_minimum_size.y = 76
	vb.add_child(l)
	var k := Label.new()
	k.name = "K"
	k.text = key
	k.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	k.add_theme_font_size_override("font_size", 12)
	k.add_theme_color_override("font_color", GOLD)
	vb.add_child(k)
	return p
