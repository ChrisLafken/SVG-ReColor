import { useState, useRef, useCallback } from "react";

// ── Color conversion utilities ──────────────────────────────────────────────

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

const rgbToHex = (r, g, b) => {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
};

const rgbToCmyk = (r, g, b) => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
};

const cmykToHex = (c, m, y, k) => {
  const r = 255 * (1 - c / 100) * (1 - k / 100);
  const g = 255 * (1 - m / 100) * (1 - k / 100);
  const b = 255 * (1 - y / 100) * (1 - k / 100);
  return rgbToHex(r, g, b);
};

const toHex = (color) => {
  if (!color) return "#000000";
  if (color.startsWith("#")) {
    if (color.length === 4) {
      return "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color.toLowerCase();
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(r, g, b);
};

// ── SVG utilities ────────────────────────────────────────────────────────────

const parseColorsFromSVG = (svgText) => {
  const colorSet = new Set();
  const colorRegexes = [
    /fill="([^"none][^"]*)"/g,
    /stroke="([^"none][^"]*)"/g,
    /fill:\s*([^;}"'\s]+)/g,
    /stroke:\s*([^;}"'\s]+)/g,
  ];
  for (const regex of colorRegexes) {
    let match;
    while ((match = regex.exec(svgText)) !== null) {
      const color = match[1].trim();
      if (color !== "none" && color !== "transparent" && color !== "inherit" && color !== "currentColor" && !color.startsWith("url(")) {
        colorSet.add(color);
      }
    }
  }
  return Array.from(colorSet);
};

const replaceColorInSVG = (svgText, oldColor, newColor) => {
  const esc = oldColor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return svgText
    .replace(new RegExp(`fill="${esc}"`, "g"), `fill="${newColor}"`)
    .replace(new RegExp(`stroke="${esc}"`, "g"), `stroke="${newColor}"`)
    .replace(new RegExp(`fill:\\s*${esc}([;}"'\\s])`, "g"), `fill:${newColor}$1`)
    .replace(new RegExp(`stroke:\\s*${esc}([;}"'\\s])`, "g"), `stroke:${newColor}$1`);
};

// ── Color Input Panel ────────────────────────────────────────────────────────

function ColorInputPanel({ hex, onChange }) {
  const [mode, setMode] = useState("HEX");
  const rgb = hexToRgb(hex || "#000000");
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);

  const [localRgb, setLocalRgb] = useState(rgb);
  const [localCmyk, setLocalCmyk] = useState(cmyk);
  const [localHex, setLocalHex] = useState(hex || "#000000");

  // Sync when hex changes externally (e.g. color picker)
  const prevHex = useRef(hex);
  if (prevHex.current !== hex) {
    prevHex.current = hex;
    const r2 = hexToRgb(hex || "#000000");
    setLocalRgb(r2);
    setLocalCmyk(rgbToCmyk(r2.r, r2.g, r2.b));
    setLocalHex(hex || "#000000");
  }

  const applyHex = (val) => {
    const clean = val.trim();
    const full = clean.startsWith("#") ? clean : "#" + clean;
    if (/^#[0-9a-fA-F]{6}$/.test(full)) {
      onChange(full.toLowerCase());
    }
  };

  const applyRgb = (r, g, b) => {
    const h = rgbToHex(r, g, b);
    onChange(h);
  };

  const applyCmyk = (c, m, y, k) => {
    const h = cmykToHex(c, m, y, k);
    onChange(h);
  };

  const tabStyle = (active) => ({
    padding: "4px 10px",
    fontSize: 10,
    fontFamily: "inherit",
    letterSpacing: "0.1em",
    border: "1px solid",
    borderColor: active ? "#c8f566" : "#2a2a2a",
    borderRadius: 5,
    background: active ? "rgba(200,245,102,0.1)" : "transparent",
    color: active ? "#c8f566" : "#555",
    cursor: "pointer",
  });

  const inputStyle = {
    background: "#0e0e0e",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    color: "#e8e8e0",
    fontFamily: "inherit",
    fontSize: 12,
    padding: "5px 8px",
    width: "100%",
    outline: "none",
  };

  const labelStyle = { fontSize: 10, color: "#555", marginBottom: 3, letterSpacing: "0.08em" };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {["HEX", "RGB", "CMYK"].map((m) => (
          <button key={m} style={tabStyle(mode === m)} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>

      {mode === "HEX" && (
        <div>
          <div style={labelStyle}>CÓDIGO HEX</div>
          <input
            style={inputStyle}
            value={localHex}
            onChange={(e) => setLocalHex(e.target.value)}
            onBlur={(e) => applyHex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyHex(e.target.value)}
            placeholder="#000000"
            maxLength={7}
          />
        </div>
      )}

      {mode === "RGB" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[["R", "r", 0, 255], ["G", "g", 0, 255], ["B", "b", 0, 255]].map(([label, key]) => (
            <div key={key}>
              <div style={labelStyle}>{label}</div>
              <input
                style={inputStyle}
                type="number"
                min={0} max={255}
                value={localRgb[key]}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                  const updated = { ...localRgb, [key]: val };
                  setLocalRgb(updated);
                  applyRgb(updated.r, updated.g, updated.b);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {mode === "CMYK" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {[["C", "c"], ["M", "m"], ["Y", "y"], ["K", "k"]].map(([label, key]) => (
            <div key={key}>
              <div style={labelStyle}>{label}%</div>
              <input
                style={inputStyle}
                type="number"
                min={0} max={100}
                value={localCmyk[key]}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                  const updated = { ...localCmyk, [key]: val };
                  setLocalCmyk(updated);
                  applyCmyk(updated.c, updated.m, updated.y, updated.k);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function SVGColorChanger() {
  const [svgText, setSvgText] = useState("");
  const [fileName, setFileName] = useState("");
  const [colors, setColors] = useState([]);
  const [colorMap, setColorMap] = useState({});
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedColor, setExpandedColor] = useState(null);
  const fileInputRef = useRef(null);

  const loadSVG = (text, name) => {
    setSvgText(text);
    setFileName(name);
    const found = parseColorsFromSVG(text);
    setColors(found);
    const map = {};
    found.forEach((c) => { map[c] = toHex(c); });
    setColorMap(map);
    setExpandedColor(null);
  };

  const handleFile = (file) => {
    if (!file || !file.name.endsWith(".svg")) return;
    const reader = new FileReader();
    reader.onload = (e) => loadSVG(e.target.result, file.name);
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const getModifiedSVG = () => {
    let modified = svgText;
    for (const [original, replacement] of Object.entries(colorMap)) {
      if (toHex(original) !== replacement) {
        modified = replaceColorInSVG(modified, original, replacement);
      }
    }
    return modified;
  };

  const handleDownload = () => {
    try {
      const modified = getModifiedSVG();
      const blob = new Blob([modified], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.svg$/i, "_modified.svg");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert("Error al descargar: " + err.message);
    }
  };

  const handleDownloadPNG = () => {
    try {
      const modified = getModifiedSVG();
      const DPI = 300;
      const SCREEN_DPI = 96;
      const scale = DPI / SCREEN_DPI;

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(modified, "image/svg+xml");
      const svgEl = svgDoc.querySelector("svg");

      let svgW = parseFloat(svgEl?.getAttribute("width")) || 0;
      let svgH = parseFloat(svgEl?.getAttribute("height")) || 0;

      if (!svgW || !svgH) {
        const vb = svgEl?.getAttribute("viewBox")?.split(/[\s,]+/);
        if (vb && vb.length === 4) { svgW = parseFloat(vb[2]); svgH = parseFloat(vb[3]); }
      }
      if (!svgW || !svgH) { svgW = 512; svgH = 512; }

      const canvasW = Math.round(svgW * scale);
      const canvasH = Math.round(svgH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");

      const svgBlob = new Blob([modified], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = fileName.replace(/\.svg$/i, "_300dpi.png");
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, "image/png");
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert("No se pudo renderizar el SVG. Intenta con otro archivo.");
      };

      img.src = url;
    } catch (err) {
      alert("Error al exportar PNG: " + err.message);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getModifiedSVG());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleColorChange = (original, newHex) => {
    setColorMap((prev) => ({ ...prev, [original]: newHex }));
  };

  const modifiedSVG = svgText ? getModifiedSVG() : "";
  const svgDataUrl = modifiedSVG
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(modifiedSVG)}`
    : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0e0e0e",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#e8e8e0",
      padding: "40px 24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 3px; }
        .swatch-input { -webkit-appearance: none; appearance: none; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; background: none; padding: 0; flex-shrink: 0; }
        .swatch-input::-webkit-color-swatch-wrapper { padding: 0; border-radius: 6px; }
        .swatch-input::-webkit-color-swatch { border: none; border-radius: 6px; }
        .drop-zone { transition: all 0.2s ease; }
        .drop-zone:hover { border-color: #c8f566 !important; background: rgba(200,245,102,0.03) !important; }
        .btn { transition: all 0.15s ease; cursor: pointer; }
        .btn:hover { transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .color-row { transition: background 0.15s; cursor: pointer; }
        .color-row:hover { background: rgba(255,255,255,0.04); }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        input:focus { border-color: #c8f566 !important; }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#c8f566" }} />
            <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "#666", textTransform: "uppercase" }}>SVG Tools</span>
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Color<br /><span style={{ color: "#c8f566" }}>Changer</span>
          </h1>
          <p style={{ color: "#555", marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
            Sube un SVG · edita colores por HEX, RGB o CMYK · descarga el resultado.
          </p>
        </div>

        {/* Drop zone */}
        {!svgText && (
          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1.5px dashed ${dragging ? "#c8f566" : "#2e2e2e"}`,
              borderRadius: 16, padding: "64px 32px", textAlign: "center",
              cursor: "pointer", background: dragging ? "rgba(200,245,102,0.03)" : "#141414", marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
            <p style={{ margin: 0, fontSize: 15, color: "#aaa" }}>Arrastra tu archivo <strong style={{ color: "#e8e8e0" }}>.svg</strong> aquí</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#444" }}>o haz clic para seleccionarlo</p>
            <input ref={fileInputRef} type="file" accept=".svg" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        )}

        {svgText && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            {/* Left: Preview */}
            <div>
              <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em" }}>PREVIEW</span>
                  <span style={{ fontSize: 11, color: "#444", background: "#1a1a1a", padding: "3px 8px", borderRadius: 4, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
                </div>
                <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240, background: "repeating-conic-gradient(#1a1a1a 0% 25%, #141414 0% 50%) 0 0 / 20px 20px" }}>
                  {svgDataUrl && <img src={svgDataUrl} alt="SVG preview" style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain" }} />}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={handleDownload} style={{ flex: 1, padding: "12px", background: "#c8f566", color: "#0e0e0e", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", letterSpacing: "0.05em" }}>
                    ↓ Descargar SVG
                  </button>
                  <button className="btn" onClick={handleCopy} style={{ padding: "12px 16px", background: "#1e1e1e", color: copied ? "#c8f566" : "#888", border: "1px solid #2a2a2a", borderRadius: 10, fontSize: 13, fontFamily: "inherit" }}>
                    {copied ? "✓" : "⎘"}
                  </button>
                  <button className="btn" onClick={() => { setSvgText(""); setColors([]); setColorMap({}); setFileName(""); }} style={{ padding: "12px 16px", background: "#1e1e1e", color: "#666", border: "1px solid #2a2a2a", borderRadius: 10, fontSize: 13, fontFamily: "inherit" }}>
                    ✕
                  </button>
                </div>
                <button className="btn" onClick={handleDownloadPNG} style={{ width: "100%", padding: "12px", background: "#1e1e1e", color: "#e8e8e0", border: "1px solid #2a2a2a", borderRadius: 10, fontSize: 13, fontWeight: 500, fontFamily: "inherit", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, background: "rgba(200,245,102,0.15)", color: "#c8f566", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.1em" }}>300 DPI</span>
                  ↓ Exportar PNG
                </button>
              </div>
            </div>

            {/* Right: Colors */}
            <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em" }}>COLORES DETECTADOS</span>
                <span style={{ fontSize: 11, color: "#c8f566", background: "rgba(200,245,102,0.08)", padding: "3px 8px", borderRadius: 4 }}>{colors.length}</span>
              </div>

              {colors.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#444", fontSize: 13 }}>
                  No se detectaron colores editables.<br />
                  <span style={{ fontSize: 11, color: "#333" }}>El SVG puede usar colores heredados o variables CSS.</span>
                </div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {colors.map((color) => {
                    const isExpanded = expandedColor === color;
                    const currentHex = colorMap[color] || "#000000";
                    return (
                      <div key={color} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        {/* Row */}
                        <div
                          className="color-row"
                          onClick={() => setExpandedColor(isExpanded ? null : color)}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: currentHex, flexShrink: 0, boxShadow: `0 0 8px ${currentHex}66` }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: "#555", marginBottom: 1 }}>original</div>
                            <div style={{ fontSize: 12, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{color}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="color"
                              className="swatch-input"
                              value={currentHex}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleColorChange(color, e.target.value)}
                            />
                            <span style={{ fontSize: 10, color: "#444", fontFamily: "inherit", minWidth: 52 }}>{currentHex}</span>
                            <span style={{ fontSize: 10, color: isExpanded ? "#c8f566" : "#444" }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {/* Expanded panel */}
                        {isExpanded && (
                          <div style={{ padding: "0 16px 14px", borderTop: "1px solid #1a1a1a", background: "#111" }}>
                            <ColorInputPanel
                              hex={currentHex}
                              onChange={(newHex) => handleColorChange(color, newHex)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "#333", letterSpacing: "0.05em" }}>
          Los cambios se aplican en tiempo real · Solo procesa archivos localmente
        </div>
      </div>
    </div>
  );
}