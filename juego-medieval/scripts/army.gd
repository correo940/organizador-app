extends RefCounted
## Ejército del señor: tipos de tropa, reclutamiento en el cuartel, paga diaria y bajas.

const UNITS := {
	"milicia": {"name": "Milicia", "cost": {"oro": 3}, "pay": 0.0, "hp": 32.0, "dmg": 7.0, "speed": 3.4, "reach": 1.7},
	"lancero": {"name": "Lanceros", "cost": {"oro": 8, "hierro": 2}, "pay": 0.2, "hp": 45.0, "dmg": 10.0, "speed": 3.5, "reach": 2.4},
	"arquero": {"name": "Arqueros", "cost": {"oro": 10, "madera": 2}, "pay": 0.25, "hp": 35.0, "dmg": 9.0, "speed": 3.6, "reach": 18.0, "ranged": true},
	"infante": {"name": "Hombres de armas", "cost": {"oro": 20, "hierro": 3, "piel": 1}, "pay": 0.4, "hp": 75.0, "dmg": 13.0, "speed": 3.3, "reach": 1.8},
	"jinete": {"name": "Caballería", "cost": {"oro": 45, "hierro": 3, "piel": 2}, "pay": 0.7, "hp": 95.0, "dmg": 16.0, "speed": 6.5, "reach": 2.4, "tier": 2},
}
const ORDER := ["jinete", "infante", "lancero", "milicia", "arquero"]


static func ensure() -> void:
	var d = GS.data
	if not d.has("army"):
		d["army"] = {}
	for k in UNITS:
		if not d["army"].has(k):
			d["army"][k] = 0
	if not d.has("pay_debt"):
		d["pay_debt"] = 0.0


static func total() -> int:
	var n := 0
	for k in GS.data["army"]:
		n += int(GS.data["army"][k])
	return n


## Plazas del cuartel: depende del tamaño del pueblo y de la gente disponible.
static func capacity() -> int:
	var tier := int(GS.data["tier"])
	var base: int = [0, 40, 150][tier]
	return mini(base, total() + int(GS.data["commons"]) / 2)


static func can_recruit() -> String:
	if int(GS.data["tier"]) < 1:
		return "Hace falta que el pueblo sea una villa para tener cuartel."
	if int(GS.data["title"]) < 1:
		return "Solo el jefe del pueblo puede reclutar tropas."
	return ""


static func recruit(k: String, n: int) -> String:
	var err := can_recruit()
	if err != "":
		return err
	n = mini(n, capacity() - total())
	if n <= 0:
		return "No hay sitio en el cuartel o no queda gente para reclutar."
	if int(GS.data["tier"]) < int(UNITS[k].get("tier", 1)):
		return "La caballería solo se puede reclutar en una ciudad."
	var cost: Dictionary = UNITS[k]["cost"]
	if not GS.can_pay(cost, n):
		return "Te faltan recursos: %s por soldado." % GS.cost_text(cost)
	GS.pay(cost, n)
	GS.data["army"][k] = int(GS.data["army"][k]) + n
	GS.data["commons"] = int(GS.data["commons"]) - n
	return "+%d %s" % [n, String(UNITS[k]["name"]).to_lower()]


static func dismiss(k: String, n: int) -> void:
	n = mini(n, int(GS.data["army"][k]))
	GS.data["army"][k] = int(GS.data["army"][k]) - n
	GS.data["commons"] = int(GS.data["commons"]) + n


static func daily_pay() -> float:
	var t := 0.0
	for k in UNITS:
		t += float(UNITS[k]["pay"]) * int(GS.data["army"][k])
	return t


## Paga diaria. Si no hay oro, parte de la tropa deserta y vuelve al pueblo.
static func day() -> void:
	var d = GS.data
	d["pay_debt"] = float(d["pay_debt"]) + daily_pay()
	var owed := int(floor(float(d["pay_debt"])))
	if owed <= 0:
		return
	if int(d["gold"]) >= owed:
		d["gold"] = int(d["gold"]) - owed
		d["pay_debt"] = float(d["pay_debt"]) - owed
		return
	d["pay_debt"] = 0.0
	var lost := 0
	for k in ["jinete", "infante", "arquero", "lancero"]:
		var n := int(ceil(int(d["army"][k]) * 0.1))
		dismiss(k, n)
		lost += n
	if lost > 0:
		GS.say("Sin paga, %d soldados desertan y vuelven a sus casas." % lost)


static func casualties(dead: Dictionary) -> void:
	for k in dead:
		GS.data["army"][k] = maxi(0, int(GS.data["army"][k]) - int(dead[k]))
