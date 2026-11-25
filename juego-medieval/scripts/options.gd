extends RefCounted
## Ventana de opciones: volumen, sensibilidad del ratón, pantalla completa y sombras.

const Art = preload("res://scripts/art.gd")


static func open(parent: Node) -> void:
	var layer := CanvasLayer.new()
	layer.layer = 50
	parent.add_child(layer)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Art.panel_style())
	center.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.custom_minimum_size.x = 440
	panel.add_child(box)
	var t := Label.new()
	t.text = "Opciones"
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	box.add_child(t)
	var s = SFX.settings
	_slider(box, "Volumen de la música", 0, 100, 5, s["music"], func(v): s["music"] = v)
	_slider(box, "Volumen de los efectos", 0, 100, 5, s["sfx"], func(v): s["sfx"] = v)
	_slider(box, "Sensibilidad del ratón", 0.3, 2.5, 0.1, s["sens"], func(v): s["sens"] = v)
	_check(box, "Pantalla completa", s["fullscreen"], func(v): s["fullscreen"] = v)
	_check(box, "Sombras (desactívalas si el juego va lento; se aplica al cambiar de escena)", s["shadows"], func(v): s["shadows"] = v)
	var b := Button.new()
	b.text = "Cerrar"
	b.custom_minimum_size.y = 36
	b.pressed.connect(func():
		SFX.save_settings()
		layer.queue_free())
	box.add_child(b)


static func _slider(box: VBoxContainer, text: String, lo: float, hi: float, step: float, val, cb: Callable) -> void:
	var l := Label.new()
	box.add_child(l)
	var sl := HSlider.new()
	sl.min_value = lo
	sl.max_value = hi
	sl.step = step
	sl.value = float(val)
	l.text = "%s: %s" % [text, str(sl.value)]
	sl.value_changed.connect(func(v):
		cb.call(v)
		l.text = "%s: %s" % [text, str(v)]
		SFX.apply_settings())
	box.add_child(sl)


static func _check(box: VBoxContainer, text: String, val: bool, cb: Callable) -> void:
	var c := CheckBox.new()
	c.text = text
	c.button_pressed = val
	c.toggled.connect(func(v):
		cb.call(v)
		SFX.apply_settings())
	box.add_child(c)
