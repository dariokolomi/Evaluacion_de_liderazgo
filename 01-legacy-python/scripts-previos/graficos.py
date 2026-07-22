"""Genera los gráficos para el informe: perfil NEO y mapa de competencias."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# ============ GRÁFICO 1: Perfil NEO-FFI (barras horizontales de T-score) ============
dims = ["Neuroticismo (N)", "Extraversión (E)", "Apertura (O)", "Amabilidad (A)", "Responsabilidad (C)"]
t_scores = [39, 64, 64, 37, 53]
colors = []
for t in t_scores:
    if t >= 66: colors.append("#1b5e20")
    elif t >= 56: colors.append("#43a047")
    elif t >= 45: colors.append("#fbc02d")
    elif t >= 35: colors.append("#e64a19")
    else: colors.append("#b71c1c")

fig, ax = plt.subplots(figsize=(10, 5))
bars = ax.barh(dims, t_scores, color=colors, edgecolor="black", linewidth=0.8)
ax.axvline(50, color="gray", ls="--", lw=1, alpha=0.6, label="Media poblacional (T=50)")
ax.axvspan(45, 55, alpha=0.12, color="gray")
ax.set_xlim(20, 80)
ax.set_xlabel("Puntuación T (M=50, DE=10)")
ax.set_title("Perfil de Personalidad NEO-FFI", fontsize=13, fontweight="bold")
for b, t in zip(bars, t_scores):
    ax.text(t + 0.7, b.get_y() + b.get_height()/2, f"T={t}", va="center", fontweight="bold")
ax.legend(loc="lower right")
ax.grid(axis="x", alpha=0.3)
plt.tight_layout()
plt.savefig("grafico_neo.png", dpi=150, bbox_inches="tight")
plt.close()
print("grafico_neo.png OK")

# ============ GRÁFICO 2: Mapa de competencias (radar) - Evaluado vs Líder Situacional ============
competencias = [
    "Carisma",
    "Estim.\nIntelectual",
    "Inspiración",
    "Consideración\nIndividual.",
    "Recompensa\nContingente",
    "Cond.\nTarea",
    "Cond.\nRelaciones",
    "Cond.\nCambio",
    "Liderazgo\nParticipativo",
    "Motivación\nIntrínseca",
]
# Valores del evaluado normalizados a escala 0-100 (percentiles)
evaluado = [25, 75, 25, 99, 25, 50, 50, 75, 90, 75]
# Perfil ideal líder situacional: alto en transformacional, moderado transaccional, alto en participativo y consideración, alto en motivación intrínseca
ideal = [90, 90, 90, 90, 75, 85, 85, 85, 90, 90]

N = len(competencias)
angulos = np.linspace(0, 2*np.pi, N, endpoint=False).tolist()
evaluado_cerrado = evaluado + [evaluado[0]]
ideal_cerrado = ideal + [ideal[0]]
angulos_cerrado = angulos + [angulos[0]]

fig, ax = plt.subplots(figsize=(9, 9), subplot_kw=dict(polar=True))
ax.set_theta_offset(np.pi/2)
ax.set_theta_direction(-1)
ax.set_rlabel_position(0)
ax.set_yticks([20, 40, 60, 80, 100])
ax.set_yticklabels(["20", "40", "60", "80", "100"], color="gray", size=8)
ax.set_ylim(0, 100)
ax.set_xticks(angulos)
ax.set_xticklabels(competencias, size=9)

ax.plot(angulos_cerrado, ideal_cerrado, color="#1565c0", linewidth=2, label="Líder Situacional (ideal)", linestyle="--")
ax.fill(angulos_cerrado, ideal_cerrado, color="#1565c0", alpha=0.10)
ax.plot(angulos_cerrado, evaluado_cerrado, color="#c62828", linewidth=2.2, label="Evaluado (actual)")
ax.fill(angulos_cerrado, evaluado_cerrado, color="#c62828", alpha=0.25)

ax.set_title("Mapa de Competencias:\nEvaluado vs. Perfil de Líder Situacional", size=13, fontweight="bold", pad=25)
ax.legend(loc="upper right", bbox_to_anchor=(1.30, 1.10))
plt.tight_layout()
plt.savefig("grafico_radar.png", dpi=150, bbox_inches="tight")
plt.close()
print("grafico_radar.png OK")

# ============ GRÁFICO 3: Estilos de Liderazgo (CELID-A) barras ============
fig, ax = plt.subplots(figsize=(9, 4.5))
estilos = ["Transformacional", "Transaccional", "Laissez-Faire"]
vals = [4.29, 3.45, 1.83]
clr = ["#2e7d32", "#f9a825", "#c62828"]
bars = ax.bar(estilos, vals, color=clr, edgecolor="black", linewidth=0.8)
for b, v in zip(bars, vals):
    ax.text(b.get_x()+b.get_width()/2, v+0.08, f"{v:.2f}", ha="center", fontweight="bold")
ax.set_ylim(0, 5.2)
ax.set_ylabel("Media (escala 1-5)")
ax.set_title("CELID-A: Estilos Predominantes de Liderazgo", fontsize=13, fontweight="bold")
ax.axhline(3, color="gray", ls="--", lw=0.8, alpha=0.5)
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig("grafico_celid.png", dpi=150, bbox_inches="tight")
plt.close()
print("grafico_celid.png OK")
