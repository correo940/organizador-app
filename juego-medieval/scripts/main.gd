extends Node

var current: Node


func _ready() -> void:
	show_menu()


func _switch(n: Node) -> void:
	if current:
		current.queue_free()
	current = n
	n.set("main", self)
	add_child(n)


func show_menu() -> void:
	_switch(preload("res://scripts/menu.gd").new())


func start_village() -> void:
	_switch(preload("res://scripts/village.gd").new())


func start_region() -> void:
	_switch(preload("res://scripts/region.gd").new())


func start_battle() -> void:
	_switch(preload("res://scripts/battle.gd").new())
