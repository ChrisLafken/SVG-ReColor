import { useState, useRef, useCallback } from "react";

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
      if (
        color !== "none" &&
        color !== "transparent" &&
        color !== "inherit" &&
        color !== "currentColor" &&
        color !== "url" &&
        !color.startsWith("url(")
      ) {
        colorSet.add(color);
      }
    }
  }
  return Array.from(colorSet);
};

const replaceColorInSVG = (svgText, oldColor, newColor) => {
  const escapedOld = oldColor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return svgText
    .replace(new RegExp(`fill="${escapedOld}"`, "g"), `fill="${newColor}"`)
    .replace(new RegExp(`stroke="${escapedOld}"`, "g"), `stroke="${newColor}"`)
    .replace(new RegExp(`fill:\\s*${escapedOld}([;}"'\\s])`, "g"), `fill:${newColor}$1`)
    .replace(new RegExp(`stroke:\\s*${escapedOld}([;}"'\\s])`, "g"), `stroke:${newColor}$1`);
};

const toHex = (color) => {
  if (color.startsWith("#")) return color.toLowerCase();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

export default function SVGColorChanger() {
  const [svgText, setSvgText] = useState("");
  const [fileName, setFileName] = useState("");
  const [colors, setColors] = useState([]);
  const [colorMap, setColorMap] = useState({});
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const loadSVG = (text, name) => {
    setSvgText(text);
    setFileName(name);
    const found = parseColorsFromSVG(text);
    setColors(found);
    const map = {};
    found.forEach((c) => { map[c] = toHex(c); });
    setColorMap(map);
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
        .swatch-input { -webkit-appearance: none; appearance: none; width: 36px; height: 36px; border: none; border-radius: 6px; cursor: pointer; background: none; padding: 0; }
        .swatch-input::-webkit-color-swatch-wrapper { padding: 0; border-radius: 6px; }
        .swatch-input::-webkit-color-swatch { border: none; border-radius: 6px; }
        .drop-zone { transition: all 0.2s ease; }
        .drop-zone:hover { border-color: #c8f566 !important; background: rgba(200,245,102,0.03) !important; }
        .btn { transition: all 0.15s ease; cursor: pointer; }
        .btn:hover { transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .color-row { transition: background 0.15s; }
        .color-row:hover { background: rgba(255,255,255,0.04); }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#c8f566" }} />
            <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "#666", textTransform: "uppercase" }}>
              SVG Tools
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 800,
            margin: 0,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}>
            Color<br />
            <span style={{ color: "#c8f566" }}>Changer</span>
          </h1>
          <p style={{ color: "#555", marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
            Sube un SVG, reemplaza colores al instante y descarga el resultado.
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
              borderRadius: 16,
              padding: "64px 32px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging ? "rgba(200,245,102,0.03)" : "#141414",
              marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
            <p style={{ margin: 0, fontSize: 15, color: "#aaa" }}>
              Arrastra tu archivo <strong style={{ color: "#e8e8e0" }}>.svg</strong> aquí
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#444" }}>
              o haz clic para seleccionarlo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {svgText && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            {/* Left: Preview */}
            <div>
              <div style={{
                background: "#141414",
                border: "1px solid #222",
                borderRadius: 16,
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #1e1e1e",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em" }}>PREVIEW</span>
                  <span style={{
                    fontSize: 11,
                    color: "#444",
                    background: "#1a1a1a",
                    padding: "3px 8px",
                    borderRadius: 4,
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>{fileName}</span>
                </div>
                <div style={{
                  padding: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 240,
                  background: "repeating-conic-gradient(#1a1a1a 0% 25%, #141414 0% 50%) 0 0 / 20px 20px",
                }}>
                  {svgDataUrl && (
                    <img
                      src={svgDataUrl}
                      alt="SVG preview"
                      style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain" }}
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={handleDownload}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#c8f566",
                    color: "#0e0e0e",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    letterSpacing: "0.05em",
                  }}
                >
                  ↓ Descargar SVG
                </button>
                <button
                  className="btn"
                  onClick={handleCopy}
                  style={{
                    padding: "12px 16px",
                    background: "#1e1e1e",
                    color: copied ? "#c8f566" : "#888",
                    border: "1px solid #2a2a2a",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  {copied ? "✓" : "⎘"}
                </button>
                <button
                  className="btn"
                  onClick={() => { setSvgText(""); setColors([]); setColorMap({}); setFileName(""); }}
                  style={{
                    padding: "12px 16px",
                    background: "#1e1e1e",
                    color: "#666",
                    border: "1px solid #2a2a2a",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Right: Colors */}
            <div style={{
              background: "#141414",
              border: "1px solid #222",
              borderRadius: 16,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid #1e1e1e",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em" }}>COLORES DETECTADOS</span>
                <span style={{
                  fontSize: 11,
                  color: "#c8f566",
                  background: "rgba(200,245,102,0.08)",
                  padding: "3px 8px",
                  borderRadius: 4,
                }}>{colors.length}</span>
              </div>

              {colors.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#444", fontSize: 13 }}>
                  No se detectaron colores editables.<br />
                  <span style={{ fontSize: 11, color: "#333" }}>El SVG puede usar colores heredados o variables CSS.</span>
                </div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {colors.map((color) => (
                    <div
                      key={color}
                      className="color-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 16px",
                        borderBottom: "1px solid #1a1a1a",
                      }}
                    >
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: colorMap[color] || color,
                        flexShrink: 0,
                        boxShadow: `0 0 8px ${colorMap[color] || color}66`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "#666", fontFamily: "inherit", marginBottom: 2 }}>
                          original
                        </div>
                        <div style={{
                          fontSize: 13,
                          color: "#aaa",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {color}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="color"
                          className="swatch-input"
                          value={colorMap[color] || "#000000"}
                          onChange={(e) => handleColorChange(color, e.target.value)}
                          title={`Cambiar ${color}`}
                        />
                        <span style={{ fontSize: 11, color: "#444", fontFamily: "inherit", minWidth: 56 }}>
                          {colorMap[color]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "#333", letterSpacing: "0.05em" }}>
          Los cambios se aplican en tiempo real · Solo procesa archivos localmente
        </div>
      </div>
    </div>
  );
}
