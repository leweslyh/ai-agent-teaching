# -*- coding: utf-8 -*-
"""生成 images/transformer-architecture.svg —— 教学用 Transformer 经典架构图（中文重绘版）。

运行：  python tools/gen-transformer-architecture.py
产物：  images/transformer-architecture.svg   （矢量，站内展示）
        images/transformer-architecture.png   （无头浏览器 2x 导出，供 OCR 演示当输入）

设计说明（对照 light-figure-drawing 规范）
  · 结构忠实：编码器 / 解码器双栈、N× 重复、残差连接、交叉注意力、位置编码、
    线性层 + Softmax —— 与 Vaswani et al., "Attention Is All You Need", NeurIPS 2017 一致。
  · 画幅比例对齐论文原图（691×929 ≈ 0.744），本图 700×932 ≈ 0.751。
  · Q / K / V：自注意力用「三条箭头线」表现同一输入拆成 Q、K、V；
    交叉注意力则按真实语义标注 —— 竖线来自解码器为 Q，横线来自编码器为 K、V。
  · 图内不写标题（标题由页面 ta-title 承担），仅在底部保留配色图例。
  · 配色：主色取起源实验室紫（--c-ori #8E44AD）；功能色取 Okabe-Ito 色盲安全色系，
    且每个色块都带文字标签（不以色传意，黑白打印仍可辨）。
  · 字体与站内其它自制 SVG 统一：微软雅黑 / PingFang SC / Noto Sans SC。
"""
import math
import os

# ---------------------------------------------------------------- 画布
W, H = 700, 948

# ---------------------------------------------------------------- 配色
INK = "#2B2B33"
SUB = "#5D6B7C"
DIM = "#8A96A6"
WHITE = "#FFFFFF"

ORI = "#8E44AD"          # 起源实验室主色 = 注意力机制（本图主角）
ORI_DEEP = "#6C3483"
ORI_LINE = "#DCCBEE"
ORI_TINT = "#F7F3FC"

# 功能性配色：底 / 边 / 字
C_ATT = ("#F5EDFA", "#D8C7EA", "#6C3483")   # 注意力机制
C_FF = ("#EBF4FB", "#BFDCF0", "#05527F")    # 前馈网络
C_NRM = ("#E9F6F1", "#B7E0D2", "#04704F")   # 残差 + 归一化
C_EMB = ("#FDF5E4", "#F3DCA8", "#9A6A00")   # 嵌入 / 位置编码
C_OUT = ("#F4F4F7", "#D6D6DE", "#55555F")   # 输出层

FLOW = "#8A96A6"         # 主数据流箭头
RESI = "#4EAF92"         # 残差连接（语义同“归一化”色）
CROSS = "#6C3483"        # 编码器 → 解码器 的跨栈连接
QKV = "#8E44AD"          # Q / K / V 三条输入箭头

FONT = "'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif"

els = []


def add(s):
    els.append(s)


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def tw(s, size):
    """粗略估宽：中文按 1 个字宽，西文按 0.55 字宽。"""
    return sum(size * (1.0 if ord(c) > 0x2E80 else 0.55) for c in s)


def text(x, y, s, size=12, fill=INK, weight="400", anchor="start"):
    add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
        f'font-weight="{weight}" text-anchor="{anchor}">{esc(s)}</text>')


def rect(x, y, w, h, rx=9, fill=WHITE, stroke=ORI_LINE, sw=1.4):
    add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')


def head(x, y, ux, uy, color, sw, hl=7.0, hw=4.8):
    """在 (x,y) 处画一个朝向 (ux,uy) 的箭头头部。"""
    px, py = -uy, ux
    bx, by = x - ux * hl, y - uy * hl
    add(f'<path d="M{bx + px * hw:.1f},{by + py * hw:.1f} L{x:.1f},{y:.1f} '
        f'L{bx - px * hw:.1f},{by - py * hw:.1f}" fill="none" stroke="{color}" '
        f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>')


def arrow(x1, y1, x2, y2, color=FLOW, sw=1.9, hl=7.0, hw=4.8):
    add(f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}" fill="none" stroke="{color}" '
        f'stroke-width="{sw}" stroke-linecap="round"/>')
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    head(x2, y2, dx / L, dy / L, color, sw, hl, hw)


def polyline(pts, color, sw=1.9, r=8):
    """带圆角的折线（不含箭头）。"""
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i - 1]
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        v1 = (x1 - x0, y1 - y0)
        L1 = math.hypot(*v1) or 1.0
        a = (x1 - v1[0] / L1 * r, y1 - v1[1] / L1 * r)
        v2 = (x2 - x1, y2 - y1)
        L2 = math.hypot(*v2) or 1.0
        b = (x1 + v2[0] / L2 * r, y1 + v2[1] / L2 * r)
        d += f" L{a[0]:.1f},{a[1]:.1f} Q{x1:.1f},{y1:.1f} {b[0]:.1f},{b[1]:.1f}"
    d += f" L{pts[-1][0]:.1f},{pts[-1][1]:.1f}"
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" '
        f'stroke-linecap="round" stroke-linejoin="round"/>')


def residual_left(xs, ys, xr, ye, xe, sw=1.6, r=8):
    """残差连接（左绕）：(xs,ys) → 左行到 xr → 竖直到 ye → 右行到 xe。
    与原图一致：残差线带箭头，指向 Add & Norm 盒子（左侧进入）。"""
    dy = 1 if ye > ys else -1
    add(f'<path d="M{xs:.1f},{ys:.1f} L{xr + r:.1f},{ys:.1f} Q{xr:.1f},{ys:.1f} '
        f'{xr:.1f},{ys + dy * r:.1f} L{xr:.1f},{ye - dy * r:.1f} '
        f'Q{xr:.1f},{ye:.1f} {xr + r:.1f},{ye:.1f} L{xe:.1f},{ye:.1f}" '
        f'fill="none" stroke="{RESI}" stroke-width="{sw}" stroke-linecap="round"/>')
    head(xe, ye, 1, 0, RESI, sw, 6.5, 4.4)


def residual_right(xs, ys, xr, ye, xe, sw=1.6, r=8):
    """残差连接（右绕）：(xs,ys) → 右行到 xr → 竖直到 ye → 左行到 xe。
    与原图一致：残差线带箭头，指向 Add & Norm 盒子（右侧进入）。"""
    dy = 1 if ye > ys else -1
    add(f'<path d="M{xs:.1f},{ys:.1f} L{xr - r:.1f},{ys:.1f} Q{xr:.1f},{ys:.1f} '
        f'{xr:.1f},{ys + dy * r:.1f} L{xr:.1f},{ye - dy * r:.1f} '
        f'Q{xr:.1f},{ye:.1f} {xr - r:.1f},{ye:.1f} L{xe:.1f},{ye:.1f}" '
        f'fill="none" stroke="{RESI}" stroke-width="{sw}" stroke-linecap="round"/>')
    head(xe, ye, -1, 0, RESI, sw, 6.5, 4.4)


def qkv_fan(cx, y_box, y_bus, y_feed):
    """自注意力的 Q / K / V：一路输入在总线上拆成三条箭头线进入注意力盒。"""
    half = 40
    add(f'<path d="M{cx - half},{y_bus} L{cx + half},{y_bus}" fill="none" stroke="{QKV}" '
        f'stroke-width="1.9" stroke-linecap="round"/>')
    add(f'<path d="M{cx},{y_feed} L{cx},{y_bus}" fill="none" stroke="{QKV}" '
        f'stroke-width="1.9" stroke-linecap="round"/>')
    for dx, lab in ((-half, "Q"), (0, "K"), (half, "V")):
        arrow(cx + dx, y_bus, cx + dx, y_box, QKV, 1.9)
        text(cx + dx - 6, y_bus - 4, lab, 12, QKV, "700", "end")


def block(x, y, w, h, main, sub, colors, main_size=14, sub_size=10.5, rx=10):
    bg, ln, fg = colors
    rect(x, y, w, h, rx, bg, ln, 1.5)
    cx = x + w / 2
    text(cx, y + h / 2 - 4, main, main_size, fg, "700", "middle")
    text(cx, y + h / 2 + 11.5, sub, sub_size, SUB, "400", "middle")


# ---------------------------------------------------------------- 版式常量
BW = 172          # 计算块宽
SB = 674          # 双栈底边（编码器 / 解码器底对齐）
HS = 64           # 子层块高
HA = 42           # Add & Norm 块高
G = 24            # 子层间距（留出明显箭头 + 残差汇入点）

ENC_L, DEC_L = 90, 438
ENC_C, DEC_C = ENC_L + BW / 2, DEC_L + BW / 2        # 176 / 524
ENC_CT, DEC_CT = 56, 404
CT_W = 240
RAIL_L, RAIL_R = ENC_CT + 17, DEC_CT + CT_W - 17     # 73 / 627

ENC_TOP = SB - (2 * HS + 2 * HA + 3 * G)             # 378
DEC_TOP = SB - (3 * HS + 3 * HA + 5 * G)             # 236

# 编码器（自上而下）：Add&Norm → FF → Add&Norm → MHA
ENC_A1 = ENC_TOP
ENC_FF = ENC_A1 + HA + G
ENC_A2 = ENC_FF + HS + G
ENC_MH = ENC_A2 + HA + G
# 解码器（自上而下）：Add&Norm → FF → Add&Norm → MHA(交叉) → Add&Norm → Masked MHA
DEC_A1 = DEC_TOP
DEC_FF = DEC_A1 + HA + G
DEC_A2 = DEC_FF + HS + G
DEC_MH = DEC_A2 + HA + G
DEC_A3 = DEC_MH + HS + G
DEC_MK = DEC_A3 + HA + G

CT_PAD = 14              # N× 容器四周内边距
BUS_Y = SB + 22          # 696  Q/K/V 总线
RSD_Y = SB + 32          # 706  残差绕行线的分支高度（在总线下方，避免与总线重叠）
CT_BOT = SB + 40         # 714  容器下边缘：完整包住 Q/K/V 三条线与绿色残差线
PD_Y = 746               # ⊕ / 位置编码 圆心 y（在容器之外）
PD_R = 15
EMB_Y, EMB_H = 784, 42

# ================================================================ 绘制
rect(0, 0, W, H, 14, WHITE, ORI_LINE, 1.4)

# ---- 输出端（解码器顶部）
text(DEC_C, 36, "输出概率", 13, C_OUT[2], "700", "middle")
text(DEC_C, 52, "Output Probabilities", 10.5, SUB, "400", "middle")

SM_Y = 88
LN_Y = 152
arrow(DEC_C, SM_Y, DEC_C, 62)
block(DEC_L, SM_Y, BW, 42, "概率输出", "Softmax", C_OUT, 12.5, 10)
arrow(DEC_C, LN_Y, DEC_C, SM_Y + 42)
block(DEC_L, LN_Y, BW, 42, "线性层", "Linear", C_OUT, 12.5, 10)
arrow(DEC_C, DEC_TOP, DEC_C, LN_Y + 42)

# ---- 两个 N× 容器
rect(ENC_CT, ENC_TOP - CT_PAD, CT_W, CT_BOT - ENC_TOP + CT_PAD, 16, ORI_TINT, ORI_LINE, 1.4)
rect(DEC_CT, DEC_TOP - CT_PAD, CT_W, CT_BOT - DEC_TOP + CT_PAD, 16, ORI_TINT, ORI_LINE, 1.4)
text(ENC_CT - 22, (ENC_TOP - CT_PAD + CT_BOT) / 2 + 6, "N×", 15, ORI_DEEP, "700", "middle")
text(DEC_CT + CT_W + 22, (DEC_TOP - CT_PAD + CT_BOT) / 2 + 6, "N×", 15, ORI_DEEP, "700", "middle")
text(ENC_CT + 4, ENC_TOP - 20, "编码器 Encoder", 11.5, ORI_DEEP, "700")
text(DEC_CT - 8, DEC_TOP - 20, "解码器 Decoder", 11.5, ORI_DEEP, "700", "end")

# ---- 模块之间的主链路连接箭头（原图中子层与其 Add & Norm 之间都有明确箭头）
arrow(ENC_C, ENC_MH, ENC_C, ENC_A2 + HA)      # 多头自注意力   → Add & Norm
arrow(ENC_C, ENC_A2, ENC_C, ENC_FF + HS)      # Add & Norm    → 前馈网络
arrow(ENC_C, ENC_FF, ENC_C, ENC_A1 + HA)      # 前馈网络       → Add & Norm
arrow(DEC_C, DEC_MK, DEC_C, DEC_A3 + HA)      # 掩码自注意力   → Add & Norm
arrow(DEC_C, DEC_MH, DEC_C, DEC_A2 + HA)      # 多头注意力(交叉) → Add & Norm
arrow(DEC_C, DEC_A2, DEC_C, DEC_FF + HS)      # Add & Norm    → 前馈网络
arrow(DEC_C, DEC_FF, DEC_C, DEC_A1 + HA)      # 前馈网络       → Add & Norm
# 解码器「Add & Norm → 多头注意力（交叉）」的主链路即上面那条 Q 线，故不重复画

# ---- 残差连接（编码器左绕 / 解码器右绕）
# 与原图一致：绕开子层后，箭头直接指向对应的「残差 + 归一化」(Add & Norm) 盒子
residual_left(ENC_C, RSD_Y, RAIL_L, ENC_A2 + HA / 2, ENC_L)
residual_left(ENC_C, ENC_A2 - 12, RAIL_L, ENC_A1 + HA / 2, ENC_L)
residual_right(DEC_C, RSD_Y, RAIL_R, DEC_A3 + HA / 2, DEC_L + BW)
residual_right(DEC_C, DEC_A3 - 12, RAIL_R, DEC_A2 + HA / 2, DEC_L + BW)
residual_right(DEC_C, DEC_A2 - 12, RAIL_R, DEC_A1 + HA / 2, DEC_L + BW)

# ---- 编码器子层
block(ENC_L, ENC_A1, BW, HA, "Add & Norm", "残差 + 归一化", C_NRM, 12.5, 10)
block(ENC_L, ENC_FF, BW, HS, "前馈网络", "Feed Forward", C_FF)
block(ENC_L, ENC_A2, BW, HA, "Add & Norm", "残差 + 归一化", C_NRM, 12.5, 10)
block(ENC_L, ENC_MH, BW, HS, "多头自注意力", "Multi-Head Attention", C_ATT)

# ---- 解码器子层
block(DEC_L, DEC_A1, BW, HA, "Add & Norm", "残差 + 归一化", C_NRM, 12.5, 10)
block(DEC_L, DEC_FF, BW, HS, "前馈网络", "Feed Forward", C_FF)
block(DEC_L, DEC_A2, BW, HA, "Add & Norm", "残差 + 归一化", C_NRM, 12.5, 10)
block(DEC_L, DEC_MH, BW, HS, "多头注意力（交叉）", "Multi-Head Attention", C_ATT)
block(DEC_L, DEC_A3, BW, HA, "Add & Norm", "残差 + 归一化", C_NRM, 12.5, 10)
block(DEC_L, DEC_MK, BW, HS, "掩码多头自注意力", "Masked Multi-Head Attention", C_ATT)

# ---- 解码器的 Q / K / V：竖线来自解码器 = Q，横线来自编码器 = K、V
arrow(DEC_C, DEC_A3, DEC_C, DEC_MH + HS, QKV, 1.9)
text(DEC_C - 6, DEC_A3 - 6, "Q", 12, QKV, "700", "end")

# ---- 解码器：⊕ + 位置编码 + 输出嵌入
qkv_fan(DEC_C, DEC_MK + HS, BUS_Y, PD_Y - PD_R)
add(f'<circle cx="{DEC_C}" cy="{PD_Y}" r="{PD_R}" fill="{WHITE}" stroke="{C_EMB[2]}" stroke-width="1.7"/>')
add(f'<path d="M{DEC_C - 8},{PD_Y} L{DEC_C + 8},{PD_Y} M{DEC_C},{PD_Y - 8} L{DEC_C},{PD_Y + 8}" '
    f'stroke="{C_EMB[2]}" stroke-width="1.8" stroke-linecap="round"/>')
add(f'<circle cx="{DEC_C + 64}" cy="{PD_Y}" r="{PD_R}" fill="{C_EMB[0]}" stroke="{C_EMB[2]}" stroke-width="1.6"/>')
add(f'<path d="M{DEC_C + 56},{PD_Y} C{DEC_C + 60},{PD_Y - 9} {DEC_C + 68},{PD_Y + 9} {DEC_C + 72},{PD_Y}" '
    f'fill="none" stroke="{C_EMB[2]}" stroke-width="1.7" stroke-linecap="round"/>')
arrow(DEC_C + 64 - PD_R, PD_Y, DEC_C + PD_R, PD_Y, C_EMB[2], 1.7, 6, 4.2)
text(DEC_C + 82, PD_Y - 3, "位置编码", 12, C_EMB[2], "700")
text(DEC_C + 82, PD_Y + 12, "Pos. Encoding", 10, SUB)
arrow(DEC_C, EMB_Y, DEC_C, PD_Y + PD_R)
block(DEC_L, EMB_Y, BW, EMB_H, "输出嵌入", "Output Embedding", C_EMB, 12.5, 10)
arrow(DEC_C, 850, DEC_C, EMB_Y + EMB_H)
text(DEC_C, 868, "输出（右移一位）", 12.5, INK, "700", "middle")
text(DEC_C, 884, "Outputs (shifted right)", 10.5, SUB, "400", "middle")

# ---- 编码器：Q/K/V 三条箭头 + ⊕ + 位置编码 + 输入嵌入
qkv_fan(ENC_C, ENC_MH + HS, BUS_Y, PD_Y - PD_R)
add(f'<circle cx="{ENC_C}" cy="{PD_Y}" r="{PD_R}" fill="{WHITE}" stroke="{C_EMB[2]}" stroke-width="1.7"/>')
add(f'<path d="M{ENC_C - 8},{PD_Y} L{ENC_C + 8},{PD_Y} M{ENC_C},{PD_Y - 8} L{ENC_C},{PD_Y + 8}" '
    f'stroke="{C_EMB[2]}" stroke-width="1.8" stroke-linecap="round"/>')
add(f'<circle cx="{ENC_C - 64}" cy="{PD_Y}" r="{PD_R}" fill="{C_EMB[0]}" stroke="{C_EMB[2]}" stroke-width="1.6"/>')
add(f'<path d="M{ENC_C - 72},{PD_Y} C{ENC_C - 68},{PD_Y - 9} {ENC_C - 60},{PD_Y + 9} {ENC_C - 56},{PD_Y}" '
    f'fill="none" stroke="{C_EMB[2]}" stroke-width="1.7" stroke-linecap="round"/>')
arrow(ENC_C - 64 + PD_R, PD_Y, ENC_C - PD_R, PD_Y, C_EMB[2], 1.7, 6, 4.2)
text(ENC_C - 82, PD_Y - 3, "位置编码", 12, C_EMB[2], "700", "end")
text(ENC_C - 82, PD_Y + 12, "Pos. Encoding", 10, SUB, "400", "end")
arrow(ENC_C, EMB_Y, ENC_C, PD_Y + PD_R)
block(ENC_L, EMB_Y, BW, EMB_H, "输入嵌入", "Input Embedding", C_EMB, 12.5, 10)
arrow(ENC_C, 850, ENC_C, EMB_Y + EMB_H)
text(ENC_C, 868, "输入", 12.5, INK, "700", "middle")
text(ENC_C, 884, "Inputs", 10.5, SUB, "400", "middle")

# ---- 编码器输出 → 解码器交叉注意力：分叉为 K、V 两条箭头线（Q 由解码器一侧供给）
CROSS_Y = 340
KV_X = 420
K_Y = DEC_MH + 16
V_Y = DEC_MH + HS - 16
KV_MID = (K_Y + V_Y) / 2
polyline([(ENC_C, ENC_TOP), (ENC_C, CROSS_Y), (386, CROSS_Y), (386, KV_MID), (KV_X, KV_MID)],
         CROSS, 1.9, 10)
add(f'<path d="M{KV_X},{K_Y} L{KV_X},{V_Y}" fill="none" stroke="{CROSS}" '
    f'stroke-width="1.9" stroke-linecap="round"/>')
arrow(KV_X, K_Y, DEC_L, K_Y, CROSS, 1.9)
arrow(KV_X, V_Y, DEC_L, V_Y, CROSS, 1.9)
text((KV_X + DEC_L) / 2, K_Y - 6, "K", 12, QKV, "700", "middle")
text((KV_X + DEC_L) / 2, V_Y - 6, "V", 12, QKV, "700", "middle")
text(281, CROSS_Y - 8, "编码器输出", 11, CROSS, "700", "middle")

# ---- 图例
LEG = [(ORI, "注意力机制"), (C_FF[2], "前馈网络"), (C_NRM[2], "残差 + 归一化"),
       (C_EMB[2], "嵌入 / 位置编码"), (C_OUT[2], "输出层")]
LEG_NOTE = "N× ＝ 同一组模块重复 N 层"
LEG_Y = 915
gap, sw_, sep = 22, 11, 22
total = (sum(sw_ + 5 + tw(t, 11) for _, t in LEG) + gap * (len(LEG) - 1)
         + sep + tw(LEG_NOTE, 10.5))
x = (W - total) / 2
add(f'<rect x="20" y="896" width="{W - 40}" height="36" rx="10" fill="{ORI_TINT}" '
    f'stroke="{ORI_LINE}" stroke-width="1.2"/>')
for color, label in LEG:
    add(f'<rect x="{x:.1f}" y="{LEG_Y - 8:.1f}" width="{sw_}" height="{sw_}" rx="3" '
        f'fill="{color}" stroke="none"/>')
    text(x + sw_ + 5, LEG_Y + 1, label, 11, SUB)
    x += sw_ + 5 + tw(label, 11) + gap
add(f'<path d="M{x - gap + 6:.1f},{LEG_Y - 8:.1f} L{x - gap + 6:.1f},{LEG_Y + 4:.1f}" '
    f'stroke="{ORI_LINE}" stroke-width="1.2"/>')
text(x + sep - gap + 6, LEG_Y + 1, LEG_NOTE, 10.5, DIM)

# ================================================================ 输出
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
       f'width="{W}" height="{H}" font-family="{FONT}">' + "".join(els) + "</svg>")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "images", "transformer-architecture.svg")
with open(out, "w", encoding="utf-8", newline="") as f:
    f.write(svg)
print("written:", out, len(svg), "bytes")
