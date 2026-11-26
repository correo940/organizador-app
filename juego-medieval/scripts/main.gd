extends Node

var current: Node


func _ready() -> void:
	show_menu()


func _switch(n: Node) -> void:
	# Pantalla de carga pintada al cambiar de escena (el mapa al salir a la región).
	if current and not n is Control:
		_curtain("res://assets/ui/mapa_pintado.jpg" if n.get_script() == preload("res://scripts/region.gd") else "res://assets/ui/carga_rey.jpg")
	if current:
		current.queue_free()
	current = n
	n.set("main", self)
	add_child(n)


var _veil: CanvasLayer
func _curtain(path: String) -> void:
	if is_instance_valid(_veil):
		_veil.queue_free()
	_veil = CanvasLayer.new()
	_veil.layer = 50
	add_child(_veil)
	var bg := ColorRect.new()
	bg.color = Color(0.08, 0.06, 0.04)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_veil.add_child(bg)
	var tr := TextureRect.new()
	tr.texture = load(path)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.add_child(tr)
	var tw := create_tween()
	tw.tween_interval(0.9)
	tw.tween_property(bg, "modulate:a", 0.0, 0.6)
	var v := _veil
	tw.tween_callback(func(): if is_instance_valid(v): v.queue_free())


func show_menu() -> void:
	_switch(preload("res://scripts/menu.gd").new())


func start_village() -> void:
	_switch(preload("res://scripts/village.gd").new())


func start_region() -> void:
	_switch(preload("res://scripts/region.gd").new())


func start_house() -> void:
	_switch(preload("res://scripts/house_interior.gd").new())


func start_visit() -> void:
	_switch(preload("res://scripts/town_visit.gd").new())


func start_battle() -> void:
	_switch(preload("res://scripts/battle.gd").new())
