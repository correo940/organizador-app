extends Control

const Art = preload("res://scripts/art.gd")

var main
var name_edit: LineEdit
var dyn_edit: LineEdit
var gender: OptionButton


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.12, 0.08, 0.05)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Art.panel_style())
	center.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.custom_minimum_size = Vector2(460, 0)
	panel.add_child(box)

	var title := Label.new()
	title.text = "SANGRE Y LINAJE"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 44)
	title.add_theme_color_override("font_color", Color(0.9, 0.75, 0.4))
	box.add_child(title)
	var sub := Label.new()
	sub.text = "De campesino a señor de la guerra"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(sub)
	box.add_child(HSeparator.new())

	name_edit = LineEdit.new()
	name_edit.placeholder_text = "Nombre de tu personaje"
	name_edit.text = "Rodrigo"
	box.add_child(name_edit)
	dyn_edit = LineEdit.new()
	dyn_edit.placeholder_text = "Apellido de tu linaje"
	dyn_edit.text = "de Vallehondo"
	box.add_child(dyn_edit)
	gender = OptionButton.new()
	gender.add_item("Hombre")
	gender.add_item("Mujer")
	box.add_child(gender)

	_button(box, "Nueva partida", _on_new)
	if GS.has_save():
		_button(box, "Continuar partida guardada", _on_continue)
	var mb := Button.new()
	mb.text = "Música: sí" if SFX.music_on else "Música: no"
	mb.custom_minimum_size.y = 40
	mb.pressed.connect(func():
		SFX.toggle_music()
		mb.text = "Música: sí" if SFX.music_on else "Música: no")
	box.add_child(mb)
	_button(box, "Opciones", func(): preload("res://scripts/options.gd").open(self))
	_button(box, "Salir", func(): get_tree().quit())
	SFX.music("aldea")

	var help := Label.new()
	help.text = "WASD / flechas: moverse   E: interactuar   T: velocidad del tiempo\nEsc: menú   F5: guardar\nTala, pica piedra y cultiva. Construye tu casa, cásate y ten hijos.\nAcude cuando el rey te llame a la guerra y gana prestigio\nhasta convertirte en jefe del pueblo."
	help.add_theme_font_size_override("font_size", 13)
	help.add_theme_color_override("font_color", Color(0.8, 0.75, 0.65))
	box.add_child(help)


func _button(parent: Node, text: String, cb: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size.y = 40
	b.pressed.connect(cb)
	parent.add_child(b)


func _on_new() -> void:
	var n := name_edit.text.strip_edges()
	var d := dyn_edit.text.strip_edges()
	GS.new_game(n if n != "" else "Rodrigo", d if d != "" else "de Vallehondo", gender.selected == 0)
	GS.save_game()
	main.start_village()


func _on_continue() -> void:
	if GS.load_game():
		main.start_village()
