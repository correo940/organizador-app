extends "res://scripts/panel_scene.gd"
## Mapa de la región: viajas con tu ejército entre pueblos, atacas, fundas aldeas y gobiernas las tuyas.

const M := preload("res://scripts/models.gd")
const ACTOR := preload("res://scripts/actor.gd")
const R := preload("res://scripts/region_sim.gd")
const ARMY := preload("res://scripts/army.gd")
const N := preload("res://scripts/nobles.gd")
const COURT := preload("res://scripts/court_ui.gd")
const SPEED := 14.0
const HOUSES := ["village/House_1.glb", "village/House_2.glb", "village/House_3.glb", "village/House_4.glb"]

var env: Dictionary
var cam: Camera3D
var zoom := 0.8
var party
var target: Vector3
var towns_node: Node3D
var towns_sig := ""
var moving_node: Node3D
var moving_sig := ""
var last_day := -1
var inter := {}


func _ready() -> void:
	var d = GS.data
	env = M.make_env(self, Vector3(R.size() / 2, 0, R.size() / 2), R.size() * 3)
	M.set_season_ground(env["grad"], int(d["season"]))
	M.set_daytime(env, _map_time())
	var e: Environment = env["env"]
	e.fog_density = 0.0015
	var sun: DirectionalLight3D = env["sun"]
	sun.directional_shadow_max_distance = 150
	var suffix: String = ["", "", "_Autumn", "_Snow"][int(d["season"])]
	var r := RandomNumberGenerator.new()
	r.seed = 99
	var reg := R.region()
	for i in int(260 * pow(R.size() / 300.0, 2)):
		var p := Vector3(r.randf_range(0, R.size()), 0, r.randf_range(0, R.size()))
		if reg["sites"].any(func(s): return Vector2(s[0], s[1]).distance_to(Vector2(p.x, p.z)) < 20) or Vector2(p.x, p.z).distance_to(R.home()) < 24:
			continue
		M.put(self, "nature/%s%s_%d.glb" % [["CommonTree", "PineTree", "BirchTree"][i % 3], suffix, r.randi_range(1, 5)], p, r.randf() * TAU, r.randf_range(2.6, 3.6))
	for i in 28:
		var a := float(i) / 28.0 * TAU
		var p := Vector3(R.size() / 2, -4, R.size() / 2) + Vector3(cos(a), 0, sin(a)) * r.randf_range(R.size() * 0.72, R.size() * 0.8)
		M.recolor(M.put(self, "nature/Rock_%d.glb" % (1 + i % 7), p, r.randf() * TAU, r.randf_range(20, 32)), Color(0.42, 0.44, 0.4))
	towns_node = Node3D.new()
	add_child(towns_node)
	moving_node = Node3D.new()
	add_child(moving_node)
	party = ACTOR.new()
	add_child(party)
	var helm := "Helmet2" if int(d["armor"]) >= 2 else ""
	party.build(["ubc/Superhero_Male_FullBody" if d["player"]["male"] else "ubc/Superhero_Female_FullBody", "out/Male_Ranger" if d["player"]["male"] else "out/Female_Ranger"], {"faction": "azul", "hide_hood": true, "sword": true, "shield": true, "helmet": helm})
	party.scale = Vector3.ONE * 3.5
	if d.get("horse", false):
		party.mount(Color(1.3, 0.9, 0.7))
	M.recolor(M.put(party, "castle/Banner.glb", Vector3(0.8, 0, -0.5), 0.0, 1.0), Color(0.15, 0.3, 0.7))
	party.position = Vector3(reg["party"][0], 0, reg["party"][1])
	target = party.position
	cam = Camera3D.new()
	cam.fov = 50
	add_child(cam)
	cam.make_current()
	help_text = "Clic izquierdo: marchar · Rueda: zoom · E: entrar / interactuar · D: diplomacia · Esc: menú"
	_build_hud()
	SFX.music("mapa")
	GS.notify.connect(func(_t): _refresh_log())
	_refresh_log()


# ---------------- Dibujo de los pueblos ----------------

func _rebuild_towns() -> void:
	for c in towns_node.get_children():
		c.queue_free()
	var reg := R.region()
	for t in reg["towns"]:
		var p := Vector3(t["x"], 0, t["z"])
		var tier := int(GS.data["tier"]) if t.get("home", false) else R.tier_of(int(t["pop"]))
		var n: int = [4, 7, 11][tier]
		var r := RandomNumberGenerator.new()
		r.seed = int(t["id"]) * 31 + 7
		for k in n:
			var a := r.randf() * TAU
			var dist := r.randf_range(4.0, 7.0 + tier * 4.0)
			M.put(towns_node, HOUSES[k % 4], p + Vector3(cos(a), 0, sin(a)) * dist, r.randf() * TAU, 1.3)
		var wall: int = int(GS.data["tier"]) if t.get("home", false) else int(t["wall"])
		if wall >= 2:
			M.castle(towns_node, p + Vector3(0, 0, -3), 1.8)
		elif wall == 1:
			for k in 14:
				var a := float(k) / 14.0 * TAU
				M.put(towns_node, "village/Fence.glb", p + Vector3(cos(a), 0, sin(a)) * (12.0 + tier * 4), -a, 1.8)
		var col := Color(0.15, 0.3, 0.7)
		if t["owner"] == "señor":
			var c: Array = reg["lords"][int(t["lord"])]["color"]
			col = Color(c[0], c[1], c[2])
		M.recolor(M.put(towns_node, "castle/Banner.glb", p + Vector3(3, 0, 3), 0.0, 3.0), col)
		var txt := "%s · %s\n%s · %d hab." % [t["name"], R.tier_name(tier), R.owner_text(t), R.pop_of(t)]
		if not t.get("home", false):
			txt += " · %d soldados" % (int(t["garrison"]) if t["owner"] == "jugador" else int(t["troops"]))
		var l := _map_label(txt, 22)
		l.position = p + Vector3(0, 9, 0)
		l.modulate = col.lightened(0.5)
		towns_node.add_child(l)
	for si in R.free_sites():
		var s = reg["sites"][si]
		var p := Vector3(s[0], 0, s[1])
		M.put(towns_node, "village/Package_1.glb", p, 0.0, 2.5)
		var reserved := Vector2(s[0], s[1]).distance_to(R.home()) <= R.RESERVED_R
		var l := _map_label("Lugar libre (reservado para ti)" if reserved else "Lugar libre", 24)
		if reserved:
			l.modulate = Color(0.7, 0.85, 1.0)
		l.position = p + Vector3(0, 5, 0)
		towns_node.add_child(l)


## Rótulo del mapa con tamaño fijo en pantalla, legible a cualquier zoom.
func _map_label(text: String, size: int) -> Label3D:
	var l := M.label3d(text, size)
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.outline_size = 8
	return l


# ---------------- Bucle ----------------

func _process(delta: float) -> void:
	var d = GS.data
	var ms := str(R.region()["armies"]) + str(R.region()["caravans"])
	if ms != moving_sig:
		moving_sig = ms
		_rebuild_moving()
	if int(d["total_days"]) != last_day:
		last_day = int(d["total_days"])
		_check_ambush()
	var ts := str(R.region()["towns"]) + str(d["tier"]) + str(R.free_sites()) + str(R.region()["events"])
	if ts != towns_sig:
		towns_sig = ts
		_rebuild_towns()
	if not panel.visible and not GS.popups.is_empty():
		var pp: Dictionary = GS.popups.pop_front()
		if d.get("game_over", false):
			_open_panel(pp["title"], pp["text"], [["Volver al menú", func(): main.show_menu()]])
		elif pp.has("options"):
			_open_panel(pp["title"], pp["text"], pp["options"].map(func(o): return [o[0], func():
				_close_panel()
				o[1].call()]))
		else:
			_open_panel(pp["title"], pp["text"], [[pp.get("button", "Continuar"), _close_panel]])
	if not panel.visible and not d.get("game_over", false):
		var to: Vector3 = target - party.position
		to.y = 0
		if to.length() > 0.5:
			var fast := 1.6 if d.get("horse", false) else 1.0
			var step := minf(to.length(), SPEED * fast * delta)
			party.position += to.normalized() * step
			party.rotation.y = lerp_angle(party.rotation.y, atan2(to.x, to.z), minf(1.0, delta * 8.0))
			party.play("Walk")
			var reg := R.region()
			reg["walked"] = float(reg["walked"]) + step / fast
			if float(reg["walked"]) >= R.DAY_DIST:
				reg["walked"] = float(reg["walked"]) - R.DAY_DIST
				GS.next_day()
		else:
			party.play("Idle")
		R.region()["party"] = [party.position.x, party.position.z]
		inter = _find_interaction()
	var tday := _map_time()
	M.set_daytime(env, tday)
	M.moonlight(env, 0.4)
	_town_lights(tday)
	SFX.ambient("viento", -22.0)
	var want: Vector3 = party.position + Vector3(0, 55, 42) * zoom
	cam.position = cam.position.lerp(want, minf(1.0, delta * 6.0)) if cam.position != Vector3.ZERO else want
	cam.look_at(party.position + Vector3(0, 2, 0), Vector3.UP)
	lbl_top.text = "   %s · %s, día %d, año %d      Oro: %d      Tu ejército: %d soldados      %s: %d hab." % [d["player"]["name"], GS.SEASONS[int(d["season"])], int(d["day"]), int(d["year"]), int(d["gold"]), ARMY.total(), GS.SIM.town_title(), GS.SIM.total_pop()]
	lbl_prompt.text = "" if panel.visible or inter.is_empty() else "[E] " + inter["label"]


func _find_interaction() -> Dictionary:
	var pp := Vector2(party.position.x, party.position.z)
	for a in R.region()["armies"]:
		if pp.distance_to(Vector2(a["x"], a["z"])) < 14.0:
			var li: int = a["lord"]
			var lbl := ("Atacar al ejército de %s (%d soldados)" if N.at_war(-1, li) else "Ejército de %s (%d soldados)") % [N.full(N.lord(li)), int(a["troops"])]
			return {"type": "army", "id": int(a["id"]), "label": lbl}
	for t in R.region()["towns"]:
		if pp.distance_to(Vector2(t["x"], t["z"])) < 16.0:
			return {"type": "town", "id": int(t["id"]), "label": ("Entrar en " if t.get("home", false) else "") + t["name"]}
	for si in R.free_sites():
		var s = R.region()["sites"][si]
		if pp.distance_to(Vector2(s[0], s[1])) < 8.0:
			return {"type": "site", "i": si, "label": "Lugar libre: fundar una aldea"}
	return {}


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom = maxf(0.4, zoom - 0.1)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom = minf(2.5, zoom + 0.1)
		elif ev.button_index == MOUSE_BUTTON_LEFT and not panel.visible:
			var from := cam.project_ray_origin(ev.position)
			var dir := cam.project_ray_normal(ev.position)
			var hit = Plane(Vector3.UP, 0).intersects_ray(from, dir)
			if hit != null:
				target = Vector3(clampf(hit.x, 5, R.size() - 5), 0, clampf(hit.z, 5, R.size() - 5))
	elif ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_E:
				if not panel.visible:
					_interact()
			KEY_D:
				if not panel.visible:
					COURT.diplomacy(self)
			KEY_ESCAPE:
				if panel.visible:
					_close_panel()
				else:
					_open_panel("Pausa", "", [["Continuar", _close_panel], ["Guardar partida", func():
						GS.save_game()
						_close_panel()], ["Opciones", func():
						_close_panel()
						preload("res://scripts/options.gd").open(self)], ["Guardar y volver al menú", func():
						GS.save_game()
						main.show_menu()]])


func _interact() -> void:
	match inter.get("type", ""):
		"town":
			_town_panel(inter["id"])
		"site":
			_site_panel(inter["i"])
		"army":
			_army_panel(inter["id"])


func _site_panel(si: int) -> void:
	var d = GS.data
	var text := "Un buen lugar para levantar una aldea nueva.\n\nNecesitas ser jefe, %d colonos de tu pueblo llano (tienes %d) y %s." % [R.SETTLERS, int(d["commons"]), GS.cost_text(R.FOUND_COST)]
	_open_panel("Lugar libre", text, [
		["Fundar una aldea aquí", func():
			var err := R.found_village(si)
			if err != "":
				_say(err)
			else:
				_close_panel(), true],
		["Cerrar", _close_panel]])


func _town_panel(id: int) -> void:
	var d = GS.data
	var t := R.town(id)
	if t.get("home", false):
		_open_panel(t["name"], "Tu pueblo. %s con %d habitantes." % [GS.SIM.town_title(), GS.SIM.total_pop()], [
			["Entrar en %s" % t["name"], func():
				GS.save_game()
				main.start_village()],
			["Enviar una caravana comercial", func(): GS.ECON.caravan_panel(self, id)],
			["Cerrar", _close_panel]])
		return
	var tier := R.tier_of(int(t["pop"]))
	var walls: String = ["sin defensas", "empalizada", "murallas de piedra"][int(t["wall"])]
	if t["owner"] == "jugador":
		var gov := R.governor_of(id)
		var text := "%s tuya · %d habitantes · %s · guarnición de %d soldados.\nTe rinde unos %.1f de oro al día.\n%s" % [R.tier_name(tier), int(t["pop"]), walls, int(t["garrison"]), int(t["pop"]) / 40.0 * R.governor_mult(id) * GS.ECON.tax_mult(t), ("Lo gobierna %s, de tu familia (+%d%% de rentas)." % [gov, int(round((R.governor_mult(id) - 1.0) * 100))]) if gov != "" else "Sin gobernador: nombra a un hijo adulto desde tu casa (Ver familia) y rentará un 50% más."] + GS.ECON.town_text(t)
		_open_panel(t["name"], text, [
			["Levantar empalizada (40 madera)", func():
				GS.pay({"madera": 40})
				t["wall"] = 1
				_town_panel(id), int(t["wall"]) == 0 and GS.res("madera") >= 40],
			["Levantar murallas de piedra (120 piedra, 80 oro)", func():
				GS.pay({"piedra": 120, "oro": 80})
				t["wall"] = 2
				_town_panel(id), int(t["wall"]) == 1 and GS.can_pay({"piedra": 120, "oro": 80})],
			["Instalar una balista en las torres (40 madera, 6 hierro, 30 oro) — tiene %d de 3" % int(t.get("towers", 0)), func():
				GS.pay({"madera": 40, "hierro": 6, "oro": 30})
				t["towers"] = int(t.get("towers", 0)) + 1
				_town_panel(id), int(t["wall"]) >= 1 and int(t.get("towers", 0)) < 3 and GS.can_pay({"madera": 40, "hierro": 6, "oro": 30})],
			["Dejar 5 soldados de guarnición", func():
				var left := 5
				for k in ["milicia", "lancero", "infante", "arquero", "arquero_jinete", "jinete"]:
					var n := mini(left, int(d["army"][k]))
					d["army"][k] = int(d["army"][k]) - n
					left -= n
				t["garrison"] = int(t["garrison"]) + 5 - left
				_town_panel(id), ARMY.total() > 0],
			["Retirar la guarnición (vuelve como milicia)", func():
				d["army"]["milicia"] = int(d["army"]["milicia"]) + int(t["garrison"])
				t["garrison"] = 0
				_town_panel(id), int(t["garrison"]) > 0],
			["Mercado de %s" % t["name"], func(): COURT.market(self, id)],
			["Pasear por %s" % t["name"], func(): _visit(id)],
		] + GS.ECON.town_options(self, t, func(): _town_panel(id)) + [
			["Enviar %d colonos de tu pueblo" % R.SETTLERS, func():
				d["commons"] = int(d["commons"]) - R.SETTLERS
				t["pop"] = int(t["pop"]) + R.SETTLERS
				_town_panel(id), int(d["commons"]) >= R.SETTLERS],
			["Cerrar", _close_panel]])
		return
	var lord = R.region()["lords"][int(t["lord"])]
	var defenders := int(t["troops"])
	var text := "%s de %s · %d habitantes · %s.\nDefensores: unos %d soldados. Relación con su señor: %d/100.%s" % [R.tier_name(tier), lord["name"], int(t["pop"]), walls, defenders, int(lord["rel"]), "\nEs tu vasallo: te paga tributo cada estación." if t["vassal"] else ""]
	var li: int = t["lord"]
	var war := N.at_war(-1, li)
	text += "\n%s está %s." % [N.full(lord), COURT.status_text(li)]
	if not N.tournament_at(id).is_empty():
		text += "\n¡Hay un torneo en este pueblo! Entra en la corte para participar."
	var opts := []
	if not war:
		opts.append(["Mercado de %s" % t["name"], func(): COURT.market(self, id)])
		opts.append(["Corte de %s" % N.full(lord), func(): COURT.court(self, li, id)])
		opts.append(["Pasear por %s" % t["name"], func(): _visit(id)])
	else:
		opts.append(["Negociar con %s" % N.full(lord), func(): COURT.court(self, li, id)])
	if not t["vassal"]:
		opts.append(["Atacar (%d tropas tuyas contra %d)%s" % [ARMY.total(), defenders, "" if war else " — declara la guerra"], func():
			if not N.at_war(-1, li):
				N.declare_war(-1, li)
			d["battle"] = {"kind": "asedio", "town": id, "enemy": "%s (%s)" % [t["name"], lord["name"]], "troops": defenders, "wall": int(t["wall"])}
			GS.save_game()
			main.start_battle()])
	opts.append(["Enviar un regalo (50 oro, mejora la relación)", func():
		d["gold"] = int(d["gold"]) - 50
		lord["rel"] = mini(100, int(lord["rel"]) + 10)
		_town_panel(id), int(d["gold"]) >= 50])
	opts.append(["Cerrar", _close_panel])
	_open_panel(t["name"], text, opts)


## La hora en el mapa sigue a lo que llevas andado: cada jornada es un día completo.
func _map_time() -> float:
	return fmod(0.3 + float(R.region().get("walked", 0.0)) / R.DAY_DIST, 1.0)


## De noche se encienden luces en los pueblos cercanos.
var lights_node: Node3D
var lights_cd := 0.0
func _town_lights(t: float) -> void:
	lights_cd -= get_process_delta_time()
	if lights_cd > 0:
		return
	lights_cd = 1.0
	if lights_node:
		lights_node.queue_free()
	lights_node = Node3D.new()
	add_child(lights_node)
	if t > 0.2 and t < 0.8:
		return
	var near: Array = R.region()["towns"].filter(func(tw): return Vector2(tw["x"], tw["z"]).distance_to(Vector2(party.position.x, party.position.z)) < 160.0)
	for tw in near.slice(0, 10):
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.7, 0.35)
		l.light_energy = 3.0
		l.omni_range = 22.0
		l.position = Vector3(tw["x"], 6, tw["z"])
		lights_node.add_child(l)


func _visit(id: int) -> void:
	GS.data["visit"] = id
	GS.save_game()
	main.start_visit()


# ---------------- Ejércitos y caravanas en movimiento ----------------

func _rebuild_moving() -> void:
	for c in moving_node.get_children():
		c.queue_free()
	var reg := R.region()
	for a in reg["armies"]:
		var li: int = a["lord"]
		var c: Array = reg["lords"][li]["color"]
		var col := Color(c[0], c[1], c[2])
		var p := Vector3(a["x"], 0, a["z"])
		var act := ACTOR.new()
		moving_node.add_child(act)
		act.build(["ubc/Superhero_Male_FullBody", "out/Male_Ranger"], {"faction": "rojo", "hide_hood": true, "sword": true, "shield": true, "helmet": "Helmet3"})
		act.scale = Vector3.ONE * 3.2
		act.position = p
		var tgt := R.town(int(a["target"]))
		if not tgt.is_empty():
			act.rotation.y = atan2(float(tgt["x"]) - p.x, float(tgt["z"]) - p.z)
		act.play("Walk")
		M.recolor(M.put(moving_node, "castle/Banner.glb", p + Vector3(2, 0, -1.5), 0.0, 2.5), col)
		var l := _map_label("Ejército de %s · %d soldados%s" % [N.full(reg["lords"][li]), int(a["troops"]), "  ⚔" if N.at_war(-1, li) else ""], 20)
		l.modulate = col.lightened(0.5)
		l.position = p + Vector3(0, 8, 0)
		moving_node.add_child(l)
	for cv in reg["caravans"]:
		var p := Vector3(cv["x"], 0, cv["z"])
		var tgt := R.town(int(cv["to"]))
		var rot := 0.0
		if not tgt.is_empty():
			rot = atan2(float(tgt["x"]) - p.x, float(tgt["z"]) - p.z)
		M.put(moving_node, "village/Cart.glb", p, rot, 2.2)
		M.put(moving_node, "animals/Horse.glb", p + Vector3(sin(rot), 0, cos(rot)) * 3.0, rot, 0.5)
		var l := _map_label(("Tu caravana" + (" (escoltada)" if int(cv.get("escort", 0)) > 0 else "")) if cv.get("mine", false) else "Caravana", 18 if cv.get("mine", false) else 16)
		if cv.get("mine", false):
			l.modulate = Color(0.7, 0.85, 1.0)
		l.position = p + Vector3(0, 5, 0)
		moving_node.add_child(l)


## Un ejército enemigo cerca de ti al pasar el día te sorprende.
func _check_ambush() -> void:
	var pp := Vector2(party.position.x, party.position.z)
	for a in R.region()["armies"]:
		if N.at_war(-1, int(a["lord"])) and pp.distance_to(Vector2(a["x"], a["z"])) < 18.0:
			var id: int = a["id"]
			var lname := N.full(N.lord(int(a["lord"])))
			_open_panel("¡Emboscada!", "El ejército de %s (%d soldados) os ha alcanzado en el camino." % [lname, int(a["troops"])], [
				["¡A las armas!", func(): _fight_army(id)],
				["Huir (pierdes algunos soldados)", func():
					for k in GS.data["army"]:
						GS.data["army"][k] = int(int(GS.data["army"][k]) * 0.9)
					var away := Vector2(party.position.x, party.position.z) - Vector2(a["x"], a["z"])
					away = away.normalized() * 30.0
					party.position += Vector3(away.x, 0, away.y)
					target = party.position
					_close_panel()]])
			return


func _army_panel(id: int) -> void:
	var a := R.army_by_id(id)
	if a.is_empty():
		return
	var li: int = a["lord"]
	var tgt := R.town(int(a["target"]))
	var text := "Ejército de %s: %d soldados. Marcha hacia %s.\nTu ejército: %d soldados." % [N.full(N.lord(li)), int(a["troops"]), tgt.get("name", "?"), ARMY.total()]
	var opts := []
	if N.at_war(-1, li):
		opts.append(["Atacar al ejército", func(): _fight_army(id)])
	opts.append(["Cerrar", _close_panel])
	_open_panel("Ejército en marcha", text, opts)


func _fight_army(id: int) -> void:
	var a := R.army_by_id(id)
	if a.is_empty():
		_close_panel()
		return
	GS.data["battle"] = {"kind": "campo", "army": id, "enemy": N.full(N.lord(int(a["lord"]))), "troops": int(a["troops"]), "wall": 0}
	GS.save_game()
	main.start_battle()
