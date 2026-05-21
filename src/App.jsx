import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const hexToRgb = (hex) => ({ r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) });
const rgbToHex = (r,g,b) => "#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const rgbToCmyk = (r,g,b) => { const rn=r/255,gn=g/255,bn=b/255,k=1-Math.max(rn,gn,bn); if(k===1)return{c:0,m:0,y:0,k:100}; return{c:Math.round((1-rn-k)/(1-k)*100),m:Math.round((1-gn-k)/(1-k)*100),y:Math.round((1-bn-k)/(1-k)*100),k:Math.round(k*100)}; };
const cmykToHex = (c,m,y,k) => rgbToHex(255*(1-c/100)*(1-k/100),255*(1-m/100)*(1-k/100),255*(1-y/100)*(1-k/100));
const toHex = (color) => { if(!color)return"#000000"; if(color.startsWith("#")){ if(color.length===4)return"#"+color[1]+color[1]+color[2]+color[2]+color[3]+color[3]; return color.toLowerCase(); } const c=document.createElement("canvas");c.width=c.height=1;const x=c.getContext("2d");x.fillStyle=color;x.fillRect(0,0,1,1);const[r,g,b]=x.getImageData(0,0,1,1).data;return rgbToHex(r,g,b); };

// ═══════════════════════════════════════════════════════════════════════════
// EAN-13 UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

// Standard EAN-13 encoding tables (ISO/IEC 15420)
const EAN13_L = { "0":"0001101","1":"0011001","2":"0010011","3":"0111101","4":"0100011","5":"0110001","6":"0101111","7":"0111011","8":"0110111","9":"0001011" };
const EAN13_G = { "0":"0100111","1":"0110011","2":"0011011","3":"0100001","4":"0011101","5":"0111001","6":"0000101","7":"0010001","8":"0001001","9":"0010111" };
const EAN13_R = { "0":"1110010","1":"1100110","2":"1101100","3":"1000010","4":"1011100","5":"1001110","6":"1010000","7":"1000100","8":"1001000","9":"1110100" };
// Parity pattern for first digit (which encoding to use for digits 2-7)
const EAN13_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

const calcEAN13Check = (digits12) => {
  const d = digits12.split("").map(Number);
  // odd positions (1,3,5,...) × 1, even positions (2,4,6,...) × 3
  const sum = d.reduce((acc,v,i) => acc + v*(i%2===0?1:3), 0);
  return String((10 - (sum % 10)) % 10);
};

// Returns array of {bit, digitIndex} for precise digit label placement
const encodeEAN13Detailed = (code13) => {
  const first = code13[0];
  const parity = EAN13_PARITY[parseInt(first)];
  const segments = []; // {bits, type, digitIndex}

  segments.push({ bits:"101", type:"guard" });
  for (let i = 1; i <= 6; i++) {
    const d = code13[i];
    segments.push({ bits: parity[i-1]==="L" ? EAN13_L[d] : EAN13_G[d], type:"data", digitIndex:i });
  }
  segments.push({ bits:"01010", type:"middle" });
  for (let i = 7; i <= 12; i++) {
    segments.push({ bits: EAN13_R[code13[i]], type:"data", digitIndex:i });
  }
  segments.push({ bits:"101", type:"guard" });
  return segments;
};

const buildEAN13SVG = (code, barColor, bgColor, transparent) => {
  const barW = 2;
  const quietZone = 14;
  const barcodeH = 69;
  const guardExtra = 5;
  const textH = 12;
  const totalH = barcodeH + guardExtra + textH + 2;
  const totalW = quietZone * 2 + 95 * barW;

  const segments = encodeEAN13Detailed(code);
  let bars = "";
  const digitSegs = {};
  let bitX = quietZone;

  for (const seg of segments) {
    const startX = bitX;
    const isGuard = seg.type === "guard" || seg.type === "middle";
    const h = isGuard ? barcodeH + guardExtra : barcodeH;
    for (let b = 0; b < seg.bits.length; b++) {
      if (seg.bits[b] === "1") {
        bars += `<rect x="${startX + b * barW}" y="0" width="${barW}" height="${h}" fill="${barColor}"/>`;
      }
    }
    if (seg.type === "data") {
      digitSegs[seg.digitIndex] = { startX, endX: startX + seg.bits.length * barW };
    }
    bitX += seg.bits.length * barW;
  }

  const textY = barcodeH + guardExtra + textH - 1;
  const fs = 9;
  let texts = `<text x="${quietZone - 5}" y="${textY}" font-family="monospace" font-size="${fs}" text-anchor="middle" fill="${barColor}">${code[0]}</text>`;
  for (let i = 1; i <= 12; i++) {
    const s = digitSegs[i];
    if (!s) continue;
    const cx = (s.startX + s.endX) / 2;
    texts += `<text x="${cx}" y="${textY}" font-family="monospace" font-size="${fs}" text-anchor="middle" fill="${barColor}">${code[i]}</text>`;
  }

  const bgRect = transparent ? "" : `<rect width="${totalW}" height="${totalH}" fill="${bgColor}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">\n  ${bgRect}\n  ${bars}\n  ${texts}\n</svg>`;
};

const exportSVGasPNG = (svgText, filename, scale=3.125) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const el = doc.querySelector("svg");
  const w = parseFloat(el?.getAttribute("width")||"200");
  const h = parseFloat(el?.getAttribute("height")||"100");
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale);
  const ctx = canvas.getContext("2d");
  const blob = new Blob([svgText],{type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => { const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a); },"image/png");
  };
  img.src = url;
};

const downloadText = (text, filename, mime) => {
  const blob = new Blob([text],{type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function ColorInputPanel({ hex, onChange }) {
  const [mode, setMode] = useState("HEX");
  const prevHex = useRef(hex);
  const rgb = hexToRgb(hex||"#000000");
  const [localRgb, setLocalRgb] = useState(rgb);
  const [localCmyk, setLocalCmyk] = useState(rgbToCmyk(rgb.r,rgb.g,rgb.b));
  const [localHex, setLocalHex] = useState(hex||"#000000");

  if (prevHex.current !== hex) {
    prevHex.current = hex;
    const r2 = hexToRgb(hex||"#000000");
    setLocalRgb(r2); setLocalCmyk(rgbToCmyk(r2.r,r2.g,r2.b)); setLocalHex(hex||"#000000");
  }

  const applyHex = (val) => { const f=val.trim().startsWith("#")?val.trim():"#"+val.trim(); if(/^#[0-9a-fA-F]{6}$/.test(f))onChange(f.toLowerCase()); };

  const tab = (active) => ({ padding:"4px 10px",fontSize:10,fontFamily:"inherit",letterSpacing:"0.1em",border:"1px solid",borderColor:active?"#c8f566":"#2a2a2a",borderRadius:5,background:active?"rgba(200,245,102,0.1)":"transparent",color:active?"#c8f566":"#555",cursor:"pointer" });
  const inp = { background:"#0e0e0e",border:"1px solid #2a2a2a",borderRadius:6,color:"#e8e8e0",fontFamily:"inherit",fontSize:12,padding:"5px 8px",width:"100%",outline:"none" };
  const lbl = { fontSize:10,color:"#555",marginBottom:3,letterSpacing:"0.08em" };

  return (
    <div style={{marginTop:8}}>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {["HEX","RGB","CMYK"].map(m=><button key={m} style={tab(mode===m)} onClick={()=>setMode(m)}>{m}</button>)}
      </div>
      {mode==="HEX" && <div><div style={lbl}>CÓDIGO HEX</div><input style={inp} value={localHex} onChange={e=>setLocalHex(e.target.value)} onBlur={e=>applyHex(e.target.value)} onKeyDown={e=>e.key==="Enter"&&applyHex(e.target.value)} placeholder="#000000" maxLength={7}/></div>}
      {mode==="RGB" && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{[["R","r"],["G","g"],["B","b"]].map(([l,k])=><div key={k}><div style={lbl}>{l}</div><input style={inp} type="number" min={0} max={255} value={localRgb[k]} onChange={e=>{const v=Math.max(0,Math.min(255,parseInt(e.target.value)||0));const u={...localRgb,[k]:v};setLocalRgb(u);onChange(rgbToHex(u.r,u.g,u.b));}}/></div>)}</div>}
      {mode==="CMYK" && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>{[["C","c"],["M","m"],["Y","y"],["K","k"]].map(([l,k])=><div key={k}><div style={lbl}>{l}%</div><input style={inp} type="number" min={0} max={100} value={localCmyk[k]} onChange={e=>{const v=Math.max(0,Math.min(100,parseInt(e.target.value)||0));const u={...localCmyk,[k]:v};setLocalCmyk(u);onChange(cmykToHex(u.c,u.m,u.y,u.k));}}/></div>)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: SVG COLOR CHANGER
// ═══════════════════════════════════════════════════════════════════════════

const parseColorsFromSVG = (svgText) => {
  const s = new Set();
  [/fill="([^"none][^"]*)"/g,/stroke="([^"none][^"]*)"/g,/fill:\s*([^;}"'\s]+)/g,/stroke:\s*([^;}"'\s]+)/g].forEach(re=>{
    let m; while((m=re.exec(svgText))!==null){const c=m[1].trim();if(c!=="none"&&c!=="transparent"&&c!=="inherit"&&c!=="currentColor"&&!c.startsWith("url("))s.add(c);}
  });
  return Array.from(s);
};

const replaceColorInSVG = (svgText,oldColor,newColor) => {
  const e=oldColor.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return svgText.replace(new RegExp(`fill="${e}"`,"g"),`fill="${newColor}"`).replace(new RegExp(`stroke="${e}"`,"g"),`stroke="${newColor}"`).replace(new RegExp(`fill:\\s*${e}([;}"'\\s])`,"g"),`fill:${newColor}$1`).replace(new RegExp(`stroke:\\s*${e}([;}"'\\s])`,"g"),`stroke:${newColor}$1`);
};

function TabSVGChanger() {
  const [svgText, setSvgText] = useState("");
  const [fileName, setFileName] = useState("");
  const [colors, setColors] = useState([]);
  const [colorMap, setColorMap] = useState({});
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedColor, setExpandedColor] = useState(null);
  const fileInputRef = useRef(null);

  const loadSVG = (text,name) => { setSvgText(text);setFileName(name);const f=parseColorsFromSVG(text);setColors(f);const m={};f.forEach(c=>{m[c]=toHex(c);});setColorMap(m);setExpandedColor(null); };
  const handleFile = (file) => { if(!file||!file.name.endsWith(".svg"))return;const r=new FileReader();r.onload=e=>loadSVG(e.target.result,file.name);r.readAsText(file); };
  const handleDrop = useCallback((e)=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}, []);

  const getModified = () => { let m=svgText;for(const[o,r]of Object.entries(colorMap)){if(toHex(o)!==r)m=replaceColorInSVG(m,o,r);}return m; };

  const handleDownloadSVG = () => { try{const m=getModified();downloadText(m,fileName.replace(/\.svg$/i,"_modified.svg"),"image/svg+xml;charset=utf-8");}catch(e){alert(e.message);} };
  const handleDownloadPNG = () => { try{const m=getModified();const parser=new DOMParser();const doc=parser.parseFromString(m,"image/svg+xml");const el=doc.querySelector("svg");let w=parseFloat(el?.getAttribute("width"))||0,h=parseFloat(el?.getAttribute("height"))||0;if(!w||!h){const vb=el?.getAttribute("viewBox")?.split(/[\s,]+/);if(vb?.length===4){w=parseFloat(vb[2]);h=parseFloat(vb[3]);}}if(!w||!h){w=512;h=512;}const scale=300/96;const canvas=document.createElement("canvas");canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext("2d");const blob=new Blob([m],{type:"image/svg+xml;charset=utf-8"});const url=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=fileName.replace(/\.svg$/i,"_300dpi.png");document.body.appendChild(a);a.click();document.body.removeChild(a);},"image/png");};img.onerror=()=>{URL.revokeObjectURL(url);alert("No se pudo renderizar.");};img.src=url;}catch(e){alert(e.message);} };
  const handleCopy = async () => { await navigator.clipboard.writeText(getModified());setCopied(true);setTimeout(()=>setCopied(false),2000); };

  const modified = svgText ? getModified() : "";
  const svgUrl = modified ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(modified)}` : null;

  return (
    <div>
      {!svgText && (
        <div className="drop-zone" onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onClick={()=>fileInputRef.current?.click()}
          style={{border:`1.5px dashed ${dragging?"#c8f566":"#2e2e2e"}`,borderRadius:16,padding:"64px 32px",textAlign:"center",cursor:"pointer",background:dragging?"rgba(200,245,102,0.03)":"#141414"}}>
          <div style={{fontSize:48,marginBottom:16}}>⬡</div>
          <p style={{margin:0,fontSize:15,color:"#aaa"}}>Arrastra tu archivo <strong style={{color:"#e8e8e0"}}>.svg</strong> aquí</p>
          <p style={{margin:"6px 0 0",fontSize:12,color:"#444"}}>o haz clic para seleccionarlo</p>
          <input ref={fileInputRef} type="file" accept=".svg" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        </div>
      )}
      {svgText && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
          <div>
            <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #1e1e1e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"#555",letterSpacing:"0.1em"}}>PREVIEW</span>
                <span style={{fontSize:11,color:"#444",background:"#1a1a1a",padding:"3px 8px",borderRadius:4,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</span>
              </div>
              <div style={{padding:24,display:"flex",alignItems:"center",justifyContent:"center",minHeight:240,background:"repeating-conic-gradient(#1a1a1a 0% 25%, #141414 0% 50%) 0 0 / 20px 20px"}}>
                {svgUrl && <img src={svgUrl} alt="preview" style={{maxWidth:"100%",maxHeight:280,objectFit:"contain"}}/>}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>
              <div style={{display:"flex",gap:10}}>
                <button className="btn" onClick={handleDownloadSVG} style={{flex:1,padding:"12px",background:"#c8f566",color:"#0e0e0e",border:"none",borderRadius:10,fontSize:13,fontWeight:600,fontFamily:"inherit"}}>↓ Descargar SVG</button>
                <button className="btn" onClick={handleCopy} style={{padding:"12px 16px",background:"#1e1e1e",color:copied?"#c8f566":"#888",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontFamily:"inherit"}}>{copied?"✓":"⎘"}</button>
                <button className="btn" onClick={()=>{setSvgText("");setColors([]);setColorMap({});setFileName("");}} style={{padding:"12px 16px",background:"#1e1e1e",color:"#666",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontFamily:"inherit"}}>✕</button>
              </div>
              <button className="btn" onClick={handleDownloadPNG} style={{width:"100%",padding:"12px",background:"#1e1e1e",color:"#e8e8e0",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:11,background:"rgba(200,245,102,0.15)",color:"#c8f566",padding:"2px 6px",borderRadius:4}}>300 DPI</span> ↓ Exportar PNG
              </button>
            </div>
          </div>
          <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #1e1e1e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:"#555",letterSpacing:"0.1em"}}>COLORES DETECTADOS</span>
              <span style={{fontSize:11,color:"#c8f566",background:"rgba(200,245,102,0.08)",padding:"3px 8px",borderRadius:4}}>{colors.length}</span>
            </div>
            {colors.length===0
              ? <div style={{padding:32,textAlign:"center",color:"#444",fontSize:13}}>No se detectaron colores editables.</div>
              : <div style={{maxHeight:520,overflowY:"auto"}}>
                  {colors.map(color=>{
                    const isExp=expandedColor===color, hex=colorMap[color]||"#000000";
                    return (
                      <div key={color} style={{borderBottom:"1px solid #1a1a1a"}}>
                        <div className="color-row" onClick={()=>setExpandedColor(isExp?null:color)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px"}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:hex,flexShrink:0,boxShadow:`0 0 8px ${hex}66`}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,color:"#555",marginBottom:1}}>original</div>
                            <div style={{fontSize:12,color:"#aaa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{color}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <input type="color" className="swatch-input" value={hex} onClick={e=>e.stopPropagation()} onChange={e=>setColorMap(p=>({...p,[color]:e.target.value}))}/>
                            <span style={{fontSize:10,color:"#444",minWidth:52}}>{hex}</span>
                            <span style={{fontSize:10,color:isExp?"#c8f566":"#444"}}>{isExp?"▲":"▼"}</span>
                          </div>
                        </div>
                        {isExp && <div style={{padding:"0 16px 14px",borderTop:"1px solid #1a1a1a",background:"#111"}}><ColorInputPanel hex={hex} onChange={v=>setColorMap(p=>({...p,[color]:v}))}/></div>}
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: EAN-13 BARCODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function TabBarcode() {
  const [input, setInput] = useState("");
  const [barColor, setBarColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [error, setError] = useState("");
  const [svgCode, setSvgCode] = useState("");
  const [barColorMode, setBarColorMode] = useState("picker");
  const [bgColorMode, setBgColorMode] = useState("picker");

  const digits12 = input.replace(/\D/g,"").slice(0,12);
  const checkDigit = digits12.length===12 ? calcEAN13Check(digits12) : null;
  const full13 = digits12.length===12 ? digits12+checkDigit : null;

  useEffect(() => {
    if (full13) {
      setError("");
      setSvgCode(buildEAN13SVG(full13, barColor, bgColor, transparent));
    } else {
      setSvgCode("");
    }
  }, [full13, barColor, bgColor, transparent]);

  const handleInput = (val) => {
    const clean = val.replace(/\D/g,"").slice(0,12);
    setInput(clean);
    if(clean.length>0&&clean.length<12) setError(`Faltan ${12-clean.length} dígitos`);
    else setError("");
  };

  // For preview, always show with white bg so transparent mode is visible
  const previewSvg = svgCode
    ? (transparent ? buildEAN13SVG(full13, barColor, "#ffffff", false) : svgCode)
    : "";
  const svgUrl = previewSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}` : null;

  const inp = {background:"#0e0e0e",border:"1px solid #2a2a2a",borderRadius:8,color:"#e8e8e0",fontFamily:"inherit",fontSize:14,padding:"10px 14px",outline:"none",letterSpacing:"0.15em"};
  const swatchBtn = (active) => ({padding:"4px 10px",fontSize:10,fontFamily:"inherit",border:"1px solid",borderColor:active?"#c8f566":"#2a2a2a",borderRadius:5,background:active?"rgba(200,245,102,0.1)":"transparent",color:active?"#c8f566":"#555",cursor:"pointer"});

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
      {/* Left: controls */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* Code input */}
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:20}}>
          <div style={{fontSize:11,color:"#555",letterSpacing:"0.15em",marginBottom:12}}>CÓDIGO EAN-13</div>
          <input
            style={{...inp,width:"100%",fontSize:18,textAlign:"center"}}
            value={input}
            onChange={e=>handleInput(e.target.value)}
            placeholder="000000000000"
            maxLength={12}
          />
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,alignItems:"center"}}>
            <span style={{fontSize:11,color:error?"#ff6b6b":"#555"}}>{error||`${digits12.length}/12 dígitos`}</span>
            {checkDigit!==null && <span style={{fontSize:11,color:"#c8f566"}}>Dígito de control: <strong>{checkDigit}</strong></span>}
          </div>
          {full13 && <div style={{marginTop:8,padding:"6px 10px",background:"rgba(200,245,102,0.06)",borderRadius:6,fontSize:13,color:"#c8f566",textAlign:"center",letterSpacing:"0.2em"}}>{full13}</div>}
        </div>

        {/* Bar color */}
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:20}}>
          <div style={{fontSize:11,color:"#555",letterSpacing:"0.15em",marginBottom:12}}>COLOR DE BARRAS</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <input type="color" className="swatch-input" value={barColor} onChange={e=>setBarColor(e.target.value)}/>
            <span style={{fontSize:12,color:"#aaa"}}>{barColor}</span>
            <div style={{marginLeft:"auto",display:"flex",gap:6}}>
              {["picker","manual"].map(m=><button key={m} style={swatchBtn(barColorMode===m)} onClick={()=>setBarColorMode(m)}>{m==="picker"?"Visual":"Manual"}</button>)}
            </div>
          </div>
          {barColorMode==="manual" && <ColorInputPanel hex={barColor} onChange={setBarColor}/>}
        </div>

        {/* Background color */}
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:"#555",letterSpacing:"0.15em"}}>COLOR DE FONDO</div>
            {/* Transparent toggle */}
            <button onClick={()=>setTransparent(t=>!t)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:0}}>
              <div style={{width:32,height:18,borderRadius:9,background:transparent?"rgba(200,245,102,0.2)":"#2a2a2a",border:`1px solid ${transparent?"#c8f566":"#333"}`,position:"relative",transition:"all 0.2s"}}>
                <div style={{position:"absolute",top:2,left:transparent?14:2,width:12,height:12,borderRadius:"50%",background:transparent?"#c8f566":"#555",transition:"all 0.2s"}}/>
              </div>
              <span style={{fontSize:10,color:transparent?"#c8f566":"#555",letterSpacing:"0.08em"}}>TRANSPARENTE</span>
            </button>
          </div>
          {transparent
            ? <div style={{padding:"10px 14px",background:"repeating-conic-gradient(#1e1e1e 0% 25%, #141414 0% 50%) 0 0 / 16px 16px",borderRadius:8,fontSize:11,color:"#555",textAlign:"center"}}>Sin fondo (transparente)</div>
            : <>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <input type="color" className="swatch-input" value={bgColor} onChange={e=>setBgColor(e.target.value)}/>
                  <span style={{fontSize:12,color:"#aaa"}}>{bgColor}</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    {["picker","manual"].map(m=><button key={m} style={swatchBtn(bgColorMode===m)} onClick={()=>setBgColorMode(m)}>{m==="picker"?"Visual":"Manual"}</button>)}
                  </div>
                </div>
                {bgColorMode==="manual" && <ColorInputPanel hex={bgColor} onChange={setBgColor}/>}
              </>
          }
        </div>
      </div>

      {/* Right: preview + export */}
      <div>
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,overflow:"hidden",marginBottom:12}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #1e1e1e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"#555",letterSpacing:"0.1em"}}>PREVIEW</span>
            {transparent && <span style={{fontSize:10,color:"#555",background:"#1a1a1a",padding:"2px 8px",borderRadius:4}}>fondo blanco solo en preview</span>}
          </div>
          <div style={{padding:32,display:"flex",alignItems:"center",justifyContent:"center",minHeight:200,background:"repeating-conic-gradient(#1a1a1a 0% 25%, #141414 0% 50%) 0 0 / 20px 20px"}}>
            {svgUrl
              ? <img src={svgUrl} alt="barcode" style={{maxWidth:"100%",imageRendering:"crisp-edges"}}/>
              : <div style={{textAlign:"center",color:"#333",fontSize:13}}>Ingresa 12 dígitos<br/><span style={{fontSize:11,color:"#2a2a2a"}}>para generar el código</span></div>
            }
          </div>
        </div>

        {svgCode && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button className="btn" onClick={()=>downloadText(svgCode,`EAN13_${full13}.svg`,"image/svg+xml;charset=utf-8")}
              style={{width:"100%",padding:"12px",background:"#c8f566",color:"#0e0e0e",border:"none",borderRadius:10,fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
              ↓ Descargar SVG
            </button>
            <button className="btn" onClick={()=>exportSVGasPNG(transparent ? buildEAN13SVG(full13,barColor,bgColor,false) : svgCode, `EAN13_${full13}_300dpi.png`)}
              style={{width:"100%",padding:"12px",background:"#1e1e1e",color:"#e8e8e0",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{fontSize:11,background:"rgba(200,245,102,0.15)",color:"#c8f566",padding:"2px 6px",borderRadius:4}}>300 DPI</span> ↓ Exportar PNG
            </button>
            <div style={{padding:"10px 14px",background:"#0e0e0e",border:"1px solid #1e1e1e",borderRadius:8,fontSize:11,color:"#444",lineHeight:1.6}}>
              ℹ️ El SVG es vectorial y escalable sin pérdida de calidad.{transparent?" El PNG se exporta sin fondo.":""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// TAB: QR CODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

// QR Code generation using qrcodegen library (loaded from CDN via script tag)
// We implement a minimal QR encoder for URLs/text using the qrcodegen approach

// Reed-Solomon and QR encoding — full implementation
const QR = (() => {
  // Alphanumeric charset
  const ALPHANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

  // GF(256) arithmetic for Reed-Solomon
  const gfExp = new Uint8Array(512);
  const gfLog = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      gfExp[i] = x; gfLog[x] = i;
      x = x << 1; if (x & 256) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
  })();
  const gfMul = (a, b) => a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]];
  const gfPoly = (degree) => {
    let p = [1];
    for (let i = 0; i < degree; i++) {
      const q = [1, gfExp[i]];
      const r = new Array(p.length + q.length - 1).fill(0);
      for (let j = 0; j < p.length; j++) for (let k = 0; k < q.length; k++) r[j+k] ^= gfMul(p[j], q[k]);
      p = r;
    }
    return p;
  };
  const rsEncode = (data, nsym) => {
    const gen = gfPoly(nsym);
    const msg = [...data, ...new Array(nsym).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) for (let j = 1; j < gen.length; j++) msg[i+j] ^= gfMul(gen[j], coef);
    }
    return msg.slice(data.length);
  };

  // QR version/ECC tables (version 1-10, ECC level M)
  const VERSION_DATA = {
    1:{cap:16,ec:10,blocks:[[1,26,16]]},
    2:{cap:28,ec:16,blocks:[[1,44,28]]},
    3:{cap:44,ec:26,blocks:[[1,70,44]]},
    4:{cap:64,ec:36,blocks:[[2,50,32]]},
    5:{cap:86,ec:48,blocks:[[2,67,43]]},
    6:{cap:108,ec:64,blocks:[[4,43,27]]},
    7:{cap:124,ec:72,blocks:[[4,49,31]]},
    8:{cap:154,ec:88,blocks:[[2,60,38],[2,61,39]]}
  };

  const getVersion = (len) => {
    for (const [v, d] of Object.entries(VERSION_DATA)) {
      if (len <= d.cap) return parseInt(v);
    }
    return 8;
  };

  // Encode text as byte mode
  const encodeBytes = (text) => {
    const bytes = new TextEncoder().encode(text);
    const version = getVersion(bytes.length);
    const vd = VERSION_DATA[version];
    const totalDC = vd.blocks.reduce((s,[,, dc]) => s + dc, 0) + vd.blocks.reduce((a, b, i) => { const prev = vd.blocks.slice(0,i).reduce((s2,[c]) => s2+c, 0); return a + (vd.blocks[i][0] * 0); }, 0);

    // Build data codewords
    const bits = [];
    const pushBits = (val, len) => { for (let i = len-1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(0b0100, 4); // byte mode
    pushBits(bytes.length, 8);
    for (const b of bytes) pushBits(b, 8);
    // Terminator
    for (let i = 0; i < 4 && bits.length < vd.cap * 8; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const pads = [0xEC, 0x11];
    let pi = 0;
    while (bits.length < vd.cap * 8) { pushBits(pads[pi % 2], 8); pi++; }

    // Convert bits to bytes
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i+j];
      data.push(b);
    }

    // Error correction
    const allCodewords = [];
    const ecCodewords = [];
    let offset = 0;
    for (const [count, total, dc] of vd.blocks) {
      const ec = total - dc;
      for (let b = 0; b < count; b++) {
        const block = data.slice(offset, offset + dc);
        allCodewords.push(block);
        ecCodewords.push(rsEncode(block, ec));
        offset += dc;
      }
    }

    // Interleave
    const final = [];
    const maxDC = Math.max(...allCodewords.map(b => b.length));
    for (let i = 0; i < maxDC; i++) for (const b of allCodewords) if (i < b.length) final.push(b[i]);
    const maxEC = Math.max(...ecCodewords.map(b => b.length));
    for (let i = 0; i < maxEC; i++) for (const b of ecCodewords) if (i < b.length) final.push(b[i]);

    return { version, codewords: final };
  };

  // Build QR matrix
  const SIZE = v => v * 4 + 17;

  const makeMatrix = (version, codewords) => {
    const size = SIZE(version);
    const mat = Array.from({length:size}, () => new Array(size).fill(null)); // null=empty, 0=white, 1=dark
    const isFunc = Array.from({length:size}, () => new Array(size).fill(false));

    const set = (r, c, v, func=false) => { if (r>=0&&r<size&&c>=0&&c<size){mat[r][c]=v;if(func)isFunc[r][c]=true;} };

    // Finder patterns
    const finder = (tr, tc) => {
      for (let r=-1;r<=7;r++) for (let c=-1;c<=7;c++) {
        const dark = r>=0&&r<=6&&(c===0||c===6) || c>=0&&c<=6&&(r===0||r===6) || r>=2&&r<=4&&c>=2&&c<=4;
        set(tr+r, tc+c, dark?1:0, true);
      }
    };
    finder(0,0); finder(0,size-7); finder(size-7,0);

    // Separators (already covered by finder border of 0s, just mark as func)
    const markFunc = (r,c) => { if(r>=0&&r<size&&c>=0&&c<size) isFunc[r][c]=true; };
    for(let i=0;i<8;i++){markFunc(7,i);markFunc(i,7);markFunc(7,size-1-i);markFunc(i,size-8);markFunc(size-8,i);markFunc(size-1-i,7);}

    // Timing patterns
    for(let i=8;i<size-8;i++){set(6,i,i%2===0?1:0,true);set(i,6,i%2===0?1:0,true);}

    // Dark module
    set(size-8,8,1,true);

    // Alignment patterns (version >= 2)
    const ALN = {2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42]};
    if (ALN[version]) {
      const pos = ALN[version];
      for (const r of pos) for (const c of pos) {
        if (isFunc[r][c]) continue;
        for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++) {
          const dark = Math.abs(dr)===2||Math.abs(dc)===2||dr===0&&dc===0;
          set(r+dr,c+dc,dark?1:0,true);
        }
      }
    }

    // Format info (mask 0b010 = pattern (row+col)%3 == 0)
    // ECC level M (10) + mask 2 -> format = 0b10_010 -> after BCH and XOR with 101010000010010
    const FORMAT = {
      0:0x77C4,1:0x72F3,2:0x7DAA,3:0x789D,4:0x662F,5:0x6318,6:0x6C41,7:0x6976
    };
    const fmt = FORMAT[2]; // mask pattern 2
    const fmtBits = [];
    for(let i=14;i>=0;i--) fmtBits.push((fmt>>i)&1);
    const fpos = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
    const fcol = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
    for(let i=0;i<15;i++){set(fpos[i],fcol[i],fmtBits[i],true);set(fcol[i],fpos[i],fmtBits[i],true);}
    set(size-8,8,1,true); // dark module

    // Data placement
    const bitStream = [];
    for(const cw of codewords) for(let i=7;i>=0;i--) bitStream.push((cw>>i)&1);
    let bi = 0;
    let up = true;
    for(let col=size-1;col>=1;col-=2){
      if(col===6) col=5;
      for(let i=0;i<size;i++){
        const row = up ? size-1-i : i;
        for(let dc=0;dc<=1;dc++){
          const c = col-dc;
          if(!isFunc[row][c] && mat[row][c]===null){
            let bit = bi < bitStream.length ? bitStream[bi++] : 0;
            // Apply mask pattern 2: (row+col)%3 == 0
            if((row+c)%3===0) bit ^= 1;
            mat[row][c] = bit;
          }
        }
      }
      up = !up;
    }

    // Fill remaining nulls
    for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(mat[r][c]===null) mat[r][c]=0;

    return mat;
  };

  const generate = (text) => {
    const { version, codewords } = encodeBytes(text);
    const matrix = makeMatrix(version, codewords);
    return matrix;
  };

  return { generate };
})();

const buildQRSVG = (matrix, darkColor, lightColor, transparent, moduleSize=4) => {
  const size = matrix.length;
  const margin = moduleSize * 4;
  const totalSize = size * moduleSize + margin * 2;

  let rects = "";
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) {
    if(matrix[r][c]===1) rects += `<rect x="${margin+c*moduleSize}" y="${margin+r*moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${darkColor}"/>`;
    else if(!transparent) rects += `<rect x="${margin+c*moduleSize}" y="${margin+r*moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${lightColor}"/>`;
  }

  const bg = transparent ? "" : `<rect width="${totalSize}" height="${totalSize}" fill="${lightColor}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">${bg}${rects}</svg>`;
};

function TabQR() {
  const [text, setText] = useState("");
  const [darkColor, setDarkColor] = useState("#000000");
  const [lightColor, setLightColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [darkMode, setDarkMode] = useState("picker");
  const [lightMode, setLightMode] = useState("picker");
  const [svgCode, setSvgCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!text.trim()) { setSvgCode(""); return; }
    try {
      const matrix = QR.generate(text);
      setSvgCode(buildQRSVG(matrix, darkColor, lightColor, transparent));
      setError("");
    } catch(e) {
      setError("Texto demasiado largo para generar el QR.");
      setSvgCode("");
    }
  }, [text, darkColor, lightColor, transparent]);

  const previewSvg = svgCode && transparent ? buildQRSVG(QR.generate(text), darkColor, "#ffffff", false) : svgCode;
  const svgUrl = previewSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}` : null;

  const inp = {background:"#0e0e0e",border:"1px solid #2a2a2a",borderRadius:8,color:"#e8e8e0",fontFamily:"inherit",fontSize:13,padding:"10px 14px",outline:"none",width:"100%",resize:"vertical"};
  const swatchBtn = (active) => ({padding:"4px 10px",fontSize:10,fontFamily:"inherit",border:"1px solid",borderColor:active?"#c8f566":"#2a2a2a",borderRadius:5,background:active?"rgba(200,245,102,0.1)":"transparent",color:active?"#c8f566":"#555",cursor:"pointer"});
  const toggleStyle = (on) => ({display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:0});

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
      {/* Left: controls */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* Text input */}
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:20}}>
          <div style={{fontSize:11,color:"#555",letterSpacing:"0.15em",marginBottom:12}}>CONTENIDO DEL QR</div>
          <textarea
            style={{...inp,minHeight:100}}
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder={"URL, texto, email, teléfono..."}
            maxLength={500}
          />
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:11,color:error?"#ff6b6b":"#555"}}>{error||`${text.length} caracteres`}</span>
            <span style={{fontSize:11,color:"#333"}}>{text.length}/500</span>
          </div>
        </div>

        {/* Dark color */}
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:20}}>
          <div style={{fontSize:11,color:"#555",letterSpacing:"0.15em",marginBottom:12}}>COLOR DE MÓDULOS</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <input type="color" className="swatch-input" value={darkColor} onChange={e=>setDarkColor(e.target.value)}/>
            <span style={{fontSize:12,color:"#aaa"}}>{darkColor}</span>
            <div style={{marginLeft:"auto",display:"flex",gap:6}}>
              {["picker","manual"].map(m=><button key={m} style={swatchBtn(darkMode===m)} onClick={()=>setDarkMode(m)}>{m==="picker"?"Visual":"Manual"}</button>)}
            </div>
          </div>
          {darkMode==="manual" && <ColorInputPanel hex={darkColor} onChange={setDarkColor}/>}
        </div>

        {/* Light / background color */}
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:"#555",letterSpacing:"0.15em"}}>COLOR DE FONDO</div>
            <button style={toggleStyle(transparent)} onClick={()=>setTransparent(t=>!t)}>
              <div style={{width:32,height:18,borderRadius:9,background:transparent?"rgba(200,245,102,0.2)":"#2a2a2a",border:`1px solid ${transparent?"#c8f566":"#333"}`,position:"relative",transition:"all 0.2s"}}>
                <div style={{position:"absolute",top:2,left:transparent?14:2,width:12,height:12,borderRadius:"50%",background:transparent?"#c8f566":"#555",transition:"all 0.2s"}}/>
              </div>
              <span style={{fontSize:10,color:transparent?"#c8f566":"#555",letterSpacing:"0.08em"}}>TRANSPARENTE</span>
            </button>
          </div>
          {transparent
            ? <div style={{padding:"10px 14px",background:"repeating-conic-gradient(#1e1e1e 0% 25%, #141414 0% 50%) 0 0 / 16px 16px",borderRadius:8,fontSize:11,color:"#555",textAlign:"center"}}>Sin fondo (transparente)</div>
            : <>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <input type="color" className="swatch-input" value={lightColor} onChange={e=>setLightColor(e.target.value)}/>
                  <span style={{fontSize:12,color:"#aaa"}}>{lightColor}</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    {["picker","manual"].map(m=><button key={m} style={swatchBtn(lightMode===m)} onClick={()=>setLightMode(m)}>{m==="picker"?"Visual":"Manual"}</button>)}
                  </div>
                </div>
                {lightMode==="manual" && <ColorInputPanel hex={lightColor} onChange={setLightColor}/>}
              </>
          }
        </div>
      </div>

      {/* Right: preview + export */}
      <div>
        <div style={{background:"#141414",border:"1px solid #222",borderRadius:16,overflow:"hidden",marginBottom:12}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #1e1e1e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"#555",letterSpacing:"0.1em"}}>PREVIEW</span>
            {transparent && <span style={{fontSize:10,color:"#555",background:"#1a1a1a",padding:"2px 8px",borderRadius:4}}>fondo blanco solo en preview</span>}
          </div>
          <div style={{padding:32,display:"flex",alignItems:"center",justifyContent:"center",minHeight:240,background:"repeating-conic-gradient(#1a1a1a 0% 25%, #141414 0% 50%) 0 0 / 20px 20px"}}>
            {svgUrl
              ? <img src={svgUrl} alt="QR" style={{maxWidth:"80%",maxHeight:280,imageRendering:"pixelated"}}/>
              : <div style={{textAlign:"center",color:"#333",fontSize:13}}>Escribe algo arriba<br/><span style={{fontSize:11,color:"#2a2a2a"}}>para generar el QR</span></div>
            }
          </div>
        </div>
        {svgCode && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button className="btn" onClick={()=>downloadText(svgCode,`QR_code.svg`,"image/svg+xml;charset=utf-8")}
              style={{width:"100%",padding:"12px",background:"#c8f566",color:"#0e0e0e",border:"none",borderRadius:10,fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
              ↓ Descargar SVG
            </button>
            <button className="btn" onClick={()=>exportSVGasPNG(svgCode,`QR_code_300dpi.png`)}
              style={{width:"100%",padding:"12px",background:"#1e1e1e",color:"#e8e8e0",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{fontSize:11,background:"rgba(200,245,102,0.15)",color:"#c8f566",padding:"2px 6px",borderRadius:4}}>300 DPI</span> ↓ Exportar PNG
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP WITH TABS
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id:"svg", label:"Color Changer", icon:"⬡" },
  { id:"barcode", label:"Código de Barras", icon:"▌▌▌" },
  { id:"qr", label:"Código QR", icon:"⊞" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("svg");

  return (
    <div style={{minHeight:"100vh",background:"#0e0e0e",fontFamily:"'DM Mono','Courier New',monospace",color:"#e8e8e0",padding:"40px 24px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#1a1a1a} ::-webkit-scrollbar-thumb{background:#3a3a3a;border-radius:3px}
        .swatch-input{-webkit-appearance:none;appearance:none;width:32px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0;flex-shrink:0}
        .swatch-input::-webkit-color-swatch-wrapper{padding:0;border-radius:6px} .swatch-input::-webkit-color-swatch{border:none;border-radius:6px}
        .drop-zone{transition:all 0.2s ease} .drop-zone:hover{border-color:#c8f566 !important;background:rgba(200,245,102,0.03) !important}
        .btn{transition:all 0.15s ease;cursor:pointer} .btn:hover{transform:translateY(-1px)} .btn:active{transform:translateY(0)}
        .color-row{transition:background 0.15s;cursor:pointer} .color-row:hover{background:rgba(255,255,255,0.04)}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3} input:focus{border-color:#c8f566 !important}
        .tab-btn{transition:all 0.2s ease;cursor:pointer}
      `}</style>

      <div style={{maxWidth:980,margin:"0 auto"}}>
        {/* Header */}
        <div style={{marginBottom:36}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#c8f566"}}/>
            <span style={{fontSize:11,letterSpacing:"0.2em",color:"#666",textTransform:"uppercase"}}>Design Tools</span>
          </div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(28px,4vw,46px)",fontWeight:800,margin:0,lineHeight:1,letterSpacing:"-0.02em"}}>
            SVG<span style={{color:"#c8f566"}}> Weás</span>
          </h1>
        </div>

        {/* Tab bar */}
        <div style={{display:"flex",gap:6,marginBottom:28,borderBottom:"1px solid #1e1e1e",paddingBottom:0}}>
          {TABS.map(tab=>(
            <button key={tab.id} className="tab-btn" onClick={()=>setActiveTab(tab.id)}
              style={{padding:"10px 20px",fontSize:12,fontFamily:"inherit",letterSpacing:"0.08em",border:"none",borderBottom:`2px solid ${activeTab===tab.id?"#c8f566":"transparent"}`,background:"transparent",color:activeTab===tab.id?"#c8f566":"#555",cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:-1}}>
              <span style={{fontSize:14}}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab==="svg" && <TabSVGChanger/>}
        {activeTab==="barcode" && <TabBarcode/>}
        {activeTab==="qr" && <TabQR/>}

        <div style={{marginTop:40,textAlign:"center",fontSize:11,color:"#2a2a2a",letterSpacing:"0.05em"}}>
          SVG Weás · Solo procesa archivos localmente · Creado por Chris Lafken
        </div>
      </div>
    </div>
  );
}