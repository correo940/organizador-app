extends Node3D
## Base de escenas con HUD: barra superior, registro, aviso de interacción y paneles de opciones.
## La usan el mapa de la región y la visita a pueblos (los paneles de court_ui.gd llaman a estos métodos).

const Art = preload("res://scripts/art.gd")

var main
var help_text := ""
var lbl_top: Label
var lbl_prompt: Label
var lbl_log: Label
var panel: PanelContainer
var box: VBoxContainer
var panel_extra: Control = null  # algo que mostrar bajo el título del próximo panel (escudos, caras)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var top := PanelContainer.new()
	top.add_theme_stylebox_override("panel", Art.bar_style())
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	layer.add_child(top)
	lbl_top = Label.new()
	lbl_top.add_theme_font_size_override("font_size", 17)
	top.add_child(lbl_top)
	var logp := PanelContainer.new()
	logp.add_theme_stylebox_override("panel", Art.bar_style())
	logp.grow_vertical = Control.GROW_DIRECTION_BEGIN
	logp.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	logp.offset_bottom = -8
	logp.offset_left = 8
	layer.add_child(logp)
	lbl_log = Label.new()
	lbl_log.add_theme_font_size_override("font_size", 14)
	lbl_log.custom_minimum_size.x = 560
	lbl_log.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	logp.add_child(lbl_log)
	lbl_prompt = Label.new()
	lbl_prompt.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	lbl_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	lbl_prompt.offset_top = -200
	lbl_prompt.offset_bottom = -170
	lbl_prompt.add_theme_font_size_override("font_size", 22)
	lbl_prompt.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl_prompt.add_theme_constant_override("outline_size", 6)
	layer.add_child(lbl_prompt)
	var help := Label.new()
	help.text = help_text
	help.add_theme_font_size_override("font_size", 13)
	help.add_theme_color_override("font_outline_color", Color.BLACK)
	help.add_theme_constant_override("outline_size", 4)
	help.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	help.grow_vertical = Control.GROW_DIRECTION_BEGIN
	help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	help.offset_right = -10
	help.offset_bottom = -8
	layer.add_child(help)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)
	panel = PanelContainer.new()
	panel.theme = Art.parchment_theme()
	panel.visible = false
	center.add_child(panel)
	box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)


func _refresh_log() -> void:
	if lbl_log:
		var l: Array = GS.data["log"]
		lbl_log.text = "\n".join(l.slice(maxi(0, l.size() - 4)))


func _open_panel(title: String, text: String, options: Array) -> void:
	for c in box.get_children():
		c.queue_free()
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Art.TITLE)
	box.add_child(t)
	if panel_extra != null:
		box.add_child(panel_extra)
		panel_extra = null
	var pic := Art.event_picture(title)
	if pic != "":
		box.add_child(Art.picture(pic))
	elif title == "El obispo":
		box.add_child(Art.portrait_row([["res://assets/ui/retrato_obispo.png", "El obispo"]]))
	box.add_child(Art.panel_text(text, 580))
	var first: Button = Art.panel_buttons(box, options)
	panel.visible = true
	if first:
		first.grab_focus.call_deferred()


func _open_custom(title: String, content: Control) -> void:
	for c in box.get_children():
		c.queue_free()
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Art.TITLE)
	box.add_child(t)
	box.add_child(content)
	var close := Button.new()
	close.text = "Cerrar"
	close.custom_minimum_size.y = 34
	close.pressed.connect(_close_panel)
	box.add_child(close)
	panel.visible = true


func _close_panel() -> void:
	panel.visible = false


func _say(text: String) -> void:
	_open_panel("Aviso", text, [["Continuar", _close_panel]])
