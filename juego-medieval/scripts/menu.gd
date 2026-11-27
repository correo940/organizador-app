extends Control

const Art = preload("res://scripts/art.gd")

var main
var name_edit: LineEdit
var dyn_edit: LineEdit
var gender: OptionButton
var slot_opt: OptionButton
var diff_opt: OptionButton
var scen_opt: OptionButton
var box: VBoxContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := TextureRect.new()
	bg.texture = load("res://assets/ui/fondo_menu.jpg")
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.theme = Art.parchment_theme()
	center.add_child(panel)
	box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	box.custom_minimum_size = Vector2(680, 0)
	panel.add_child(box)

	var title := Label.new()
	title.text = "SANGRE Y LINAJE"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", Art.TITLE)
	box.add_child(title)
	var sub := Label.new()
	sub.text = "De campesino a señor de la guerra"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(sub)
	box.add_child(HSeparator.new())
	# Dos columnas: a la izquierda, la nueva partida; a la derecha, el resto.
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", 28)
	box.add_child(cols)
	var left := VBoxContainer.new()
	left.custom_minimum_size.x = 380
	left.add_theme_constant_override("separation", 6)
	cols.add_child(left)
	var right := VBoxContainer.new()
	right.custom_minimum_size.x = 260
	right.add_theme_constant_override("separation", 10)
	right.alignment = BoxContainer.ALIGNMENT_CENTER
	cols.add_child(right)
	var nh := Label.new()
	nh.text = "Nueva partida"
	nh.add_theme_font_size_override("font_size", 20)
	nh.add_theme_color_override("font_color", Art.TITLE)
	left.add_child(nh)
	var form := GridContainer.new()
	form.columns = 2
	form.add_theme_constant_override("h_separation", 10)
	form.add_theme_constant_override("v_separation", 6)
	left.add_child(form)
	var lab := func(t: String) -> void:
		var l := Label.new()
		l.text = t
		form.add_child(l)

	name_edit = LineEdit.new()
	name_edit.placeholder_text = "Nombre de tu personaje"
	name_edit.text = "Rodrigo"
	name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lab.call("Nombre")
	form.add_child(name_edit)
	dyn_edit = LineEdit.new()
	dyn_edit.placeholder_text = "Apellido de tu linaje"
	dyn_edit.text = "de Vallehondo"
	dyn_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lab.call("Linaje")
	form.add_child(dyn_edit)
	gender = OptionButton.new()
	gender.add_item("Hombre")
	gender.add_item("Mujer")
	gender.theme_type_variation = "Chip"
	lab.call("Sexo")
	form.add_child(gender)
	diff_opt = OptionButton.new()
	for t in ["Fácil", "Normal", "Difícil"]:
		diff_opt.add_item(t)
	diff_opt.selected = 1
	diff_opt.theme_type_variation = "Chip"
	lab.call("Dificultad")
	form.add_child(diff_opt)
	scen_opt = OptionButton.new()
	for s in GS.LEG.SCENARIOS:
		scen_opt.add_item(s["name"])
	scen_opt.theme_type_variation = "Chip"
	lab.call("Escenario")
	form.add_child(scen_opt)
	var sdesc := Label.new()
	sdesc.text = GS.LEG.SCENARIOS[0]["desc"]
	sdesc.add_theme_font_size_override("font_size", 13)
	sdesc.add_theme_color_override("font_color", Color(0.36, 0.24, 0.12))
	sdesc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sdesc.custom_minimum_size.x = 380
	left.add_child(sdesc)
	scen_opt.item_selected.connect(func(i): sdesc.text = GS.LEG.SCENARIOS[i]["desc"])
	slot_opt = OptionButton.new()
	for s in [1, 2, 3]:
		slot_opt.add_item("Ranura %d · %s" % [s, GS.slot_info(s)])
	slot_opt.theme_type_variation = "Chip"
	slot_opt.clip_text = true
	slot_opt.custom_minimum_size.x = 260
	lab.call("Guardar en")
	form.add_child(slot_opt)
	_button(left, "Empezar la partida", _on_new)

	if GS.has_save():
		_button(right, "Continuar", _on_continue)
		_button(right, "Cargar partida…", _load_panel)
	_button(right, "Logros", func(): GS.LEG.panel(self))
	_button(right, "Opciones", func(): preload("res://scripts/options.gd").open(self))
	_button(right, "Salir", func(): get_tree().quit())
	SFX.music("aldea")



func _button(parent: Node, text: String, cb: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size.y = 40
	b.pressed.connect(cb)
	parent.add_child(b)


func _on_new() -> void:
	var n := name_edit.text.strip_edges()
	var d := dyn_edit.text.strip_edges()
	GS.slot = slot_opt.selected + 1
	GS.new_game(n if n != "" else "Rodrigo", d if d != "" else "de Vallehondo", gender.selected == 0)
	GS.data["difficulty"] = diff_opt.selected
	GS.data["gold"] = [60, 15, 5][diff_opt.selected]
	GS.LEG.apply_scenario(GS.LEG.SCENARIOS[scen_opt.selected]["id"])
	GS.save_game()
	main.start_village()


func _load_panel() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := PanelContainer.new()
	panel.theme = Art.parchment_theme()
	center.add_child(panel)
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", 8)
	panel.add_child(b)
	var t := Label.new()
	t.text = "Cargar partida"
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Art.TITLE)
	b.add_child(t)
	for s in [1, 2, 3, 0]:
		var info: String = GS.slot_info(s)
		var bt := Button.new()
		bt.text = "%s: %s" % ["Guardado automático" if s == 0 else "Ranura %d" % s, info]
		bt.custom_minimum_size = Vector2(520, 38)
		bt.disabled = info == "vacía" or info == "dañada"
		bt.pressed.connect(func():
			if GS.load_game(s):
				main.start_village())
		b.add_child(bt)
	var c := Button.new()
	c.text = "Volver"
	c.custom_minimum_size.y = 36
	c.pressed.connect(layer.queue_free)
	b.add_child(c)


func _on_continue() -> void:
	if GS.load_game():
		main.start_village()
