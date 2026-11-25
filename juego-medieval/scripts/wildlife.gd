extends Node3D
## Peligros del bosque: manadas de lobos (más de noche y en invierno) que atacan al jugador
## y al ganado del corral, y bandidos que acampan junto al bosque y roban si no se les echa.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const FOREST := Rect2(5, 5, 26, 40)
const CORRAL := Vector3(43.5, 0, 23.5)
const CAMP := Vector3(17, 0, 24)
const PREY := ["gallina", "oveja", "cerdo", "vaca"]

var v
var wolves: Array = []
var spawn_cd := 30.0
var bandit_nodes: Array = []
var bandit_sig := ""
var last_day := -1


var boars: Array = []


func _ready() -> void:
	last_day = int(GS.data["total_days"])
	for k in 2:
		_spawn_boar()


## Jabalíes: caza mayor del bosque (embisten si los atacas).
func _spawn_boar() -> void:
	var b := M.inst("animals/Pig.fbx")
	var bb := M.aabb_of(b)
	b.scale = Vector3.ONE * (1.4 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
	M.recolor_coat(b, Color(0.35, 0.25, 0.18))
	add_child(b)
	b.position = Vector3(randf_range(FOREST.position.x, FOREST.end.x), 0, randf_range(FOREST.position.y, FOREST.end.y))
	boars.append({"n": b, "hp": 3, "t": b.position, "dead": false, "timer": 0.0})


func _update_boars(delta: float) -> void:
	for b in boars:
		var n: Node3D = b["n"]
		if b["dead"]:
			b["timer"] -= delta * GS.speed
			if b["timer"] <= 0:
				n.position = Vector3(randf_range(FOREST.position.x, FOREST.end.x), 0, randf_range(FOREST.position.y, FOREST.end.y))
				n.visible = true
				b["dead"] = false
				b["hp"] = 3
			continue
		var to: Vector3 = b["t"] - n.position
		to.y = 0
		if to.length() < 0.5:
			if randf() < 0.01:
				b["t"] = Vector3(randf_range(FOREST.position.x, FOREST.end.x), 0, randf_range(FOREST.position.y, FOREST.end.y))
		else:
			n.position += to.normalized() * 1.3 * delta
			n.rotation.y = atan2(to.x, to.z)


func _process(delta: float) -> void:
	var d = GS.data
	var t: float = d["time"]
	var night := t < 0.22 or t > 0.85
	var winter := int(d["season"]) == 3
	spawn_cd -= delta * GS.speed
	if spawn_cd <= 0:
		spawn_cd = randf_range(40.0, 80.0)
		var alive := wolves.filter(func(w): return w["state"] != "dead").size()
		if alive == 0 and randf() < 0.1 + (0.4 if night else 0.0) + (0.25 if winter else 0.0):
			_spawn_pack(randi_range(1, 3 if winter else 2))
	_update_wolves(delta, night)
	_update_boars(delta)
	if int(d["total_days"]) != last_day:
		last_day = int(d["total_days"])
		_daily_bandits()
	var sig := str(d.get("bandits", null))
	if sig != bandit_sig:
		bandit_sig = sig
		_rebuild_bandits()


# ---------------- Lobos ----------------

func _spawn_pack(n: int) -> void:
	var c := Vector3(randf_range(FOREST.position.x, FOREST.end.x), 0, randf_range(FOREST.position.y, FOREST.end.y))
	for i in n:
		var w := M.inst("animals/Wolf.glb")
		var bb := M.aabb_of(w)
		w.scale = Vector3.ONE * (1.5 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z)))
		add_child(w)
		w.position = c + Vector3(randf_range(-2, 2), 0, randf_range(-2, 2))
		var ap: AnimationPlayer = w.find_child("AnimationPlayer", true, false)
		for a in ["Idle", "Walk", "Gallop"]:
			ap.get_animation("AnimalArmature|" + a).loop_mode = Animation.LOOP_LINEAR
		wolves.append({"n": w, "ap": ap, "hp": 3, "state": "roam", "t": w.position, "cd": 0.0, "timer": 0.0, "life": 1.5 * GS.SECONDS_PER_DAY})
	GS.say("Se oyen aullidos en el bosque: hay lobos cerca.")


func _anim(w: Dictionary, a: String) -> void:
	var full := "AnimalArmature|" + a
	if w["ap"].current_animation != full:
		w["ap"].play(full, 0.2)


func _update_wolves(delta: float, night: bool) -> void:
	var pl = v.player
	var health: float = GS.data["player"]["health"]
	for i in range(wolves.size() - 1, -1, -1):
		var w: Dictionary = wolves[i]
		var n: Node3D = w["n"]
		w["cd"] -= delta
		w["life"] -= delta * GS.speed
		if w["state"] == "dead":
			w["timer"] -= delta * GS.speed
			if w["timer"] <= 0:
				n.queue_free()
				wolves.remove_at(i)
			continue
		var to_pl: Vector3 = pl.position - n.position
		to_pl.y = 0
		if w["state"] == "flee" or w["life"] <= 0:
			var away := Vector3(FOREST.position.x - 10, 0, n.position.z) - n.position
			_run(w, away, 7.0, delta, "Gallop")
			if n.position.x < FOREST.position.x - 5:
				n.queue_free()
				wolves.remove_at(i)
			continue
		if to_pl.length() < 14.0 and health > 15.0:
			if w["state"] != "chase":
				w["cd"] = 1.0
			w["state"] = "chase"
		elif w["state"] == "chase":
			w["state"] = "roam"
		if w["state"] == "chase":
			if to_pl.length() > 1.5:
				_run(w, to_pl, 6.0, delta, "Gallop")
			else:
				n.rotation.y = atan2(to_pl.x, to_pl.z)
				if w["cd"] <= 0:
					w["cd"] = randf_range(1.8, 2.6)
					w["ap"].play("AnimalArmature|Attack", 0.1)
					var dmg := randf_range(3.0, 5.0) * (1.0 - 0.2 * int(GS.data["armor"]))
					GS.data["player"]["health"] = maxf(1.0, float(GS.data["player"]["health"]) - dmg)
					pl.play_once("Hit_Chest")
					SFX.play("golpe", -4.0, 0.2)
					v._float("-%d salud (mordisco de lobo)" % int(dmg), Color(1, 0.4, 0.35))
					if float(GS.data["player"]["health"]) <= 15.0:
						for o in wolves:
							if o["state"] != "dead":
								o["state"] = "flee"
						GS.say("Malherido, consigues espantar a los lobos. Necesitas descansar.")
			continue
		# De noche, alguno se acerca al corral a por el ganado.
		if night and _has_prey():
			var to_c: Vector3 = CORRAL - n.position
			to_c.y = 0
			if to_c.length() > 3.5:
				_run(w, to_c, 3.2, delta, "Walk")
			else:
				_anim(w, "Idle")
				w["timer"] += delta * GS.speed
				if w["timer"] > 6.0:
					_take_prey()
					w["state"] = "flee"
			continue
		var to: Vector3 = w["t"] - n.position
		to.y = 0
		if to.length() < 0.5:
			_anim(w, "Idle")
			if randf() < 0.01:
				w["t"] = Vector3(randf_range(FOREST.position.x, FOREST.end.x), 0, randf_range(FOREST.position.y, FOREST.end.y))
		else:
			_run(w, to, 1.6, delta, "Walk")


func _run(w: Dictionary, dir: Vector3, speed: float, delta: float, anim: String) -> void:
	var n: Node3D = w["n"]
	if w["ap"].current_animation == "AnimalArmature|Attack" and w["ap"].is_playing():
		return
	n.position += dir.normalized() * minf(dir.length(), speed * delta)
	n.rotation.y = lerp_angle(n.rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 8.0))
	_anim(w, anim)


func _has_prey() -> bool:
	return PREY.any(func(k): return int(GS.data["animals"][k]) > 0)


func _take_prey() -> void:
	for k in PREY:
		if int(GS.data["animals"][k]) > 0:
			GS.data["animals"][k] = int(GS.data["animals"][k]) - 1
			GS.say("Un lobo se ha llevado una %s del corral." % {"gallina": "gallina", "oveja": "oveja", "cerdo": "cría de cerdo", "vaca": "ternera"}[k])
			return


# ---------------- Bandidos ----------------

func _daily_bandits() -> void:
	var d = GS.data
	var b = d.get("bandits", null)
	if b == null:
		if int(d["total_days"]) > 10 and randf() < 0.04:
			d["bandits"] = {"n": randi_range(3, 4 + int(d["tier"]) * 3), "until": int(d["total_days"]) + 3}
			GS.say("¡Unos bandidos han acampado junto al bosque! Si no los echas, robarán en el pueblo.")
		return
	if int(d["total_days"]) >= int(b["until"]):
		var gold := mini(int(d["gold"]), 15 + 5 * int(b["n"]))
		d["gold"] = int(d["gold"]) - gold
		var food := 0
		for k in ["pan", "carne", "queso", "trigo"]:
			var take := mini(GS.res(k), 4)
			GS.res_add(k, -take)
			food += take
		d.erase("bandits")
		GS.say("Los bandidos saquean el pueblo de noche: se llevan %d de oro y %d de comida, y huyen." % [gold, food])


func _rebuild_bandits() -> void:
	for a in bandit_nodes:
		a.queue_free()
	bandit_nodes.clear()
	var b = GS.data.get("bandits", null)
	if b == null:
		return
	var fire := M.put(self, "village/Bonfire_Lit.glb", CAMP, 0.0, 1.0)
	bandit_nodes.append(fire)
	for i in mini(int(b["n"]), 6):
		var a := ACTOR.new()
		add_child(a)
		a.build(["ubc/Superhero_Male_FullBody", "out/Male_Ranger"], {"faction": "bandido", "hide_hood": false, "sword": true})
		var ang := float(i) / mini(int(b["n"]), 6) * TAU
		a.position = CAMP + Vector3(cos(ang), 0, sin(ang)) * 2.4
		a.rotation.y = atan2(-cos(ang), -sin(ang))
		a.play("Sitting_Idle" if i % 2 == 0 else "Idle")
		bandit_nodes.append(a)


# ---------------- Interacción ----------------

func find_interaction(pp: Vector3) -> Dictionary:
	for i in boars.size():
		if not boars[i]["dead"] and pp.distance_to(boars[i]["n"].position) < 2.6:
			return {"type": "boar", "i": i, "label": "Cazar el jabalí"}
	var d = GS.data
	if d.get("falcon", false) and FOREST.grow(6).has_point(Vector2(pp.x, pp.z)) and int(d.get("falcon_day", -1)) != int(d["total_days"]):
		return {"type": "falcon", "label": "Soltar el halcón (cetrería)"}
	for i in wolves.size():
		if wolves[i]["state"] != "dead" and pp.distance_to(wolves[i]["n"].position) < 2.8:
			return {"type": "wolf", "i": i, "label": "Luchar contra el lobo"}
	var b = GS.data.get("bandits", null)
	if b != null and pp.distance_to(CAMP) < 8.0:
		return {"type": "bandits", "label": "Enfrentarte a los bandidos (%d)" % int(b["n"])}
	return {}


func interact(it: Dictionary) -> void:
	var dd = GS.data
	if it["type"] == "falcon":
		dd["falcon_day"] = int(dd["total_days"])
		GS.add("carne", 2)
		dd["prestige"] += 1
		v.player.play_once("Interact")
		v._float("Tu halcón vuelve con dos conejos. (+2 carne, +1 prestigio)", Color(1, 0.9, 0.6))
		return
	if it["type"] == "boar":
		var b: Dictionary = boars[it["i"]]
		v.player.play_once("Sword_Attack" if int(dd["weapon"]) >= 1 else "Punch_Cross")
		SFX.play("espada", -3.0, 0.1)
		b["hp"] -= 2 if int(dd["weapon"]) >= 1 else 1
		if b["hp"] <= 0:
			b["dead"] = true
			b["timer"] = GS.SECONDS_PER_DAY * 2
			b["n"].visible = false
			GS.add("carne", 6)
			GS.add("cuero", 2)
			dd["prestige"] += 2
			v._float("¡Jabalí abatido! +6 carne, +2 cuero, +2 prestigio", Color(1, 0.85, 0.5))
		else:
			var dmg := randf_range(5.0, 10.0) * (1.0 - 0.2 * int(dd["armor"]))
			dd["player"]["health"] = maxf(1.0, float(dd["player"]["health"]) - dmg)
			v.player.play_once("Hit_Chest")
			v._float("¡El jabalí embiste! -%d salud" % int(dmg), Color(1, 0.4, 0.35))
		return
	if it["type"] == "bandits":
		var d = GS.data
		d["battle"] = {"kind": "bandidos", "enemy": "unos bandidos", "troops": int(d["bandits"]["n"]) + 1, "wall": 0}
		GS.save_game()
		v.main.start_battle()
		return
	var w: Dictionary = wolves[it["i"]]
	if v.player.is_playing_once():
		return
	v.player.play_once("Sword_Attack" if int(GS.data["weapon"]) >= 1 else "Punch_Cross")
	SFX.play("espada", -3.0, 0.1)
	w["hp"] -= 2 if int(GS.data["weapon"]) >= 1 else 1
	if w["hp"] <= 0:
		w["state"] = "dead"
		w["timer"] = GS.SECONDS_PER_DAY
		w["ap"].play("AnimalArmature|Death", 0.1)
		GS.add("cuero", 1)
		GS.data["prestige"] += 1
		v._float("Lobo abatido: +1 cuero, +1 prestigio", Color(1, 0.85, 0.5))
	else:
		w["ap"].play("AnimalArmature|Idle_HitReact_Left", 0.1)
		v._float("¡Golpe!", Color(1, 0.9, 0.7))
