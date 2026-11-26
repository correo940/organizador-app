extends Node3D
## Cámara en tercera persona que sigue a un objetivo.
## Aldea: girar con clic derecho arrastrando. Batalla: ratón capturado.

var target: Node3D
var yaw := PI
var pitch := -0.3
var dist := 5.0
var captured := false
var cam: Camera3D
## Modo estrategia (pueblo): la cámara vuela libre sobre el terreno; se mueve con WASD/flechas o
## llevando el ratón al borde, gira con Q/R o arrastrando con la rueda pulsada y acerca con la rueda.
var rts := false
var focus := Vector3.ZERO
var follow := false
var limits := Rect2(-60, -70, 280, 245)


func _ready() -> void:
	cam = Camera3D.new()
	cam.fov = 60
	add_child(cam)
	cam.make_current()
	if target:
		global_position = target.global_position + Vector3(0, 1.6, 0)


func _unhandled_input(ev: InputEvent) -> void:
	if rts:
		if ev is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
			yaw -= ev.relative.x * 0.005 * float(SFX.settings["sens"])
		elif ev is InputEventMouseButton and ev.pressed:
			if ev.button_index == MOUSE_BUTTON_WHEEL_UP:
				dist = maxf(12.0, dist - 3.0)
			elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				dist = minf(90.0, dist + 3.0)
		return
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
	if rts:
		var mv := Vector2(float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)), float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)))
		var vp := get_viewport()
		var m := vp.get_mouse_position()
		var sz := vp.get_visible_rect().size
		if DisplayServer.window_is_focused() and Rect2(Vector2.ZERO, sz).has_point(m):
			if m.x < 6: mv.x = -1
			elif m.x > sz.x - 6: mv.x = 1
			if m.y < 6: mv.y = -1
			elif m.y > sz.y - 6: mv.y = 1
		if Input.is_key_pressed(KEY_Q):
			yaw += delta * 1.6
		if Input.is_key_pressed(KEY_R):
			yaw -= delta * 1.6
		if mv != Vector2.ZERO:
			follow = false
			var fwd := Vector3(sin(yaw), 0, cos(yaw))
			var right := Vector3(cos(yaw), 0, -sin(yaw))
			focus += (right * mv.x + fwd * mv.y).normalized() * delta * (18.0 + dist * 0.6)
		elif follow and target:
			focus = focus.lerp(target.global_position, minf(1.0, delta * 5.0))
		focus.x = clampf(focus.x, limits.position.x, limits.end.x)
		focus.z = clampf(focus.z, limits.position.y, limits.end.y)
		pitch = lerpf(-0.75, -1.05, clampf((dist - 12.0) / 70.0, 0.0, 1.0))
		global_position = focus
		rotation = Vector3(pitch, yaw, 0)
		cam.position = Vector3(0, 0, dist)
		return
	if target:
		global_position = global_position.lerp(target.global_position + Vector3(0, 1.6, 0), minf(1.0, delta * 10.0))
	rotation = Vector3(pitch, yaw, 0)
	cam.position = Vector3(0.4, 0, dist)


## Dirección de movimiento en el plano a partir de WASD, relativa a la cámara.
## Punto del suelo bajo el ratón (plano y = 0).
func ground_at(screen: Vector2) -> Variant:
	var o := cam.project_ray_origin(screen)
	var d := cam.project_ray_normal(screen)
	if absf(d.y) < 0.001:
		return null
	var t := -o.y / d.y
	return o + d * t if t > 0 else null


func move_dir() -> Vector3:
	if rts:
		return Vector3.ZERO
	var x := float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	var z := float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP))
	if x == 0 and z == 0:
		return Vector3.ZERO
	var fwd := Vector3(sin(yaw), 0, cos(yaw))
	var right := Vector3(cos(yaw), 0, -sin(yaw))
	return (right * x + fwd * z).normalized()
