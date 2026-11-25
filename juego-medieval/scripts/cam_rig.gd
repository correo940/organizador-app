extends Node3D
## Cámara en tercera persona que sigue a un objetivo.
## Aldea: girar con clic derecho arrastrando. Batalla: ratón capturado.

var target: Node3D
var yaw := PI
var pitch := -0.3
var dist := 5.0
var captured := false
var cam: Camera3D


func _ready() -> void:
	cam = Camera3D.new()
	cam.fov = 60
	add_child(cam)
	cam.make_current()
	if target:
		global_position = target.global_position + Vector3(0, 1.6, 0)


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseMotion and (captured or Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT) and not captured):
		var k: float = SFX.settings["sens"]
		yaw -= ev.relative.x * 0.005 * k
		pitch = clampf(pitch - ev.relative.y * 0.004 * k, -1.2, 0.25)
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist = maxf(2.5, dist - 0.4)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist = minf(16.0, dist + 0.4)


func _process(delta: float) -> void:
	if target:
		global_position = global_position.lerp(target.global_position + Vector3(0, 1.6, 0), minf(1.0, delta * 10.0))
	rotation = Vector3(pitch, yaw, 0)
	cam.position = Vector3(0.4, 0, dist)


## Dirección de movimiento en el plano a partir de WASD, relativa a la cámara.
func move_dir() -> Vector3:
	var x := float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	var z := float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP))
	if x == 0 and z == 0:
		return Vector3.ZERO
	var fwd := Vector3(sin(yaw), 0, cos(yaw))
	var right := Vector3(cos(yaw), 0, -sin(yaw))
	return (right * x + fwd * z).normalized()
