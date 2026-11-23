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


static func bar_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.07, 0.04, 0.8)
	sb.set_content_margin_all(8)
	return sb
