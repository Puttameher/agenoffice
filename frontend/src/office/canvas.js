// 2D Pixel-Art Office Canvas Renderer
// Faithfully recreating the Agentic AI Office with dynamic full-screen coverage and zero squeezing

export const DEFAULT_CANVAS_WIDTH = 1366;
export const DEFAULT_CANVAS_HEIGHT = 680;
export const CANVAS_WIDTH = DEFAULT_CANVAS_WIDTH;
export const CANVAS_HEIGHT = DEFAULT_CANVAS_HEIGHT;

export const DESK_COORDINATES = {
  0: { x: 683, y: 145, label: "CEO (Orchestrator)", agentName: "Jordan", color: "#38bdf8" },
  1: { x: 503, y: 295, label: "Alex (Coding Agent)", agentName: "Alex", color: "#3b82f6", role: "Coding Agent" },
  2: { x: 683, y: 295, label: "Nova (Research Agent)", agentName: "Nova", color: "#a855f7", role: "Research Agent" },
  3: { x: 863, y: 295, label: "Rio (Analysis Agent)", agentName: "Rio", color: "#f97316", role: "Analysis Agent" },
  4: { x: 503, y: 425, label: "Mika (Content Agent)", agentName: "Mika", color: "#10b981", role: "Content Agent" },
  5: { x: 683, y: 425, label: "Zane (Design Agent)", agentName: "Zane", color: "#eab308", role: "Design Agent" },
  6: { x: 863, y: 425, label: "Taro (Operations Agent)", agentName: "Taro", color: "#64748b", role: "Operations Agent" }
};

export const ROOM_BOUNDS = {
  meetingRoom: { x: -9999, y: -9999, w: 0, h: 0, title: "" },
  ceoSuite: { x: 503, y: 16, w: 360, h: 210, title: "CEO (Orchestrator)" },
  serverRoom: { x: 1086, y: 16, w: 260, h: 190, title: "Server Room" },
  lounge: { x: 16, y: 16, w: 260, h: 270, title: "☕ Lounge & Break Hub" },
  teaBreakRoom: { x: 1086, y: 216, w: 260, h: 190, title: "🍵 Tea Break Lounge & Context Synthesizer" },
  taskBoard: { x: 16, y: 300, w: 260, h: 364, title: "Task Board" },
  entrance: { x: 573, y: 535, w: 220, h: 129, title: "Entrance" },
  courtyard: { x: 1086, y: 416, w: 260, h: 248, title: "Courtyard Garden" }
};
ROOM_BOUNDS.contextLab = ROOM_BOUNDS.teaBreakRoom;
ROOM_BOUNDS.focusRoom = ROOM_BOUNDS.teaBreakRoom; // Backward compatibility alias

export const DOOR_COORDINATES = { x: 683, y: 635 };
export const MANAGER_MEETING_SPOT = { x: 683, y: 195 };
export const CAT_COORDINATES = { x: 64, y: 66 };

// Interactive Relaxation & Activity Spots for Idle Roaming
export const RELAXATION_SPOTS = [
  { id: "corner_couch", zone: "lounge", type: "COUCH", name: "Velvet Corner Couch", x: 64, y: 66, sit: true, speech: "I'm relaxing on the corner couch with Pixel 🛋️" },
  { id: "foosball_table", zone: "lounge", type: "PLAYING", name: "Championship Foosball Table", x: 60, y: 155, speech: "I'm playing a quick game of foosball! ⚽" },
  { id: "pinball_machine", zone: "lounge", type: "PLAYING", name: "Super Nova Pinball", x: 215, y: 60, speech: "I'm going for the high score on pinball! 🎯" },
  { id: "chess_table", zone: "lounge", type: "IDLE", name: "Grandmaster Chess Table", x: 170, y: 155, sit: true, speech: "I'm contemplating my next chess opening move ♟️" },
  { id: "coffee_counter", zone: "lounge", type: "COFFEE", name: "Espresso Bar", x: 60, y: 100, speech: "I'm brewing a fresh espresso to recharge ☕" },
  { id: "arcade_cabinet", zone: "lounge", type: "PLAYING", name: "8-Bit Retro Arcade", x: 165, y: 60, speech: "I'm playing retro 8-bit arcade! 👾" },
  { id: "garden_bench_1", zone: "garden", type: "GARDEN_BENCH", name: "Sakura Garden Bench", x: 1150, y: 535, sit: true, speech: "I'm resting peacefully under the cherry blossoms 🌸" },
  { id: "garden_bench_2", zone: "garden", type: "GARDEN_BENCH", name: "Oak Garden Bench", x: 1245, y: 535, sit: true, speech: "I'm relaxing on the wooden garden bench 🍃" },
  { id: "garden_fountain", zone: "garden", type: "GARDEN_WALK", name: "Zen Stone Fountain", x: 1200, y: 475, speech: "Watching gentle ripples in the tranquil fountain 💧" },
  { id: "tea_samovar_bar", zone: "tea_break", type: "TEA_BREAK", name: "Artisan Tea & Samovar Bar", x: 1150, y: 310, speech: "Steeping herbal tea & reflecting on organizational context 🍵" },
  { id: "tea_distillation_core", zone: "tea_break", type: "TEA_BREAK", name: "Vector Context Synthesis Core", speech: "Synthesizing recent workflow context into long-term organizational memory ⚡" },
  // Backward compatibility spots
  { id: "lounge_sofa", zone: "lounge", type: "COUCH", name: "Lounge Sofa", x: 64, y: 66, sit: true },
  { id: "water_cooler", zone: "lounge", type: "COFFEE", name: "Water Cooler", x: 60, y: 100 },
  { id: "lounge_reading_corner", zone: "lounge", type: "IDLE", name: "Lounge Reading Corner", x: 170, y: 155, sit: true },
  { id: "open_hall_collab", zone: "hall", type: "IDLE", name: "Central Commons Collab Area", x: 683, y: 385 },
  { id: "context_tea", zone: "tea_break", type: "TEA_BREAK", name: "Context Tea Bar", x: 1150, y: 310 },
  { id: "context_station", zone: "tea_break", type: "TEA_BREAK", name: "Memory Synthesis Core" }
];

export function updateRelaxationSpotCoordinates() {
  const cy = ROOM_BOUNDS.courtyard;
  const lg = ROOM_BOUNDS.lounge;
  const tb = ROOM_BOUNDS.teaBreakRoom || ROOM_BOUNDS.contextLab;

  const lookup = {
    corner_couch: { x: lg.x + 48, y: lg.y + 50 },
    foosball_table: { x: lg.x + 60, y: lg.y + 155 },
    pinball_machine: { x: lg.x + 215, y: lg.y + 60 },
    chess_table: { x: lg.x + 170, y: lg.y + 155 },
    coffee_counter: { x: lg.x + 60, y: lg.y + 100 },
    arcade_cabinet: { x: lg.x + 165, y: lg.y + 60 },
    lounge_sofa: { x: lg.x + 48, y: lg.y + 50 },
    water_cooler: { x: lg.x + 60, y: lg.y + 100 },
    lounge_reading_corner: { x: lg.x + 170, y: lg.y + 155 },
    garden_bench_1: { x: cy.x + 65, y: cy.y + 120 },
    garden_bench_2: { x: cy.x + cy.w - 75, y: cy.y + 120 },
    garden_fountain: { x: cy.x + Math.round(cy.w / 2), y: cy.y + 70 },
    open_hall_collab: { x: 683, y: 385 },
    tea_samovar_bar: { x: tb.x + 65, y: tb.y + 110 },
    tea_distillation_core: { x: tb.x + tb.w - 65, y: tb.y + 110 },
    context_tea: { x: tb.x + 65, y: tb.y + 110 },
    context_station: { x: tb.x + tb.w - 65, y: tb.y + 110 }
  };

  for (const s of RELAXATION_SPOTS) {
    if (lookup[s.id]) {
      s.x = lookup[s.id].x;
      s.y = lookup[s.id].y;
    }
  }
}

export class OfficeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.worldWidth = DEFAULT_CANVAS_WIDTH;
    this.worldHeight = DEFAULT_CANVAS_HEIGHT;
    this.width = this.worldWidth;
    this.height = this.worldHeight;
    this.canvas.width = DEFAULT_CANVAS_WIDTH;
    this.canvas.height = DEFAULT_CANVAS_HEIGHT;

    // Viewport transform parameters
    this.viewScale = 1;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    this.renderWidth = DEFAULT_CANVAS_WIDTH;
    this.renderHeight = DEFAULT_CANVAS_HEIGHT;

    this.updateViewportDimensions();

    this.workflowStage = "Plan";
    this.tasks = [
      { id: "task_01", title: "Research market trends", status: "In Progress", statusColor: "#10b981", icon: "🔀" },
      { id: "task_02", title: "Build a Python script", status: "Completed", statusColor: "#059669", icon: "🐍" },
      { id: "task_03", title: "Analyze financial data", status: "Pending", statusColor: "#64748b", icon: "📊" },
      { id: "task_04", title: "Create a presentation", status: "Pending", statusColor: "#64748b", icon: "📑" },
      { id: "task_05", title: "Write a blog post", status: "Pending", statusColor: "#64748b", icon: "✍️" }
    ];

    this.catPurr = 0;
    this.heartParticles = [];
    this.steamParticles = [];
    this.petalParticles = [];
    this.arcadeTick = 0;
    this.ledTick = 0;
    this.hoveredDesk = null;
    this.hoveredRoom = null;
    this.hoveredTaskIndex = -1;
    this.warRoomSlide = 0; // 0 = Swarm Graph Topology, 1 = Real-Time Sprint Telemetry, 2 = Consensus Radar Scan
    this.warRoomMeetingActive = false;
    this.nightMode = false;
    this.officeTelemetry = { total_tokens: 0, total_cost_usd: 0, avg_latency_ms: 0 };
  }

  cycleWarRoomSlide() {
    this.warRoomSlide = (this.warRoomSlide + 1) % 3;
    return this.warRoomSlide;
  }

  updateLayout(W, H) {
    const centerX = Math.round(W / 2);
    const leftW = 260;
    const rightW = 260;
    const rwX = W - rightW - 16;

    // 1. Update ROOM_BOUNDS in-place (Strategy War Room removed, Lounge & TaskBoard expanded)
    ROOM_BOUNDS.meetingRoom.x = -9999;
    ROOM_BOUNDS.meetingRoom.y = -9999;
    ROOM_BOUNDS.meetingRoom.w = 0;
    ROOM_BOUNDS.meetingRoom.h = 0;

    ROOM_BOUNDS.lounge.x = 16;
    ROOM_BOUNDS.lounge.y = 16;
    ROOM_BOUNDS.lounge.w = leftW;
    ROOM_BOUNDS.lounge.h = 270;

    ROOM_BOUNDS.taskBoard.x = 16;
    ROOM_BOUNDS.taskBoard.y = ROOM_BOUNDS.lounge.y + ROOM_BOUNDS.lounge.h + 14;
    ROOM_BOUNDS.taskBoard.w = leftW;
    ROOM_BOUNDS.taskBoard.h = Math.max(180, H - ROOM_BOUNDS.taskBoard.y - 16);

    ROOM_BOUNDS.ceoSuite.x = centerX - 180;
    ROOM_BOUNDS.ceoSuite.y = 16;
    ROOM_BOUNDS.ceoSuite.w = 360;
    ROOM_BOUNDS.ceoSuite.h = 210;

    ROOM_BOUNDS.serverRoom.x = rwX;
    ROOM_BOUNDS.serverRoom.y = 16;
    ROOM_BOUNDS.serverRoom.w = rightW;
    ROOM_BOUNDS.serverRoom.h = 190;

    ROOM_BOUNDS.teaBreakRoom.x = rwX;
    ROOM_BOUNDS.teaBreakRoom.y = 216;
    ROOM_BOUNDS.teaBreakRoom.w = rightW;
    ROOM_BOUNDS.teaBreakRoom.h = 190;
    ROOM_BOUNDS.contextLab = ROOM_BOUNDS.teaBreakRoom;
    ROOM_BOUNDS.focusRoom = ROOM_BOUNDS.teaBreakRoom;

    ROOM_BOUNDS.courtyard.x = rwX;
    ROOM_BOUNDS.courtyard.y = 416;
    ROOM_BOUNDS.courtyard.w = rightW;
    ROOM_BOUNDS.courtyard.h = Math.max(180, H - 416 - 16);

    ROOM_BOUNDS.entrance.x = centerX - 110;
    ROOM_BOUNDS.entrance.y = Math.min(H - 145, 535);
    ROOM_BOUNDS.entrance.w = 220;
    ROOM_BOUNDS.entrance.h = H - ROOM_BOUNDS.entrance.y - 16;

    // 2. Update DESK_COORDINATES in-place (Broadly spread across central hall)
    const openWidth = rwX - 16 - (leftW + 32);
    const deskSpacingX = Math.round(openWidth / 3.2);

    DESK_COORDINATES[0].x = centerX;
    DESK_COORDINATES[0].y = 145;

    DESK_COORDINATES[1].x = centerX - deskSpacingX;
    DESK_COORDINATES[1].y = 290;

    DESK_COORDINATES[2].x = centerX;
    DESK_COORDINATES[2].y = 290;

    DESK_COORDINATES[3].x = centerX + deskSpacingX;
    DESK_COORDINATES[3].y = 290;

    DESK_COORDINATES[4].x = centerX - deskSpacingX;
    DESK_COORDINATES[4].y = 445;

    DESK_COORDINATES[5].x = centerX;
    DESK_COORDINATES[5].y = 445;

    DESK_COORDINATES[6].x = centerX + deskSpacingX;
    DESK_COORDINATES[6].y = 445;

    // 3. Key Navigation Spots
    DOOR_COORDINATES.x = centerX;
    DOOR_COORDINATES.y = H - 45;

    MANAGER_MEETING_SPOT.x = centerX;
    MANAGER_MEETING_SPOT.y = 195;

    CAT_COORDINATES.x = ROOM_BOUNDS.lounge.x + 48;
    CAT_COORDINATES.y = ROOM_BOUNDS.lounge.y + 50;

    // 4. Update Relaxation & Exploration Spots
    updateRelaxationSpotCoordinates();
  }

  updateViewportDimensions() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const pw = parent.clientWidth || window.innerWidth;
    const ph = parent.clientHeight || window.innerHeight;

    // Set internal canvas buffer to match pixel size for razor-sharp rendering
    if (pw > 0 && ph > 0) {
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.renderWidth = pw;
      this.renderHeight = ph;

      const baseH = DEFAULT_CANVAS_HEIGHT;
      // Calculate uniform scale strictly proportional without squeezing
      let scale = ph / baseH;
      let targetW = Math.round(pw / scale);

      // On narrower viewports (like drawer open on smaller screens), clamp minimum world width so rooms don't crowd
      const minW = 1180;
      if (targetW < minW) {
        targetW = minW;
        scale = Math.min(pw / minW, ph / baseH);
      }

      this.viewScale = scale;
      this.worldWidth = targetW;
      this.worldHeight = baseH;
      this.width = targetW;
      this.height = baseH;

      // Center only if aspect ratio clamping forces a letterbox margin
      this.viewOffsetX = Math.max(0, (pw - this.worldWidth * this.viewScale) / 2);
      this.viewOffsetY = Math.max(0, (ph - this.worldHeight * this.viewScale) / 2);

      // Dynamically reposition rooms, desks, cat, and portals to cover the full width
      this.updateLayout(this.worldWidth, this.worldHeight);
    }
  }

  setWorkflowStage(stage) {
    this.workflowStage = stage;
  }

  updateTasks(taskList) {
    if (!taskList) return;
    const defaultBacklog = [
      { user_input: "Analyze quarterly KPIs", status: "completed" },
      { user_input: "Deploy vector database", status: "completed" },
      { user_input: "Run unit test suite", status: "completed" },
      { user_input: "Optimize LLM routing latency", status: "completed" }
    ];

    const combined = [...taskList];
    for (const item of defaultBacklog) {
      if (combined.length >= 5) break;
      if (!combined.some(t => (t.user_input || t.title) === item.user_input)) {
        combined.push(item);
      }
    }

    this.tasks = combined.slice(0, 5).map((t, idx) => {
      let statusLabel = "Pending";
      let statusColor = "#64748b";
      let icon = "📊";
      if (t.status === "in_progress" || t.status === "working") {
        statusLabel = "In Progress";
        statusColor = "#10b981";
      } else if (t.status === "completed") {
        statusLabel = "Completed";
        statusColor = "#059669";
      }
      const text = t.user_input || t.title || "Task";
      if (text.toLowerCase().includes("python") || text.toLowerCase().includes("script") || text.toLowerCase().includes("test")) icon = "🐍";
      else if (text.toLowerCase().includes("market") || text.toLowerCase().includes("research")) icon = "🔀";
      else if (text.toLowerCase().includes("finance") || text.toLowerCase().includes("compounding") || text.toLowerCase().includes("kpi")) icon = "📊";
      else if (text.toLowerCase().includes("present") || text.toLowerCase().includes("design")) icon = "📑";
      else if (text.toLowerCase().includes("blog") || text.toLowerCase().includes("write")) icon = "✍️";
      else if (text.toLowerCase().includes("deploy") || text.toLowerCase().includes("database") || text.toLowerCase().includes("llm")) icon = "⚡";

      return {
        id: t.id || `task_${idx}`,
        title: text.length > 24 ? text.substring(0, 22) + "..." : text,
        fullTitle: text,
        status: statusLabel,
        statusColor,
        icon
      };
    });
  }

  addHeart(x, y) {
    for (let i = 0; i < 5; i++) {
      this.heartParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 10 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1.5 - Math.random() * 1.5,
        alpha: 1.0,
        size: 10 + Math.random() * 6
      });
    }
  }

  render(characters = [], catState = {}, deskOccupants = {}) {
    const ctx = this.ctx;
    this.ledTick += 0.05;
    this.arcadeTick += 0.08;

    // Fill entire client canvas backdrop
    ctx.fillStyle = "#080c14";
    ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);

    // Save and apply uniform aspect scale & centering
    ctx.save();
    ctx.translate(this.viewOffsetX, this.viewOffsetY);
    ctx.scale(this.viewScale, this.viewScale);

    // Office perimeter background
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

    // 1. Flooring for all zones
    this.drawFlooring();

    // 2. Room Walls & Partitions
    this.drawArchitecture();

    // 3. Zone Furniture & Props
    this.drawCeoSuite();
    this.drawServerRoom();
    this.drawLounge();
    this.drawTeaBreakRoom();
    this.drawOpenOfficeDesks(deskOccupants);
    this.drawEntrance();
    this.drawCourtyard();
    this.drawTaskBoard();

    // 4. Characters
    for (const char of characters) {
      char.draw(ctx);
    }

    // 5. Office Cat
    this.drawCat(catState);

    // 6. Particles (Hearts & Tea Steam)
    this.drawParticles();

    // 7. Night Mode Lighting & Warm Monitor Glow Shader Pass
    if (this.nightMode) {
      this.drawNightLighting(deskOccupants);
    }

    ctx.restore();
  }

  drawNightLighting(deskOccupants) {
    const ctx = this.ctx;
    ctx.save();
    // Ambient dark room overlay
    ctx.fillStyle = "rgba(8, 12, 28, 0.45)";
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

    // Warm CEO Desk Glow
    const ceoDesk = DESK_COORDINATES[0];
    if (ceoDesk) {
      const g0 = ctx.createRadialGradient(ceoDesk.x, ceoDesk.y - 5, 4, ceoDesk.x, ceoDesk.y - 5, 75);
      g0.addColorStop(0, "rgba(251, 191, 36, 0.3)");
      g0.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = g0;
      ctx.beginPath();
      ctx.arc(ceoDesk.x, ceoDesk.y - 5, 75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Workstation Monitor Screen Glows (Desks 1 to 6)
    for (let id = 1; id <= 6; id++) {
      const d = DESK_COORDINATES[id];
      if (!d) continue;
      const g = ctx.createRadialGradient(d.x, d.y + 18, 4, d.x, d.y + 18, 60);
      g.addColorStop(0, "rgba(56, 189, 248, 0.28)");
      g.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y + 18, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Server Room Emerald Glow
    const sr = ROOM_BOUNDS.serverRoom;
    if (sr) {
      const gSr = ctx.createRadialGradient(sr.x + 80, sr.y + 60, 4, sr.x + 80, sr.y + 60, 85);
      gSr.addColorStop(0, "rgba(16, 185, 129, 0.25)");
      gSr.addColorStop(1, "rgba(16, 185, 129, 0)");
      ctx.fillStyle = gSr;
      ctx.beginPath();
      ctx.arc(sr.x + 80, sr.y + 60, 85, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- 1. FLOORING ---
  drawFlooring() {
    const ctx = this.ctx;
    const W = this.worldWidth;
    const H = this.worldHeight;
    const leftW = ROOM_BOUNDS.lounge.w;
    const rwX = ROOM_BOUNDS.serverRoom.x;

    // A. Main Open Office Floor (Warm polished wood parquet) spanning between wings
    const floorX = leftW + 32;
    const floorY = 226;
    const floorW = (rwX - 16) - floorX;
    const floorH = H - 16 - floorY;

    ctx.fillStyle = "#a8713d";
    ctx.fillRect(floorX, floorY, floorW, floorH);

    // Wood planks pattern
    const plankW = 55;
    const plankH = 22;
    for (let x = floorX; x < floorX + floorW; x += plankW) {
      for (let y = floorY; y < floorY + floorH; y += plankH) {
        const alt = ((Math.floor(x / plankW)) + (Math.floor(y / plankH))) % 2 === 0;
        const curW = Math.min(plankW, floorX + floorW - x);
        const curH = Math.min(plankH, floorY + floorH - y);
        ctx.fillStyle = alt ? "#b57b45" : "#9e6635";
        ctx.fillRect(x, y, curW, curH);
        ctx.strokeStyle = "#804d22";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, curW, curH);
      }
    }

    // CEO Suite Floor Corridor
    const cs = ROOM_BOUNDS.ceoSuite;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cs.x, cs.y, cs.w, cs.h);

    // B. Server Room Flooring (High-tech dark cyber grid)
    const sr = ROOM_BOUNDS.serverRoom;
    ctx.fillStyle = "#090d16";
    ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
    for (let x = sr.x; x < sr.x + sr.w; x += 20) {
      for (let y = sr.y; y < sr.y + sr.h; y += 20) {
        ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, Math.min(20, sr.x + sr.w - x), Math.min(20, sr.y + sr.h - y));
      }
    }

    // D. Lounge Flooring (Warm wood & terracotta rug)
    const lg = ROOM_BOUNDS.lounge;
    ctx.fillStyle = "#8a5027";
    ctx.fillRect(lg.x, lg.y, lg.w, lg.h);

    // Lounge Patterned Rug
    ctx.fillStyle = "#b45309";
    ctx.fillRect(lg.x + 15, lg.y + 25, lg.w - 30, lg.h - 45);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(lg.x + 15, lg.y + 25, lg.w - 30, lg.h - 45);

    // E. Tea Break & Context Lounge Flooring (Warm amber-teak with glowing data circuits)
    const cl = ROOM_BOUNDS.teaBreakRoom || ROOM_BOUNDS.contextLab || ROOM_BOUNDS.focusRoom;
    ctx.fillStyle = "#542a08";
    ctx.fillRect(cl.x, cl.y, cl.w, cl.h);
    for (let y = cl.y; y < cl.y + cl.h; y += 18) {
      ctx.strokeStyle = "#4d2305";
      ctx.strokeRect(cl.x, y, cl.w, Math.min(18, cl.y + cl.h - y));
    }
    // Glowing cyan memory data circuit conduits leading to central memory core
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cl.x + 20, cl.y + 45);
    ctx.lineTo(cl.x + cl.w / 2, cl.y + 45);
    ctx.lineTo(cl.x + cl.w / 2, cl.y + 105);
    ctx.moveTo(cl.x + cl.w - 20, cl.y + 45);
    ctx.lineTo(cl.x + cl.w / 2, cl.y + 45);
    ctx.stroke();
    // Glowing circuit node pads
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(cl.x + 18, cl.y + 43, 5, 5);
    ctx.fillRect(cl.x + cl.w - 23, cl.y + 43, 5, 5);

    // F. Courtyard Garden Flooring (Lush emerald grass, wildflowers & stone pathway)
    const cy = ROOM_BOUNDS.courtyard;
    // Deep emerald green grass lawn
    ctx.fillStyle = "#15803d";
    ctx.fillRect(cy.x, cy.y, cy.w, cy.h);

    // Textured grass blades
    ctx.fillStyle = "#166534";
    for (let gx = cy.x + 6; gx < cy.x + cy.w - 6; gx += 16) {
      for (let gy = cy.y + 6; gy < cy.y + cy.h - 6; gy += 16) {
        if ((gx + gy) % 3 === 0) {
          ctx.fillRect(gx, gy, 3, 2);
          ctx.fillRect(gx + 1, gy - 2, 2, 3);
        }
      }
    }

    // Blooming colorful wildflowers scattered in grass
    const flowerColors = ["#f472b6", "#fde047", "#c084fc", "#ffffff", "#fb923c"];
    for (let fx = cy.x + 12; fx < cy.x + cy.w - 12; fx += 22) {
      for (let fy = cy.y + 12; fy < cy.y + cy.h - 12; fy += 24) {
        if ((fx * 7 + fy * 13) % 5 === 0) {
          const col = flowerColors[(fx + fy) % flowerColors.length];
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(fx, fy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Rustic Cobblestone Pathway curving through the nature lawn
    const stones = [
      { x: cy.x + 20, y: cy.y + 50, w: 24, h: 14 },
      { x: cy.x + 50, y: cy.y + 60, w: 22, h: 13 },
      { x: cy.x + Math.round(cy.w / 2) - 15, y: cy.y + 115, w: 30, h: 16 },
      { x: cy.x + Math.round(cy.w / 2) - 18, y: cy.y + 145, w: 36, h: 18 },
      { x: cy.x + Math.round(cy.w / 2) - 20, y: cy.y + 175, w: 40, h: 20 },
      { x: cy.x + 45, y: cy.y + 145, w: 24, h: 14 },
      { x: cy.x + cy.w - 70, y: cy.y + 145, w: 24, h: 14 },
    ];
    for (const st of stones) {
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.roundRect(st.x, st.y, st.w, st.h, 4);
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(st.x + 3, st.y + 2, st.w - 6, 2);
    }
  }

  // --- 2. ARCHITECTURE & WALLS ---
  drawArchitecture() {
    const ctx = this.ctx;
    const wallColor = "#161d2a";
    const wallTop = "#283446";
    const wallHighlight = "#3b4d66";

    // Helper: draw a thick pixel wall with beveled 3D depth
    const drawWall = (x, y, w, h) => {
      ctx.fillStyle = wallColor;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = wallTop;
      ctx.fillRect(x, y, w, Math.min(6, h));
      ctx.fillStyle = wallHighlight;
      ctx.fillRect(x, y, w, 2);
    };

    const W = this.worldWidth;
    const H = this.worldHeight;
    const centerX = Math.round(W / 2);
    const leftW = ROOM_BOUNDS.lounge.w;
    const rightW = ROOM_BOUNDS.serverRoom.w;
    const rwX = ROOM_BOUNDS.serverRoom.x;

    // Outer Perimeter Walls spanning exact world borders
    drawWall(0, 0, W, 16); // Top
    drawWall(0, 0, 16, H); // Left
    drawWall(W - 16, 0, 16, H); // Right
    drawWall(0, H - 16, W, 16); // Bottom

    // Vertical Left Divider (separating Lounge & Task Board from center)
    drawWall(leftW + 16, 0, 16, H - 16);

    // Horizontal divider on Left Wing (between Lounge and Task Board)
    drawWall(16, ROOM_BOUNDS.lounge.y + ROOM_BOUNDS.lounge.h, leftW, 12);

    // Vertical Right Divider (separating Server Room & Tea Break Lounge from center)
    drawWall(rwX - 16, 0, 16, H - 16);

    // Horizontal dividers on Right Wing
    drawWall(rwX, 206, rightW, 12);
    drawWall(rwX, 406, rightW, 12);

    // Top CEO Suite Walls
    drawWall(centerX - 180, 0, 16, 226);
    drawWall(centerX + 180 - 16, 0, 16, 226);

    // Entrance Portals / Doorways
    ctx.fillStyle = "#334155";
    ctx.fillRect(leftW + 12, ROOM_BOUNDS.lounge.y + 115, 24, 22);
    ctx.fillRect(rwX - 20, 150, 24, 22);
    ctx.fillRect(rwX - 20, 310, 24, 22);
    ctx.fillRect(centerX - 184, 180, 24, 22);
    ctx.fillRect(centerX + 160, 180, 24, 22);

    // Window panes on outer top wall (spaced evenly across width)
    const winCount = Math.max(4, Math.floor(W / 140));
    const winSpacing = W / winCount;
    for (let i = 0; i < winCount; i++) {
      const wx = Math.round(i * winSpacing + winSpacing / 2 - 25);
      if (Math.abs(wx - centerX) > 175) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
        ctx.fillRect(wx, 3, 50, 10);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(wx, 3, 50, 10);
      }
    }

    // Window panes on left wall
    for (const wy of [100, 310, 510]) {
      if (wy < H - 50) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.06)";
        ctx.fillRect(2, wy, 12, 38);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(2, wy, 12, 38);
      }
    }

    // Window panes on right wall
    for (const wy of [100, 310, 510]) {
      if (wy < H - 50) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.06)";
        ctx.fillRect(W - 14, wy, 12, 38);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(W - 14, wy, 12, 38);
      }
    }
  }

  // --- 3. EXECUTIVE STRATEGY WAR ROOM ---
  drawMeetingRoom() {
    const ctx = this.ctx;
    const mr = ROOM_BOUNDS.meetingRoom;

    // Room Label Pill Badge
    this.drawRoomBadge(mr.x + mr.w / 2, mr.y + 205, "💡 Executive Strategy War Room");

    // Ceiling Hologram Laser Emitters (Mounts on ceiling casting volumetric beams)
    const emX1 = mr.x + 60;
    const emX2 = mr.x + mr.w - 60;
    const emY = mr.y + 2;

    for (const emX of [emX1, emX2]) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(emX - 6, emY, 12, 5);
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(emX, emY + 5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Soft volumetric conical laser beam down onto screen and table
      const beamGrad = ctx.createLinearGradient(emX, emY + 5, emX, emY + 75);
      beamGrad.addColorStop(0, "rgba(56, 189, 248, 0.22)");
      beamGrad.addColorStop(0.6, "rgba(168, 85, 247, 0.08)");
      beamGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(emX - 2, emY + 5);
      ctx.lineTo(emX + 2, emY + 5);
      ctx.lineTo(emX + 35, emY + 75);
      ctx.lineTo(emX - 35, emY + 75);
      ctx.closePath();
      ctx.fill();
    }

    // A. Wall-Spanning Panoramic Curved Presentation Theater Display
    const wbX = mr.x + 8;
    const wbY = mr.y + 10;
    const wbW = mr.w - 16;
    const wbH = 76;

    // Outer Obsidian & Brushed Titanium Bezel
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.roundRect(wbX, wbY, wbW, wbH, 7);
    ctx.fill();

    // Dual neon glowing edge (Cyan outer, Indigo inner)
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(168, 85, 247, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(wbX + 2, wbY + 2, wbW - 4, wbH - 4);

    // Screen HUD Header: Live Status & Slide Switcher
    const isLive = Math.sin(this.ledTick * 3) > 0;
    ctx.fillStyle = isLive ? "#10b981" : "#047857";
    ctx.beginPath();
    ctx.arc(wbX + 12, wbY + 11, 3, 0, Math.PI * 2);
    ctx.fill();

    const slide = (this.warRoomSlide || 0) % 3;
    const slideTitles = [
      "SWARM GRAPH TOPOLOGY",
      "REAL-TIME TELEMETRY",
      "CONSENSUS RADAR SCAN"
    ];
    const slideTags = ["[SLIDE 1/3]", "[SLIDE 2/3]", "[SLIDE 3/3]"];

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`WAR ROOM • ${slideTitles[slide]}`, wbX + 20, wbY + 13);

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 6.5px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${slideTags[slide]} ⇄ CLICK`, wbX + wbW - 8, wbY + 13);

    // Screen Inner Display Canvas
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fillRect(wbX + 6, wbY + 18, wbW - 12, wbH - 24);

    // Render Dynamic Content based on Active Slide
    if (slide === 0) {
      // --- SLIDE 0: SWARM GRAPH TOPOLOGY ---
      const nodes = [
        { name: "Jordan", color: "#fbbf24", x: wbX + 24, y: wbY + 36 },
        { name: "Alex", color: "#38bdf8", x: wbX + 62, y: wbY + 27 },
        { name: "Nova", color: "#a855f7", x: wbX + 62, y: wbY + 46 },
        { name: "Rio", color: "#f97316", x: wbX + 118, y: wbY + 27 },
        { name: "Mika", color: "#10b981", x: wbX + 118, y: wbY + 46 },
        { name: "Critic", color: "#ec4899", x: wbX + 172, y: wbY + 36 },
        { name: "Memory", color: "#06b6d4", x: wbX + 214, y: wbY + 36 }
      ];

      // Connecting Glowing Data Bus Lines
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[1].x, nodes[1].y);
      ctx.lineTo(nodes[3].x, nodes[3].y);
      ctx.lineTo(nodes[5].x, nodes[5].y);
      ctx.lineTo(nodes[6].x, nodes[6].y);
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[2].x, nodes[2].y);
      ctx.lineTo(nodes[4].x, nodes[4].y);
      ctx.lineTo(nodes[5].x, nodes[5].y);
      ctx.stroke();

      // Animated Glowing Data Packets Gliding on Lines
      const pulseProg = (this.ledTick * 30) % (wbW - 40);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(wbX + 20 + pulseProg, wbY + 36 + Math.sin(pulseProg * 0.1) * 6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Nodes
      for (const n of nodes) {
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 6px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.name, n.x, n.y + 11);
      }

      // Bottom Telemetry Strip
      ctx.fillStyle = "#94a3b8";
      ctx.font = "6px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("SWARM FLOW: 28.4 msg/s • ZERO-HALLUCINATION", wbX + 10, wbY + wbH - 9);

    } else if (slide === 1) {
      // --- SLIDE 1: REAL-TIME TELEMETRY & SPRINT METRICS ---
      const bars = [
        { label: "Code", val: 0.85 + Math.sin(this.ledTick * 2) * 0.12, color: "#38bdf8" },
        { label: "Rsrch", val: 0.78 + Math.sin(this.ledTick * 2.5 + 1) * 0.15, color: "#a855f7" },
        { label: "Anlys", val: 0.92 + Math.sin(this.ledTick * 3 + 2) * 0.06, color: "#f97316" },
        { label: "Cont", val: 0.80 + Math.sin(this.ledTick * 2.2 + 3) * 0.14, color: "#10b981" },
        { label: "Ops", val: 0.88 + Math.sin(this.ledTick * 2.8 + 4) * 0.08, color: "#fbbf24" }
      ];

      const barW = 18;
      const maxH = 28;
      const startX = wbX + 18;
      const baseBarY = wbY + 54;

      // Dashed Target Threshold Line (90% target)
      ctx.strokeStyle = "rgba(244, 63, 94, 0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(startX - 6, baseBarY - maxH * 0.9);
      ctx.lineTo(startX + bars.length * 28 + 6, baseBarY - maxH * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);

      bars.forEach((b, idx) => {
        const bx = startX + idx * 28;
        const bh = Math.max(6, Math.min(maxH, b.val * maxH));
        const by = baseBarY - bh;

        ctx.fillStyle = b.color;
        ctx.fillRect(bx, by, barW, bh);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bx, by, barW, 2); // Neon cap

        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 5.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(b.label, bx + barW / 2, baseBarY + 8);
      });

      // Right-side accuracy gauge
      const gaugeX = wbX + wbW - 46;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(gaugeX - 28, wbY + 24, 68, 36);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.strokeRect(gaugeX - 28, wbY + 24, 68, 36);

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("99.8%", gaugeX + 6, wbY + 40);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "6px 'Inter', sans-serif";
      ctx.fillText("ACCURACY RATE", gaugeX + 6, wbY + 52);

    } else {
      // --- SLIDE 2: MULTI-AGENT CONSENSUS RADAR SCAN ---
      const rx = wbX + 42;
      const ry = wbY + 44;
      const maxR = 24;

      // Concentric radar circles
      for (const r of [8, 16, maxR]) {
        ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.beginPath();
      ctx.moveTo(rx - maxR, ry);
      ctx.lineTo(rx + maxR, ry);
      ctx.moveTo(rx, ry - maxR);
      ctx.lineTo(rx, ry + maxR);
      ctx.stroke();

      // Rotating radar sweep line
      const sweepAngle = (this.ledTick * 2.2) % (Math.PI * 2);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(sweepAngle) * maxR, ry + Math.sin(sweepAngle) * maxR);
      ctx.stroke();

      // Agent blips on radar
      const blips = [
        { a: 0.8, r: 14, name: "Jordan" },
        { a: 2.2, r: 18, name: "Alex" },
        { a: 3.8, r: 12, name: "Nova" },
        { a: 5.1, r: 20, name: "Rio" }
      ];

      for (const bl of blips) {
        const bx = rx + Math.cos(bl.a) * bl.r;
        const by = ry + Math.sin(bl.a) * bl.r;
        const isHit = Math.abs(sweepAngle - bl.a) < 0.6;
        ctx.fillStyle = isHit ? "#ffffff" : "#10b981";
        ctx.beginPath();
        ctx.arc(bx, by, isHit ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Right-side consensus readout table
      const listX = wbX + 88;
      ctx.font = "bold 6.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";

      ctx.fillStyle = "#38bdf8";
      ctx.fillText("● JORDAN (CEO): ALIGNED", listX, wbY + 30);
      ctx.fillStyle = "#34d399";
      ctx.fillText("● ALEX (CODE):  0.99 VOTE", listX, wbY + 40);
      ctx.fillText("● NOVA (RSRCH): 0.98 VOTE", listX, wbY + 50);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("★ CONSENSUS: 100% UNANIMOUS", listX, wbY + 60);
    }

    // B. Agile Kanban Post-It Strategy Wall on Left
    const stickyX = mr.x + 8;
    const stickyY = mr.y + 92;
    const stickyNotes = [
      { text: "Swarm Sync", bg: "#fef08a", color: "#854d0e" },
      { text: "Zero-Halluc", bg: "#bbf7d0", color: "#166534" },
      { text: "Vector RAG", bg: "#bfdbfe", color: "#1e40af" },
      { text: "Tea Distill", bg: "#fbcfe8", color: "#9d174d" }
    ];
    for (let i = 0; i < stickyNotes.length; i++) {
      const ny = stickyY + i * 22;
      ctx.fillStyle = stickyNotes[i].bg;
      ctx.fillRect(stickyX, ny, 32, 17);
      ctx.fillStyle = stickyNotes[i].color;
      ctx.font = "bold 5.5px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(stickyNotes[i].text, stickyX + 16, ny + 11);
    }

    // C. High-Tech Obsidian & Midnight Glass Stadium Conference Table
    const tblW = 114;
    const tblH = 70;
    const tblX = mr.x + Math.round((mr.w - tblW) / 2) + 16;
    const tblY = mr.y + 104;

    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(tblX + tblW / 2, tblY + tblH / 2 + 5, tblW / 2 + 6, tblH / 2 + 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Obsidian Glass Table Surface
    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.ellipse(tblX + tblW / 2, tblY + tblH / 2, tblW / 2, tblH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Table inner cyan illuminated rim
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(tblX + tblW / 2, tblY + tblH / 2, tblW / 2 - 5, tblH / 2 - 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // D. 3D Rotating AI Hologram Core Centerpiece & Swarm Rings!
    const holoX = tblX + tblW / 2;
    const holoY = tblY + tblH / 2;

    // Center emitter pad
    ctx.fillStyle = "#06b6d4";
    ctx.beginPath();
    ctx.ellipse(holoX, holoY, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Acoustic Telepresence Soundwave Ripples
    const rip = (this.ledTick * 2) % 1;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.8 - rip * 0.8})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(holoX, holoY, 13 + rip * 12, 7 + rip * 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3D Rotating Gimbal Wireframe Rings
    const spin1 = this.ledTick * 1.5;
    const spin2 = -this.ledTick * 1.8;
    const spin3 = this.ledTick * 0.9;
    const rad = 14;

    // Ring 1 (Cyan)
    ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(holoX, holoY - 9, rad, rad * 0.45, spin1, 0, Math.PI * 2);
    ctx.stroke();

    // Ring 2 (Purple)
    ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
    ctx.beginPath();
    ctx.ellipse(holoX, holoY - 9, rad * 0.85, rad * 0.4, spin2, 0, Math.PI * 2);
    ctx.stroke();

    // Ring 3 (Amber energy equator)
    ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
    ctx.beginPath();
    ctx.ellipse(holoX, holoY - 9, rad * 0.65, rad * 0.3, spin3, 0, Math.PI * 2);
    ctx.stroke();

    // Central Pulsing Energy Core
    const pulseSize = 4 + Math.sin(this.ledTick * 4) * 1.2;
    const coreGrad = ctx.createRadialGradient(holoX, holoY - 9, 0, holoX, holoY - 9, pulseSize + 2);
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.5, "#38bdf8");
    coreGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(holoX, holoY - 9, pulseSize + 2, 0, Math.PI * 2);
    ctx.fill();

    // 6 Orbiting Swarm Data Particles in 3D perspective
    for (let sp = 0; sp < 6; sp++) {
      const sa = spin1 + (sp * Math.PI) / 3;
      const orbR = 12 + (sp % 2) * 3;
      const sx = holoX + Math.cos(sa) * orbR;
      const sy = holoY - 9 + Math.sin(sa) * (orbR * 0.48);
      ctx.fillStyle = (sp % 2 === 0) ? "#38bdf8" : "#fbbf24";
      ctx.fillRect(sx - 1, sy - 1, 2.5, 2.5);
    }

    // Embedded Personal Touchscreens on Table (for each seat)
    const screens = [
      { x: tblX + 22, y: tblY + 8, w: 14, h: 8, col: "#38bdf8" },
      { x: tblX + tblW - 36, y: tblY + 8, w: 14, h: 8, col: "#a855f7" },
      { x: tblX + 22, y: tblY + tblH - 16, w: 14, h: 8, col: "#10b981" },
      { x: tblX + tblW - 36, y: tblY + tblH - 16, w: 14, h: 8, col: "#f97316" },
      { x: tblX + 6, y: tblY + tblH / 2 - 4, w: 8, h: 12, col: "#fbbf24" },
      { x: tblX + tblW - 14, y: tblY + tblH / 2 - 4, w: 8, h: 12, col: "#38bdf8" }
    ];

    for (const sc of screens) {
      ctx.fillStyle = "#020617";
      ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
      ctx.fillStyle = sc.col;
      ctx.fillRect(sc.x + 1.5, sc.y + 1.5, sc.w - 3, sc.h - 3);
    }

    // Executive Chrome Water Carafe & Glasses
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(tblX + 44, tblY + tblH / 2 - 4, 5, 8);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(tblX + 51, tblY + tblH / 2 - 2, 3, 4);

    // E. 6 Luxury Ergonomic High-Back Executive Swivel Chairs
    const drawChair = (cx, cy, isExecutive = false) => {
      // Chrome 5-star base shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(cx - 7, cy + 6, 14, 4);

      // Contoured leather seat & high backrest
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.roundRect(cx - 9, cy - 8, 18, 16, 4);
      ctx.fill();

      // Chrome armrests and trim
      ctx.strokeStyle = isExecutive ? "#fbbf24" : "#38bdf8";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Inner leather cushion
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - 6, cy - 5, 12, 10);

      // Status headrest indicator
      ctx.fillStyle = isExecutive ? "#fbbf24" : "#10b981";
      ctx.fillRect(cx - 3, cy - 8, 6, 2);
    };

    // 2 Top, 2 Bottom, 1 Left (CEO chair), 1 Right
    drawChair(tblX + 26, tblY - 10, false);
    drawChair(tblX + tblW - 26, tblY - 10, false);
    drawChair(tblX + 26, tblY + tblH + 10, false);
    drawChair(tblX + tblW - 26, tblY + tblH + 10, false);
    drawChair(tblX - 10, tblY + tblH / 2, true); // Executive Chair
    drawChair(tblX + tblW + 10, tblY + tblH / 2, false);

    // Decorative Executive Bonsai/Plant
    this.drawPottedPlant(mr.x + mr.w - 18, mr.y + 110, 13);
  }

  // --- 4. CEO SUITE (ORCHESTRATOR) ---
  drawCeoSuite() {
    const ctx = this.ctx;
    const cs = ROOM_BOUNDS.ceoSuite;

    // A. Minimalist Executive Glass Architectural Panel
    const bW = 240;
    const bH = 65;
    const bX = cs.x + Math.round((cs.w - bW) / 2);
    const bY = cs.y + 12;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(bX, bY, bW, bH, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Discreet Gold Geometric Line
    ctx.strokeStyle = "rgba(234, 179, 8, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bX + 30, bY + 34);
    ctx.lineTo(bX + bW - 30, bY + 34);
    ctx.stroke();

    // Subtle Executive Status
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EXECUTIVE SUITE", bX + bW / 2, bY + 24);

    ctx.font = "600 8.5px 'Inter', sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Jordan • Orchestration Hub", bX + bW / 2, bY + 50);

    // B. Executive Crimson Carpet with Gold Border
    const carpetW = 260;
    const carpetH = 100;
    const carpetX = cs.x + Math.round((cs.w - carpetW) / 2);
    const carpetY = cs.y + 95;

    ctx.fillStyle = "#991b1b";
    ctx.fillRect(carpetX, carpetY, carpetW, carpetH);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(carpetX + 4, carpetY + 4, carpetW - 8, carpetH - 8);

    // C. Bookshelves & Trophies flanking CEO
    this.drawBookshelf(cs.x + 8, cs.y + 15, 18, 55);
    this.drawBookshelf(cs.x + cs.w - 26, cs.y + 15, 18, 55);

    // Potted plants flanking the carpet
    this.drawPottedPlant(cs.x + 20, cs.y + 105, 14);
    this.drawPottedPlant(cs.x + cs.w - 20, cs.y + 105, 14);

    // D0. Executive High-Back Leather Swivel Chair (Jordan sits here at cs.y + 130 facing south)
    const ceoChairX = cs.x + Math.round(cs.w / 2);
    const ceoChairY = cs.y + 114;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(ceoChairX, ceoChairY + 6, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // 5-Star Chrome Caster Base
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 5) {
      ctx.beginPath();
      ctx.moveTo(ceoChairX, ceoChairY);
      ctx.lineTo(ceoChairX + Math.cos(a) * 15, ceoChairY + Math.sin(a) * 15);
      ctx.stroke();
    }
    // Deep Midnight High-Back Executive Leather Seat
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(ceoChairX - 16, ceoChairY - 14, 32, 28, 6);
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner plush leather cushion
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(ceoChairX - 12, ceoChairY - 10, 24, 20);
    // Gold headrest trim
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(ceoChairX - 6, ceoChairY - 14, 12, 3);

    // D. Executive Mahogany Desk
    const dW = 180;
    const dH = 55;
    const dX = cs.x + Math.round((cs.w - dW) / 2);
    const dY = cs.y + 125;

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(dX + 5, dY + 5, dW, dH);

    ctx.fillStyle = "#5c2411";
    ctx.beginPath();
    ctx.roundRect(dX, dY, dW, dH, 6);
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gold desk trim & logo emblem
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1;
    ctx.strokeRect(dX + 6, dY + 6, dW - 12, dH - 12);

    // E. Triple Widescreen Monitors
    const monW = 30;
    const monH = 20;
    const monY = dY + 10;

    // Left monitor (tilted)
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(dX + 35, monY + 2, monW, monH);
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(dX + 37, monY + 4, monW - 4, monH - 4);

    // Center monitor (large)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(dX + dW / 2 - 20, monY - 2, 40, 23);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(dX + dW / 2 - 18, monY, 36, 19);

    // Right monitor (tilted)
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(dX + dW - 65, monY + 2, monW, monH);
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(dX + dW - 63, monY + 4, monW - 4, monH - 4);

    // Desk Props: Trophies & Plant
    this.drawTrophy(dX + 18, dY + 20);
    this.drawTrophy(dX + dW - 18, dY + 20);

    // F. Floating Workflow Widget to the Right of CEO Office
    this.drawWorkflowWidget(cs.x + cs.w + 12, cs.y + 25);
  }

  // --- FLOATING WORKFLOW STATUS WIDGET ---
  drawWorkflowWidget(x, y) {
    const ctx = this.ctx;
    const w = 84;
    const h = 135;

    // Dark slate card with glowing shadow
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const stages = [
      { name: "Plan", icon: "✦" },
      { name: "Assign", icon: "→" },
      { name: "Execute", icon: "⚡" },
      { name: "Learn", icon: "★" },
      { name: "Repeat", icon: "🔄" }
    ];

    ctx.font = "bold 10px 'Inter', sans-serif";
    ctx.textAlign = "left";

    stages.forEach((st, idx) => {
      const sy = y + 20 + idx * 23;
      const isActive = this.workflowStage.toLowerCase() === st.name.toLowerCase();

      if (isActive) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
        ctx.beginPath();
        ctx.roundRect(x + 4, sy - 12, w - 8, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(`+ ${st.name}`, x + 10, sy + 2);
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`  ${st.name}`, x + 10, sy + 2);
      }

      if (st.name === "Repeat") {
        ctx.fillStyle = isActive ? "#38bdf8" : "#64748b";
        ctx.fillText(st.icon, x + w - 24, sy + 2);
      }
    });
  }

  // --- 5. SERVER ROOM ---
  drawServerRoom() {
    const ctx = this.ctx;
    const sr = ROOM_BOUNDS.serverRoom;
    const t = this.ledTick;

    // Room Label
    this.drawRoomBadge(sr.x + sr.w / 2, sr.y + sr.h - 14, "Server Room");

    // ── Overhead cable tray (runs across ceiling of room) ──
    const trayY = sr.y + 22;
    ctx.fillStyle = "#0e1a2d";
    ctx.fillRect(sr.x + 8, trayY, sr.w - 16, 7);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 1;
    ctx.strokeRect(sr.x + 8, trayY, sr.w - 16, 7);
    // Cable bundle colours running along tray
    const cableColors = ["#1d4ed8", "#7c3aed", "#059669", "#dc2626", "#f59e0b"];
    for (let ci = 0; ci < cableColors.length; ci++) {
      ctx.fillStyle = cableColors[ci];
      ctx.fillRect(sr.x + 12 + ci * 6, trayY + 2, 4, 3);
    }

    // ── Floor cable strip ──
    ctx.fillStyle = "#0b121e";
    ctx.fillRect(sr.x + 8, sr.y + sr.h - 32, sr.w - 16, 5);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(sr.x + 8, sr.y + sr.h - 32, sr.w - 16, 5);

    // ── Draw 3 full-height rack cabinets ──
    const rackCount = 3;
    const rackGap = 10;
    const totalRackW = sr.w - 50; // leave room for KVM terminal on right
    const rackW = Math.floor((totalRackW - (rackCount - 1) * rackGap) / rackCount);
    const rackH = sr.h - 52;
    const rackTop = sr.y + 32;
    const rackBaseX = sr.x + 8;

    for (let ri = 0; ri < rackCount; ri++) {
      const rx = rackBaseX + ri * (rackW + rackGap);
      const ry = rackTop;

      // Rack chassis — dark brushed metal
      ctx.fillStyle = "#0d1520";
      ctx.beginPath();
      ctx.roundRect(rx, ry, rackW, rackH, 3);
      ctx.fill();

      // Rack border — subtle metallic outline
      ctx.strokeStyle = "#1e3348";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rackW, rackH, 3);
      ctx.stroke();

      // Left rail highlight
      ctx.fillStyle = "#162030";
      ctx.fillRect(rx + 2, ry + 4, 4, rackH - 8);

      // Right rail highlight
      ctx.fillRect(rx + rackW - 6, ry + 4, 4, rackH - 8);

      // ── Rack Unit Slots (1U panels) ──
      const slotH = 7;
      const slotGap = 2;
      const slotX = rx + 8;
      const slotW = rackW - 16;
      const firstSlotY = ry + 6;
      const maxSlots = Math.floor((rackH - 10) / (slotH + slotGap));

      for (let si = 0; si < maxSlots; si++) {
        const sy = firstSlotY + si * (slotH + slotGap);
        if (sy + slotH > ry + rackH - 6) break;

        // Panel face — slightly lighter than chassis
        ctx.fillStyle = "#111d2e";
        ctx.fillRect(slotX, sy, slotW, slotH);

        // Panel bezel line
        ctx.strokeStyle = "#0b1220";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(slotX, sy, slotW, slotH);

        // Server labels — thin grey lines (disk trays / ventilation)
        ctx.fillStyle = "#1a2d45";
        ctx.fillRect(slotX + 2, sy + 2, slotW - 26, 1);
        ctx.fillRect(slotX + 2, sy + 4, slotW - 26, 1);

        // Status LEDs (right side of each 1U panel)
        const ledPhase = t * 2.5 + ri * 1.7 + si * 0.9;

        // Green activity LED
        const greenOn = Math.sin(ledPhase) > 0.3;
        ctx.fillStyle = greenOn ? "#10b981" : "#064e3b";
        if (greenOn) {
          ctx.shadowColor = "#10b981";
          ctx.shadowBlur = 4;
        }
        ctx.fillRect(slotX + slotW - 21, sy + 2, 3, 3);
        ctx.shadowBlur = 0;

        // Blue/cyan link LED
        const blueOn = Math.cos(ledPhase * 1.3 + 1) > 0.1;
        ctx.fillStyle = blueOn ? "#06b6d4" : "#0c4a6e";
        if (blueOn) {
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 3;
        }
        ctx.fillRect(slotX + slotW - 15, sy + 2, 3, 3);
        ctx.shadowBlur = 0;

        // Amber status LED (occasional warning on random slots)
        const hasAmber = (ri * 17 + si * 7) % 11 === 0;
        if (hasAmber) {
          const amberBlink = Math.sin(ledPhase * 0.7) > 0;
          ctx.fillStyle = amberBlink ? "#f59e0b" : "#78350f";
          if (amberBlink) {
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 4;
          }
          ctx.fillRect(slotX + slotW - 9, sy + 2, 3, 3);
          ctx.shadowBlur = 0;
        }
      }

      // ── Cooling fan grill — top of rack ──
      ctx.fillStyle = "#0b1520";
      ctx.fillRect(rx + 6, ry + 2, rackW - 12, 3);
      for (let fi = 0; fi < 5; fi++) {
        const fanX = rx + 8 + fi * ((rackW - 16) / 5);
        ctx.fillStyle = "#162030";
        ctx.fillRect(fanX, ry + 2, 3, 3);
      }

      // ── Cooling fan grill — bottom of rack ──
      ctx.fillStyle = "#0b1520";
      ctx.fillRect(rx + 6, ry + rackH - 5, rackW - 12, 3);
      for (let fi = 0; fi < 5; fi++) {
        const fanX = rx + 8 + fi * ((rackW - 16) / 5);
        ctx.fillStyle = "#162030";
        ctx.fillRect(fanX, ry + rackH - 5, 3, 3);
      }

      // ── Cable egress ports at back top (visible as small coloured dots) ──
      for (let ci = 0; ci < 4; ci++) {
        ctx.fillStyle = cableColors[ci % cableColors.length];
        ctx.fillRect(rx + 6 + ci * 5, ry + rackH - 3, 3, 2);
      }
    }

    // ── Wall-mounted KVM terminal (right side of server room) ──
    const kvmX = sr.x + sr.w - 38;
    const kvmY = sr.y + 34;
    const kvmW = 28;
    const kvmH = 36;

    // Terminal body
    ctx.fillStyle = "#0a1525";
    ctx.beginPath();
    ctx.roundRect(kvmX, kvmY, kvmW, kvmH, 3);
    ctx.fill();
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(kvmX, kvmY, kvmW, kvmH, 3);
    ctx.stroke();

    // Screen glow
    ctx.fillStyle = "#020c14";
    ctx.fillRect(kvmX + 3, kvmY + 4, kvmW - 6, kvmH - 14);
    ctx.strokeStyle = "#0369a1";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(kvmX + 3, kvmY + 4, kvmW - 6, kvmH - 14);

    // Live wave on KVM screen
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const waveBaseY = kvmY + 4 + (kvmH - 14) / 2;
    ctx.moveTo(kvmX + 4, waveBaseY);
    for (let wx = 0; wx < kvmW - 8; wx += 3) {
      const dy = Math.sin(t * 3 + wx * 0.4) * 4;
      ctx.lineTo(kvmX + 4 + wx, waveBaseY + dy);
    }
    ctx.stroke();

    // KVM power LED
    const kvmLedOn = Math.sin(t * 1.5) > 0;
    ctx.fillStyle = kvmLedOn ? "#10b981" : "#064e3b";
    ctx.fillRect(kvmX + 10, kvmY + kvmH - 7, 3, 3);

    // USB / port indicators
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(kvmX + 16, kvmY + kvmH - 8, 5, 5);
    ctx.fillStyle = "#0c4a6e";
    ctx.fillRect(kvmX + 17, kvmY + kvmH - 7, 3, 3);

    // KVM arm bracket
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(kvmX + kvmW, kvmY + kvmH / 2 - 2, 6, 4);
  }

  // --- 6. CREATIVE PLAY ROOM & TEA BREAK HUB (BREAK ROOM GAMES) ---
  drawLounge() {
    const ctx = this.ctx;
    const lg = ROOM_BOUNDS.lounge;

    // Room Label
    this.drawRoomBadge(lg.x + Math.round(lg.w / 2), lg.y + lg.h - 16, "Break & Play Hub");

    // A. Cozy Corner Velvet Couch for Pixel the Cat (Top-Left Corner)
    const sX = lg.x + 20;
    const sY = lg.y + 36;
    const sW = 62;
    const sH = 36;
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(sX + 2, sY + 4, sW, sH, 8);
    ctx.fill();
    // Deep emerald velvet couch frame
    ctx.fillStyle = "#064e3b";
    ctx.beginPath();
    ctx.roundRect(sX, sY, sW, sH, 7);
    ctx.fill();
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Plush Seat Cushions
    ctx.fillStyle = "#047857";
    ctx.fillRect(sX + 6, sY + 7, 24, 22);
    ctx.fillRect(sX + 32, sY + 7, 24, 22);
    // Cozy Knitted Plaid Throw Blanket draped over corner
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(sX + 7, sY + 8, 14, 16);
    ctx.fillStyle = "#d97706";
    ctx.fillRect(sX + 9, sY + 8, 2, 16);
    ctx.fillRect(sX + 7, sY + 14, 14, 2);

    // B. Coffee, Tea & Refreshment Snack Bar (Middle Left)
    const tX = lg.x + 18;
    const tY = lg.y + 84;
    const tW = 84;
    const tH = 30;
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.roundRect(tX, tY, tW, tH, 4);
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Espresso Machine with chrome finish
    const espX = tX + 6;
    const espY = tY + 4;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(espX, espY, 18, 22);
    ctx.fillStyle = "#475569";
    ctx.fillRect(espX + 2, espY + 2, 14, 7);
    ctx.fillStyle = "#10b981";
    ctx.fillRect(espX + 13, espY + 11, 3, 3); // Ready LED
    // Steaming Cup of Coffee
    const cupX = tX + 34;
    const cupY = tY + 14;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cupX, cupY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.arc(cupX, cupY, 3, 0, Math.PI * 2);
    ctx.fill();
    // Donut & snack plate
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.ellipse(tX + 58, tY + 15, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ec4899"; // Frosted strawberry donut
    ctx.beginPath();
    ctx.arc(tX + 55, tY + 14, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78350f"; // Chocolate donut
    ctx.beginPath();
    ctx.arc(tX + 63, tY + 14, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Rising Pixel Steam Particles
    if (Math.random() < 0.25) {
      this.steamParticles.push({
        x: cupX + (Math.random() - 0.5) * 4,
        y: cupY - 4,
        vy: -0.6 - Math.random() * 0.4,
        alpha: 0.8,
        size: 2 + Math.random() * 2
      });
    }

    // C. Wall Tournament Darts Board (Upper Wall)
    const dartX = lg.x + 104;
    const dartY = lg.y + 16;
    // Wooden Cabinet Backing
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(dartX, dartY, 34, 18);
    ctx.strokeStyle = "#8d6e63";
    ctx.strokeRect(dartX, dartY, 34, 18);
    // Green chalkboard side wings
    ctx.fillStyle = "#14532d";
    ctx.fillRect(dartX + 2, dartY + 2, 7, 14);
    ctx.fillRect(dartX + 25, dartY + 2, 7, 14);
    // Sisal Circular Dartboard
    const dbCenter = { x: dartX + 17, y: dartY + 9 };
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(dbCenter.x, dbCenter.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Bullseye
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(dbCenter.x, dbCenter.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(dbCenter.x - 0.7, dbCenter.y - 0.7, 1.4, 1.4);

    // D. Retro 8-Bit Arcade Cabinet ("AGENT INVADERS")
    const arcX = lg.x + 148;
    const arcY = lg.y + 24;
    const arcW = 38;
    const arcH = 74;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(arcX, arcY, arcW, arcH, 5);
    ctx.fill();
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Marquee Header
    ctx.fillStyle = "#7e22ce";
    ctx.fillRect(arcX + 3, arcY + 3, arcW - 6, 11);
    ctx.fillStyle = "#fdf4ff";
    ctx.font = "bold 6px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("ARCADE", arcX + arcW / 2, arcY + 11);
    // CRT Screen
    const crtX = arcX + 4;
    const crtY = arcY + 17;
    const crtW = arcW - 8;
    const crtH = 24;
    ctx.fillStyle = "#020617";
    ctx.fillRect(crtX, crtY, crtW, crtH);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.strokeRect(crtX, crtY, crtW, crtH);
    // Animated Space Invader sprite
    const animX = crtX + 4 + Math.floor((Math.sin(this.arcadeTick * 2) + 1) * 7);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(animX, crtY + 7, 5, 4);
    ctx.fillStyle = "#f43f5e";
    ctx.fillRect(crtX + crtW / 2 - 3, crtY + crtH - 3, 6, 2);
    // Joystick & Buttons
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(arcX + 12, arcY + 52, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(arcX + 22, arcY + 51, 2, 0, Math.PI * 2);
    ctx.arc(arcX + 28, arcY + 54, 2, 0, Math.PI * 2);
    ctx.fill();

    // E. Super Nova Pinball Machine (Top Right)
    const pinX = lg.x + 196;
    const pinY = lg.y + 24;
    const pinW = 38;
    const pinH = 78;
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(pinX + 2, pinY + 6, pinW, pinH);
    // Pinball Backbox Header
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(pinX + 2, pinY, pinW - 4, 24);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pinX + 2, pinY, pinW - 4, 24);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 6.5px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PINBALL", pinX + pinW / 2, pinY + 11);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 6px monospace";
    ctx.fillText("★ 98,400", pinX + pinW / 2, pinY + 20);
    // Tilted Glass Playfield
    const pfX = pinX;
    const pfY = pinY + 25;
    const pfW = pinW;
    const pfH = pinH - 25;
    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.roundRect(pfX, pfY, pfW, pfH, 4);
    ctx.fill();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Glowing Bumpers inside playfield
    const bumpCol = Math.sin(this.arcadeTick * 4) > 0 ? "#f43f5e" : "#fbbf24";
    ctx.fillStyle = bumpCol;
    ctx.beginPath();
    ctx.arc(pfX + 12, pfY + 14, 3, 0, Math.PI * 2);
    ctx.arc(pfX + 26, pfY + 14, 3, 0, Math.PI * 2);
    ctx.arc(pfX + 19, pfY + 22, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Silver pinball
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(pfX + 16, pfY + 32, 2, 0, Math.PI * 2);
    ctx.fill();
    // Left & Right flippers at bottom
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pfX + 9, pfY + pfH - 10);
    ctx.lineTo(pfX + 16, pfY + pfH - 8);
    ctx.moveTo(pfX + pfW - 9, pfY + pfH - 10);
    ctx.lineTo(pfX + pfW - 16, pfY + pfH - 8);
    ctx.stroke();

    // F. Tournament Foosball Table (Mini Football Table) - Bottom Left
    const fooX = lg.x + 18;
    const fooY = lg.y + 130;
    const fooW = 86;
    const fooH = 54;
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(fooX + 3, fooY + 5, fooW, fooH, 6);
    ctx.fill();
    // Sturdy Hardwood Cabinet Outer Frame
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.roundRect(fooX, fooY, fooW, fooH, 5);
    ctx.fill();
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Pitch (Lush Green Playing Field)
    const pitchX = fooX + 6;
    const pitchY = fooY + 6;
    const pitchW = fooW - 12;
    const pitchH = fooH - 12;
    ctx.fillStyle = "#15803d";
    ctx.fillRect(pitchX, pitchY, pitchW, pitchH);
    // White Pitch Markings: Midfield line & center circle & goals
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pitchX + pitchW / 2, pitchY);
    ctx.lineTo(pitchX + pitchW / 2, pitchY + pitchH);
    ctx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 7, 0, Math.PI * 2);
    ctx.stroke();
    // 4 Polished Steel Player Rods crossing horizontally
    for (let r = 0; r < 4; r++) {
      const rodY = pitchY + 6 + r * 10;
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(fooX - 4, rodY);
      ctx.lineTo(fooX + fooW + 4, rodY);
      ctx.stroke();
      // Black rubber handles
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(fooX - 7, rodY - 2, 4, 4);
      ctx.fillRect(fooX + fooW + 3, rodY - 2, 4, 4);
      // Red & Blue team players on the rod
      const isRed = (r % 2 === 0);
      ctx.fillStyle = isRed ? "#ef4444" : "#3b82f6";
      ctx.fillRect(pitchX + 16, rodY - 2.5, 4, 5);
      ctx.fillRect(pitchX + pitchW - 20, rodY - 2.5, 4, 5);
      if (r === 1 || r === 2) {
        ctx.fillRect(pitchX + pitchW / 2 - 2, rodY - 2.5, 4, 5);
      }
    }
    // Miniature white football in play
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pitchX + pitchW / 2 + 5, pitchY + pitchH / 2 + 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Scoring Beads on Top Rail
    ctx.fillStyle = "#ef4444";
    for (let b = 0; b < 5; b++) ctx.fillRect(fooX + 12 + b * 5, fooY + 2, 3, 2);
    ctx.fillStyle = "#3b82f6";
    for (let b = 0; b < 5; b++) ctx.fillRect(fooX + fooW - 34 + b * 5, fooY + 2, 3, 2);

    // G. Grandmaster Chess & Board Game Nook (Bottom Right)
    const chX = lg.x + 142;
    const chY = lg.y + 132;
    const chW = 54;
    const chH = 52;
    // Table Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(chX + 2, chY + 4, chW, chH, 6);
    ctx.fill();
    // Round / Square Teakwood Table
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.roundRect(chX, chY, chW, chH, 6);
    ctx.fill();
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 8x8 Inlaid Sycamore Chessboard
    const boardX = chX + 11;
    const boardY = chY + 10;
    const tileS = 4;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isDark = (row + col) % 2 === 1;
        ctx.fillStyle = isDark ? "#78350f" : "#fef3c7";
        ctx.fillRect(boardX + col * tileS, boardY + row * tileS, tileS, tileS);
      }
    }
    // Micro Hand-carved Chess Pieces in Active Game
    ctx.fillStyle = "#1e293b"; // Black pieces
    ctx.fillRect(boardX + 4, boardY + 4, 3, 3);
    ctx.fillRect(boardX + 12, boardY + 8, 3, 3);
    ctx.fillRect(boardX + 20, boardY + 4, 3, 3);
    ctx.fillStyle = "#ffffff"; // White pieces
    ctx.fillRect(boardX + 8, boardY + 20, 3, 3);
    ctx.fillRect(boardX + 16, boardY + 24, 3, 3);
    ctx.fillRect(boardX + 24, boardY + 16, 3, 3);

    // Two Mid-Century Armchairs flanking Chess Table
    const drawArmchair = (ax, ay, isLeft) => {
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(ax, ay, 14, 24, 4);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(ax + 2, ay + 3, 10, 18);
    };
    drawArmchair(chX - 14, chY + 14, true);
    drawArmchair(chX + chW, chY + 14, false);

    // Potted plant in lounge
    this.drawPottedPlant(lg.x + 18, lg.y + 16, 11);
  }

  // --- 7. TEA BREAK LOUNGE & CONTEXT SYNTHESIZER ---
  drawTeaBreakRoom() {
    const ctx = this.ctx;
    const cl = ROOM_BOUNDS.teaBreakRoom || ROOM_BOUNDS.contextLab || ROOM_BOUNDS.focusRoom;
    if (!cl) return;

    // Room Label
    this.drawRoomBadge(cl.x + cl.w / 2, cl.y + 175, "🍵 Tea Break Lounge & Context Synthesizer");

    // A. Tea & Conversation Synthesis Bar (Left side)
    const tX = cl.x + 14;
    const tY = cl.y + 65;
    const tW = 96;
    const tH = 46;

    // Warm wooden counter with polished teak top
    ctx.fillStyle = "#3e2723";
    ctx.beginPath();
    ctx.roundRect(tX, tY, tW, tH, 5);
    ctx.fill();
    ctx.strokeStyle = "#8d6e63";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Polished brass trim
    ctx.fillStyle = "#d97706";
    ctx.fillRect(tX + 4, tY + 4, tW - 8, 3);

    // Traditional Copper/Brass Tea Samovar & Brewing Kettle
    const samX = tX + 14;
    const samY = tY + 12;
    // Kettle body
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.arc(samX + 8, samY + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Kettle lid and spout
    ctx.fillStyle = "#d97706";
    ctx.fillRect(samX + 5, samY, 6, 4);
    ctx.fillRect(samX - 3, samY + 8, 5, 3);
    // Warm warming flame glow under kettle
    ctx.fillStyle = "rgba(245, 158, 11, 0.4)";
    ctx.beginPath();
    ctx.arc(samX + 8, samY + 23, 8, 0, Math.PI);
    ctx.fill();

    // Ceramic Teacups (Fresh Matcha & Golden Herbal Tea)
    const c1X = tX + 44;
    const c1Y = samY + 8;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(c1X, c1Y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#10b981"; // Matcha green tea
    ctx.beginPath();
    ctx.arc(c1X, c1Y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const c2X = tX + 64;
    const c2Y = samY + 16;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(c2X, c2Y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f59e0b"; // Golden herbal brew
    ctx.beginPath();
    ctx.arc(c2X, c2Y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Rising Pixel Steam from Samovar & Tea Cup
    if (Math.random() < 0.38) {
      this.steamParticles.push({
        x: samX + 8 + (Math.random() - 0.5) * 6,
        y: samY - 2,
        vy: -0.7 - Math.random() * 0.5,
        alpha: 0.85,
        size: 2.5 + Math.random() * 2.5
      });
    }

    // Tea Canisters on Shelf: "MATCHA", "EARL", "CONTEXT", "MEMORY"
    const shX = tX + 6;
    const shY = cl.y + 18;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(shX, shY, 86, 24);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(shX, shY, 86, 24);

    const cans = [
      { color: "#10b981", label: "MATCHA", x: shX + 4 },
      { color: "#b45309", label: "EARL", x: shX + 24 },
      { color: "#06b6d4", label: "CONTEXT", x: shX + 44 },
      { color: "#a855f7", label: "MEM", x: shX + 66 }
    ];
    for (const can of cans) {
      ctx.fillStyle = can.color;
      ctx.fillRect(can.x, shY + 4, 18, 15);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 5.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(can.label, can.x + 9, shY + 14);
    }

    // B. Holographic Vector Memory Distillation Core (Right side)
    const coreX = cl.x + cl.w - 105;
    const coreY = cl.y + 24;
    const coreW = 88;
    const coreH = 100;

    // Outer cyber chamber housing
    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.roundRect(coreX, coreY, coreW, coreH, 6);
    ctx.fill();
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Translucent glass glow window
    const glassGrad = ctx.createLinearGradient(coreX, coreY, coreX, coreY + coreH);
    glassGrad.addColorStop(0, "rgba(6, 182, 212, 0.08)");
    glassGrad.addColorStop(0.5, "rgba(14, 165, 233, 0.22)");
    glassGrad.addColorStop(1, "rgba(6, 182, 212, 0.08)");
    ctx.fillStyle = glassGrad;
    ctx.fillRect(coreX + 4, coreY + 18, coreW - 8, coreH - 24);

    // Header in Chamber
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 6.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚡ CONTEXT SYNTHESIZER", coreX + coreW / 2, coreY + 12);

    // Floating 3D Vector Crystal (pulsing with ledTick)
    const crystalX = coreX + coreW / 2;
    const crystalY = coreY + 46 + Math.sin(this.ledTick * 2.5) * 3;

    ctx.save();
    ctx.translate(crystalX, crystalY);
    ctx.rotate(this.ledTick * 0.4);

    // Diamond crystal facets
    ctx.fillStyle = "rgba(6, 182, 212, 0.85)";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Distillation Pipeline HUD Readouts
    ctx.fillStyle = "#94a3b8";
    ctx.font = "6px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("STATE: ACTIVE", coreX + 8, coreY + 74);
    ctx.fillText("EMBED: 1536-D", coreX + 8, coreY + 84);
    ctx.fillText("DISTILL: READY", coreX + 8, coreY + 94);

    // Pulsing activity indicator LED
    const pulseLed = Math.sin(this.ledTick * 4) > 0;
    ctx.fillStyle = pulseLed ? "#10b981" : "#047857";
    ctx.beginPath();
    ctx.arc(coreX + coreW - 12, coreY + 74, 3, 0, Math.PI * 2);
    ctx.fill();

    // Data Flow Conduit on Floor connecting Tea Bar to Memory Core
    ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tX + tW, tY + tH / 2);
    ctx.lineTo(coreX, tY + tH / 2);
    ctx.stroke();

    // Animated data packet along conduit
    const conduitProg = (this.ledTick * 0.6) % 1;
    const pktX = (tX + tW) + ((coreX) - (tX + tW)) * conduitProg;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(pktX, tY + tH / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // C. Zen Bonsai & Contemplation Stool
    this.drawPottedPlant(cl.x + 18, cl.y + cl.h - 45, 13);

    // Stool for relaxing with tea
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.arc(tX + tW / 2, tY + tH + 14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Backward compatibility alias for any legacy callers
  drawContextLab() {
    this.drawTeaBreakRoom();
  }

  drawFocusRoom() {
    this.drawTeaBreakRoom();
  }

  // --- 8. OPEN OFFICE (6 AGENT DESKS) ---
  drawOpenOfficeDesks(deskOccupants = {}) {
    const ctx = this.ctx;

    // Desks 1 to 6
    for (let id = 1; id <= 6; id++) {
      const d = DESK_COORDINATES[id];
      const isHovered = this.hoveredDesk === id;
      const occupant = deskOccupants[id] || null;
      const isOccupied = occupant !== null;
      const agentName = isOccupied ? occupant.name : `Workstation #${id}`;
      const agentRole = isOccupied ? occupant.role : "🟢 Available (Hot Desk)";
      const deskColor = isOccupied ? (occupant.color || d.color) : "#10b981";

      // 1. Expanded Workstation Floor Rug / Acoustic Mat
      const matW = 224;
      const matH = 132;
      const matX = d.x - matW / 2;
      const matY = d.y - 44;

      ctx.fillStyle = deskColor + (isOccupied ? "24" : "10");
      ctx.beginPath();
      ctx.roundRect(matX, matY, matW, matH, 10);
      ctx.fill();
      ctx.strokeStyle = isHovered ? "#ffffff" : deskColor + (isOccupied ? "77" : "44");
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Inner subtle tech stitch border
      ctx.strokeStyle = deskColor + (isOccupied ? "33" : "18");
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(matX + 6, matY + 6, matW - 12, matH - 12);
      ctx.setLineDash([]);

      // 2. Desk Ground Shadow
      const deskW = 186;
      const deskH = 64;
      const deskX = d.x - deskW / 2;
      const deskY = d.y - 28;

      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.roundRect(deskX + 4, deskY + 6, deskW, deskH, 8);
      ctx.fill();

      // 3. Handcrafted Solid Hardwood Desk Surface (Warm Walnut / Mahogany)
      ctx.fillStyle = "#5c2a16";
      ctx.beginPath();
      ctx.roundRect(deskX, deskY, deskW, deskH, 6);
      ctx.fill();
      ctx.strokeStyle = "#854d0e";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inlay Gold/Wood Chamfer Border
      ctx.strokeStyle = "rgba(217, 119, 6, 0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(deskX + 5, deskY + 5, deskW - 10, deskH - 10);

      // Corner Metallic Reinforcement Brackets
      ctx.fillStyle = "#b45309";
      for (const [cx, cy] of [
        [deskX + 2, deskY + 2],
        [deskX + deskW - 8, deskY + 2],
        [deskX + 2, deskY + deskH - 8],
        [deskX + deskW - 8, deskY + deskH - 8]
      ]) {
        ctx.fillRect(cx, cy, 6, 6);
      }

      // 4. Primary Ultrawide Curved Monitor (Center-Right 66x38)
      const monW = 66;
      const monH = 38;
      const monX = d.x - monW / 2 + 16;
      const monY = deskY - 18;

      // Monitor Stand & Base
      ctx.fillStyle = "#334155";
      ctx.fillRect(monX + monW / 2 - 6, monY + monH, 12, 6);
      ctx.fillStyle = "#475569";
      ctx.fillRect(monX + monW / 2 - 12, monY + monH + 5, 24, 3);

      // Monitor Frame
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.roundRect(monX, monY, monW, monH, 3);
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Screen with agent code / telemetry glow
      if (isOccupied) {
        ctx.fillStyle = "#0a101d";
        ctx.fillRect(monX + 2, monY + 2, monW - 4, monH - 4);
        
        // Multi-color IDE syntax lines
        ctx.fillStyle = deskColor;
        ctx.fillRect(monX + 6, monY + 6, 20, 2.5);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(monX + 28, monY + 6, 16, 2.5);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(monX + 10, monY + 12, 28, 2);
        ctx.fillStyle = "#34d399";
        ctx.fillRect(monX + 40, monY + 12, 14, 2);

        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fillRect(monX + 10, monY + 17, 34, 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(monX + 46, monY + 17, 10, 2);

        ctx.fillStyle = deskColor;
        ctx.fillRect(monX + 6, monY + 23, 22, 2.5);
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(monX + 10, monY + 28, 38, 2);
      } else {
        // Standby monitor: sleep mode with ready pulse
        ctx.fillStyle = "#090f1a";
        ctx.fillRect(monX + 2, monY + 2, monW - 4, monH - 4);
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("READY", monX + monW / 2, monY + monH / 2 + 3);
      }

      // 5. Secondary Portrait Display / Reference Tablet (Left 26x34)
      const secW = 26;
      const secH = 34;
      const secX = deskX + 12;
      const secY = deskY - 14;

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(secX, secY, secW, secH, 2);
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isOccupied) {
        ctx.fillStyle = "#090d16";
        ctx.fillRect(secX + 2, secY + 2, secW - 4, secH - 4);
        // Telemetry sparklines & metrics
        ctx.fillStyle = deskColor + "cc";
        ctx.fillRect(secX + 4, secY + 6, 18, 3);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(secX + 4, secY + 22, 3, 7);
        ctx.fillRect(secX + 9, secY + 17, 3, 12);
        ctx.fillRect(secX + 14, secY + 13, 3, 16);
        ctx.fillRect(secX + 19, secY + 19, 3, 10);
      } else {
        ctx.fillStyle = "#090d16";
        ctx.fillRect(secX + 2, secY + 2, secW - 4, secH - 4);
      }

      // 6. Sleek Angled Desk Lamp on Far Left
      const lampX = deskX + 8;
      const lampY = deskY + 6;
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(lampX, lampY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lampX, lampY);
      ctx.lineTo(lampX + 6, lampY - 12);
      ctx.lineTo(lampX + 14, lampY - 10);
      ctx.stroke();
      // Lamp shade
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(lampX + 14, lampY - 10, 4, 0, Math.PI * 2);
      ctx.fill();
      // Soft warm ambient glow cone
      ctx.fillStyle = "rgba(251, 191, 36, 0.08)";
      ctx.beginPath();
      ctx.moveTo(lampX + 14, lampY - 10);
      ctx.lineTo(lampX + 4, lampY + 18);
      ctx.lineTo(lampX + 32, lampY + 18);
      ctx.closePath();
      ctx.fill();

      // 7. Mechanical Backlit Keyboard (Expanded 50x13)
      const kbW = 50;
      const kbH = 13;
      const kbX = d.x - kbW / 2 + 16;
      const kbY = deskY + 28;
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(kbX, kbY, kbW, kbH, 2);
      ctx.fill();
      ctx.fillStyle = isOccupied ? "rgba(255, 255, 255, 0.28)" : "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(kbX + 3, kbY + 3, kbW - 6, 2.5);
      ctx.fillRect(kbX + 8, kbY + 7, 34, 2.5);

      // 8. Mousepad & Precision Ergonomic Mouse
      const padW = 20;
      const padH = 16;
      const padX = kbX + kbW + 6;
      const padY = kbY - 1;
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(padX, padY, padW, padH, 2);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.roundRect(padX + 5, padY + 3, 10, 10, 3);
      ctx.fill();
      ctx.fillStyle = deskColor;
      ctx.fillRect(padX + 9, padY + 5, 2, 3); // Scroll wheel

      // 9. Ceramic Coffee / Tea Mug
      const mugX = deskX + 26;
      const mugY = deskY + 36;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mugX, mugY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#78350f"; // Coffee/Tea
      ctx.beginPath();
      ctx.arc(mugX, mugY, 4, 0, Math.PI * 2);
      ctx.fill();

      // 10. Studio Monitor Speaker on Right
      const spkX = deskX + deskW - 16;
      const spkY = deskY - 6;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(spkX, spkY, 10, 18);
      ctx.strokeStyle = "#334155";
      ctx.strokeRect(spkX, spkY, 10, 18);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(spkX + 5, spkY + 6, 2.5, 0, Math.PI * 2);
      ctx.arc(spkX + 5, spkY + 13, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 11. Office Ergonomic Executive Chair Behind Desk (Expanded)
      const chairY = d.y + 44;
      // 5-Star Caster base legs
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 5) {
        ctx.beginPath();
        ctx.moveTo(d.x, chairY);
        ctx.lineTo(d.x + Math.cos(a) * 16, chairY + Math.sin(a) * 16);
        ctx.stroke();
      }
      // Main Chair Cushion
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(d.x, chairY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(d.x, chairY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = deskColor;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Padded Armrests Left & Right
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(d.x - 20, chairY - 8, 4, 16, 2);
      ctx.roundRect(d.x + 16, chairY - 8, 4, 16, 2);
      ctx.fill();

      // 12. Flanking Decorative Planter
      this.drawPottedPlant(deskX - 16, d.y + 6, 15);

      // 13. Desk Name Badge
      this.drawAgentDeskBadge(d.x, d.y + 70, agentName, agentRole, deskColor);
    }
  }

  // --- 9. TASK BOARD HUD (BOTTOM LEFT) ---
  drawTaskBoard() {
    const ctx = this.ctx;
    const tb = ROOM_BOUNDS.taskBoard;

    // Dark sleek container with cyan border
    ctx.fillStyle = "rgba(10, 15, 26, 0.95)";
    ctx.beginPath();
    ctx.roundRect(tb.x, tb.y, tb.w, tb.h, 8);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing border highlight
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(tb.x - 2, tb.y - 2, tb.w + 4, tb.h + 4);

    // Header: "Task Board"
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 12px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Task Board", tb.x + 14, tb.y + 22);

    // Subtitle indicator
    ctx.font = "8.5px 'Inter', sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Live Operations", tb.x + tb.w - 85, tb.y + 22);

    // Horizontal divider
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tb.x + 10, tb.y + 30);
    ctx.lineTo(tb.x + tb.w - 10, tb.y + 30);
    ctx.stroke();

    // Render tasks fitting the board height
    const maxTasks = Math.min(5, Math.floor((tb.h - 38) / 35));
    const itemH = 34;
    this.tasks.slice(0, maxTasks).forEach((task, idx) => {
      const iy = tb.y + 36 + idx * itemH;
      const isHovered = this.hoveredTaskIndex === idx;

      if (isHovered) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
        ctx.beginPath();
        ctx.roundRect(tb.x + 6, iy, tb.w - 12, itemH - 4, 4);
        ctx.fill();
      }

      // Task Icon
      ctx.font = "12px sans-serif";
      ctx.fillText(task.icon, tb.x + 10, iy + 18);

      // Task Title
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "600 10px 'Inter', sans-serif";
      const titleStr = task.title.length > 20 ? task.title.substring(0, 18) + ".." : task.title;
      ctx.fillText(titleStr, tb.x + 28, iy + 17);

      // Status Pill Badge
      const pillW = task.status === "In Progress" ? 60 : 54;
      const pillX = tb.x + tb.w - pillW - 10;
      const pillY = iy + 5;

      ctx.fillStyle = task.statusColor;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, 16, 8);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(task.status, pillX + pillW / 2, pillY + 11.5);
      ctx.textAlign = "left";
    });

    // Enterprise Telemetry Footer on Board
    if (tb.h >= 240) {
      const footY = tb.y + tb.h - 22;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(tb.x + 6, footY - 8, tb.w - 12, 22);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
      ctx.strokeRect(tb.x + 6, footY - 8, tb.w - 12, 22);

      ctx.font = "bold 8.5px monospace";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`⚡ Tok: ${this.officeTelemetry?.total_tokens || 0}`, tb.x + 12, footY + 6);
      ctx.fillStyle = "#10b981";
      ctx.fillText(`$${(this.officeTelemetry?.total_cost_usd || 0).toFixed(4)}`, tb.x + tb.w - 55, footY + 6);
    }
  }

  // --- 10. GRAND ENTRANCE (BOTTOM CENTER) ---
  drawEntrance() {
    const ctx = this.ctx;
    const ent = ROOM_BOUNDS.entrance;

    // Red Welcome Rug
    const rugW = Math.min(180, ent.w - 20);
    const rugH = 50;
    const rugX = ent.x + Math.round((ent.w - rugW) / 2);
    const rugY = ent.y + 8;

    ctx.fillStyle = "#991b1b";
    ctx.beginPath();
    ctx.roundRect(rugX, rugY, rugW, rugH, 4);
    ctx.fill();
    ctx.strokeStyle = "#b91c1c";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mountain Logo on Mat 🏔️
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(rugX + rugW / 2 - 10, rugY + 20);
    ctx.lineTo(rugX + rugW / 2, rugY + 10);
    ctx.lineTo(rugX + rugW / 2 + 10, rugY + 20);
    ctx.closePath();
    ctx.fill();

    // Welcome Text
    ctx.font = "bold 10px 'Inter', sans-serif";
    ctx.fillStyle = "#fef2f2";
    ctx.textAlign = "center";
    ctx.fillText("HQ ENTRANCE", rugX + rugW / 2, rugY + 34);

    // Sliding Glass Doors
    const doorY = ent.y + 65;
    const doorHalfW = Math.round((ent.w - 50) / 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.fillRect(ent.x + 15, doorY, doorHalfW, 16);
    ctx.fillRect(ent.x + 25 + doorHalfW, doorY, doorHalfW, 16);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.strokeRect(ent.x + 15, doorY, doorHalfW, 16);
    ctx.strokeRect(ent.x + 25 + doorHalfW, doorY, doorHalfW, 16);

    // Entry Topiaries / Shrub planters
    this.drawTopiary(ent.x - 12, ent.y + 25);
    this.drawTopiary(ent.x + ent.w + 12, ent.y + 25);

    // Glowing Entrance Lanterns
    this.drawLantern(ent.x - 38, ent.y + 45);
    this.drawLantern(ent.x + ent.w + 38, ent.y + 45);

    // Entering Character (Red Jacket, Upward Arrow)
    this.drawVisitorCharacter(DOOR_COORDINATES.x, DOOR_COORDINATES.y - 15);
  }

  // --- 11. COURTYARD GARDEN (BOTTOM RIGHT) ---
  drawCourtyard() {
    const ctx = this.ctx;
    const cy = ROOM_BOUNDS.courtyard;

    // Room Label
    this.drawRoomBadge(cy.x + cy.w / 2, cy.y + 18, "🌿 Courtyard Nature Garden");

    // 1. Left Tree: Blooming Japanese Sakura (Cherry Blossom) Tree!
    this.drawSakuraTree(cy.x + 65, cy.y + 115);

    // 2. Right Tree: Lush Summer Oak Tree!
    this.drawPixelTree(cy.x + cy.w - 65, cy.y + 115);

    // 3. Centerpiece Zen Stone Fountain with Animated Cyan Ripples!
    const fnX = cy.x + Math.round(cy.w / 2);
    const fnY = cy.y + 80;
    this.drawZenFountain(fnX, fnY);

    // 4. Two Handcrafted Wooden Park Benches (Under Sakura & Under Oak)
    // Left Bench (Sakura Bench)
    this.drawParkBench(cy.x + 35, cy.y + 130, 58, 22);
    // Right Bench (Oak Bench)
    this.drawParkBench(cy.x + cy.w - 93, cy.y + 130, 58, 22);

    // 5. Ivy & Flower Trellis along top garden wall
    this.drawGardenTrellis(cy.x + 15, cy.y + 35, cy.w - 30);

    // 6. Warm Garden Stone Lanterns
    this.drawLantern(cy.x + 22, cy.y + 205);
    this.drawLantern(cy.x + cy.w - 22, cy.y + 205);
  }

  // --- 12. OFFICE CAT (PIXEL) ---
  drawCat(catState = {}) {
    const ctx = this.ctx;
    const x = Math.round(catState.x !== undefined ? catState.x : CAT_COORDINATES.x);
    const y = Math.round(catState.y !== undefined ? catState.y : CAT_COORDINATES.y);
    const state = catState.state || "RESTING";
    const facing = catState.facing || "right";
    const dir = facing === "left" ? -1 : 1;
    const isPlaying = state === "PLAYING";
    const isWalking = state === "WALKING";

    const tailWag = isPlaying
      ? Math.sin((catState.playFrame || 0) * 6.0) * 8
      : (isWalking ? Math.sin((catState.walkFrame || 0) * 3.5) * 6 : Math.sin(this.ledTick * 3) * 3.5);

    const breath = (!isWalking && !isPlaying) ? Math.sin((catState.purrFrame || this.ledTick) * 1.6) * 1.5 : 0;
    const walkBob = isWalking ? Math.abs(Math.sin((catState.walkFrame || 0) * 3.2)) * 2 : 0;

    ctx.save();
    // Cat Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 10, isPlaying ? 15 : 13, isPlaying ? 8 : 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cat Body (Warm white / cream fluffy fur)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (isPlaying) {
      // Playful roll tilt on rug
      ctx.roundRect(x - 9, y - 6, 18, 14, 6);
    } else {
      ctx.roundRect(x - 8, y - 4 - breath - walkBob, 16, 13 + breath, 5);
    }
    ctx.fill();

    // 4 Animated Paws
    if (isWalking) {
      const stride1 = Math.sin((catState.walkFrame || 0) * 3.5) * 4;
      const stride2 = -stride1;
      ctx.fillStyle = "#f1f5f9";
      // Back legs
      ctx.fillRect(x - 6 * dir + stride1, y + 6, 3, 5);
      ctx.fillRect(x + 4 * dir + stride2, y + 6, 3, 5);
      // Front legs
      ctx.fillRect(x - 3 * dir + stride2, y + 6, 3, 5);
      ctx.fillRect(x + 1 * dir + stride1, y + 6, 3, 5);
    } else if (isPlaying) {
      // Batting front paws reaching up playfully
      const pawBat = Math.sin((catState.playFrame || 0) * 4.5) * 5;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(x + dir * 6 + pawBat, y - 6 - Math.abs(pawBat), 3, 4, 0.3 * dir, 0, Math.PI * 2);
      ctx.ellipse(x + dir * 2 - pawBat, y - 8 - Math.abs(pawBat), 3, 4, -0.2 * dir, 0, Math.PI * 2);
      ctx.fill();
      // Back paws
      ctx.fillRect(x - 8 * dir, y + 4, 4, 4);
      ctx.fillRect(x - 2 * dir, y + 5, 4, 4);
    } else {
      // Paws tucked comfortably underneath in loaf pose
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(x - 6, y + 6, 4, 3);
      ctx.fillRect(x + 2, y + 6, 4, 3);
    }

    // Cat Head
    const headX = isPlaying ? x + dir * 4 : x + dir * 1;
    const headY = isPlaying ? y - 10 : y - 13 - breath - walkBob;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(headX - 7, headY, 14, 12, 4);
    ctx.fill();

    // Pink Inner Ears
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY);
    ctx.lineTo(headX - 3, headY - 6);
    ctx.lineTo(headX - 1, headY);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(headX + 1, headY);
    ctx.lineTo(headX + 3, headY - 6);
    ctx.lineTo(headX + 6, headY);
    ctx.fill();

    // Facial Expression & Eyes
    if (isPlaying) {
      // Happy curved anime eyes (^ . ^)
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(headX - 3.5, headY + 5, 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(headX + 3.5, headY + 5, 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Pink Rosy Blushing Cheeks
      ctx.fillStyle = "rgba(244, 114, 182, 0.6)";
      ctx.beginPath();
      ctx.ellipse(headX - 4.5, headY + 8, 2, 1.2, 0, 0, Math.PI * 2);
      ctx.ellipse(headX + 4.5, headY + 8, 2, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Alert/Relaxed eyes
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(headX - 4, headY + 4, 2, 2.5);
      ctx.fillRect(headX + 2, headY + 4, 2, 2.5);
    }

    // Pink Nose
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(headX - 1, headY + 7, 2, 1.5);

    // Animated Curving Tail with fluid physics
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x - dir * 7, y + 3);
    ctx.quadraticCurveTo(x - dir * (14 + tailWag), y - 2, x - dir * (16 + tailWag), y - 8);
    ctx.stroke();

    // Red Collar with Bell
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(headX - 6, headY + 10, 12, 2);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(headX, headY + 12, 2, 0, Math.PI * 2);
    ctx.fill();

    // Floating Purr Hearts & Sparkles when playing
    if (isPlaying) {
      const pTick = (catState.playFrame || 0) * 0.2;
      const sparkY = y - 24 - (pTick % 1) * 16;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("❤️", x + Math.sin(pTick * 3) * 8, sparkY);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(x - 8 + Math.cos(pTick * 4) * 6, sparkY + 6, 2, 2);
    }

    // Cat Speech Bubble
    if (catState.speechText) {
      ctx.font = "bold 9.5px 'Inter', sans-serif";
      const tw = ctx.measureText(catState.speechText).width;
      const bw = tw + 16;
      const bh = 22;
      const bx = x - bw / 2;
      const by = y - 38;

      ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(catState.speechText, x, by + 14);
    }

    ctx.restore();
  }

  // --- VISITOR / INCOMING AGENT CHARACTER ---
  drawVisitorCharacter(x, y) {
    const ctx = this.ctx;
    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red Hoodie/Jacket
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(x - 7, y - 6, 14, 14);

    // Head & Hair
    ctx.fillStyle = "#fed7aa";
    ctx.fillRect(x - 6, y - 16, 12, 10);
    ctx.fillStyle = "#78350f";
    ctx.fillRect(x - 7, y - 18, 14, 5);

    // Upward Entrance Arrow
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    ctx.lineTo(x - 5, y + 30);
    ctx.lineTo(x + 5, y + 30);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // --- PARTICLES ---
  drawParticles() {
    const ctx = this.ctx;
    // Hearts from cat / petting
    for (let i = this.heartParticles.length - 1; i >= 0; i--) {
      const p = this.heartParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;

      if (p.alpha <= 0) {
        this.heartParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font = `${p.size}px sans-serif`;
      ctx.fillText("❤️", p.x, p.y);
      ctx.restore();
    }

    // Cozy Tea / Coffee Steam particles
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const sp = this.steamParticles[i];
      sp.y += sp.vy;
      sp.x += (Math.random() - 0.5) * 0.4;
      sp.alpha -= 0.015;

      if (sp.alpha <= 0) {
        this.steamParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = sp.alpha;
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Drifting Sakura Flower Petals in Courtyard Nature Garden
    const cy = ROOM_BOUNDS.courtyard;
    if (Math.random() < 0.22 && this.petalParticles.length < 35) {
      this.petalParticles.push({
        x: cy.x + Math.random() * (cy.w - 10),
        y: cy.y + 10 + Math.random() * 35,
        vx: 0.35 + Math.random() * 0.5,
        vy: 0.3 + Math.random() * 0.45,
        rot: Math.random() * Math.PI,
        color: Math.random() > 0.35 ? "#f472b6" : "#fbcfe8",
        alpha: 0.9
      });
    }

    for (let i = this.petalParticles.length - 1; i >= 0; i--) {
      const pt = this.petalParticles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.rot += 0.04;
      pt.alpha -= 0.005;

      if (pt.alpha <= 0 || pt.x > cy.x + cy.w || pt.y > cy.y + cy.h) {
        this.petalParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- NATURE & GARDEN DRAWING HELPERS ---
  drawSakuraTree(x, y) {
    const ctx = this.ctx;
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 26, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sturdy dark cherry trunk
    ctx.fillStyle = "#451a03";
    ctx.fillRect(x - 6, y - 8, 12, 34);
    ctx.fillStyle = "#78350f";
    ctx.fillRect(x - 4, y - 6, 4, 30);

    // Billowy layered pink cherry blossom canopy
    ctx.fillStyle = "#be185d"; // Deep magenta base shadow
    ctx.beginPath();
    ctx.arc(x, y - 28, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ec4899"; // Vibrant blossom pink
    ctx.beginPath();
    ctx.arc(x - 10, y - 34, 22, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 30, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f472b6"; // Soft pastel blossom highlight
    ctx.beginPath();
    ctx.arc(x - 4, y - 42, 16, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 36, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbcfe8"; // Bright blossom crown
    ctx.beginPath();
    ctx.arc(x - 2, y - 46, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  drawZenFountain(x, y) {
    const ctx = this.ctx;
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer Stone Basin
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(x, y, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Water pool
    ctx.fillStyle = "#0284c7";
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Concentric Animated Water Ripples
    const ripplePhase = (this.ledTick * 2) % (Math.PI * 2);
    const ripR1 = 4 + Math.sin(ripplePhase) * 6;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(2, ripR1), Math.max(1, ripR1 * 0.45), 0, 0, Math.PI * 2);
    ctx.stroke();

    // Central fountain jet / bubbler
    ctx.fillStyle = "#ffffff";
    const bubY = Math.sin(this.ledTick * 6) * 3;
    ctx.fillRect(x - 1, y - 8 + bubY, 2, 6);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(x - 2, y - 9 + bubY, 4, 2);
  }

  drawParkBench(x, y, w = 58, h = 22) {
    const ctx = this.ctx;
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 2, w / 2 + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cast-iron side legs and armrests
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x, y + 4, 4, h);
    ctx.fillRect(x + w - 4, y + 4, 4, h);
    ctx.fillRect(x - 2, y, 6, 4);
    ctx.fillRect(x + w - 4, y, 6, 4);

    // Warm Wooden Slats
    ctx.fillStyle = "#854d0e";
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 3);
    ctx.fill();
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Slat grooves
    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 7);
    ctx.lineTo(x + w - 4, y + 7);
    ctx.moveTo(x + 4, y + 13);
    ctx.lineTo(x + w - 4, y + 13);
    ctx.stroke();
  }

  drawGardenTrellis(x, y, w) {
    const ctx = this.ctx;
    ctx.strokeStyle = "#047857";
    ctx.lineWidth = 1.5;
    for (let tx = x; tx < x + w; tx += 18) {
      // Ivy vine
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.quadraticCurveTo(tx + 6, y + 10, tx, y + 22);
      ctx.stroke();
      // Little flower blossom
      ctx.fillStyle = (tx % 3 === 0) ? "#f472b6" : "#fbbf24";
      ctx.beginPath();
      ctx.arc(tx + 4, y + 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- HELPER GRAPHICS ---
  drawRoomBadge(x, y, text) {
    const ctx = this.ctx;
    ctx.font = "bold 9.5px 'Inter', sans-serif";
    const tw = ctx.measureText(text).width;
    const pw = tw + 18;
    const ph = 18;

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, 9);
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y + 3.5);
  }

  drawAgentDeskBadge(x, y, name, role, color) {
    const ctx = this.ctx;
    const bw = 146;
    const bh = 32;

    // Dark sleek badge card with color accent top border
    ctx.fillStyle = "rgba(10, 15, 26, 0.96)";
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 6);
    ctx.fill();
    ctx.strokeStyle = color || "#f59e0b";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Accent line at top of badge
    ctx.fillStyle = color || "#f59e0b";
    ctx.fillRect(x - bw / 2 + 10, y - bh / 2 + 1, bw - 20, 2);

    // Agent Name
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(name, x, y - 1);

    // Agent Role
    ctx.font = "600 8.5px 'Inter', sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(role, x, y + 10);
  }

  drawBookshelf(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = "#451a03";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    const shelfRows = 3;
    for (let s = 0; s < shelfRows; s++) {
      const sy = y + 8 + s * 16;
      ctx.fillStyle = "#9a3412";
      ctx.fillRect(x + 2, sy + 10, w - 4, 2);

      // Books
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x + 3, sy, 3, 10);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(x + 7, sy, 3, 10);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(x + 11, sy, 3, 10);
      ctx.fillStyle = "#ec4899";
      ctx.fillRect(x + 15, sy, 3, 10);
    }
  }

  drawPottedPlant(x, y, radius = 12) {
    const ctx = this.ctx;
    // Soil shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + radius + 1, radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Terracotta Pot Base & Rim
    ctx.fillStyle = "#b45309";
    ctx.fillRect(x - radius * 0.55, y + 2, radius * 1.1, radius * 0.9);
    ctx.fillStyle = "#d97706";
    ctx.fillRect(x - radius * 0.65, y - 1, radius * 1.3, 4);

    // Soil
    ctx.fillStyle = "#3e1c07";
    ctx.fillRect(x - radius * 0.5, y - 1, radius, 2);

    // Deep foliage base
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.35, radius, 0, Math.PI * 2);
    ctx.fill();

    // Midtone lush green
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(x - 2, y - radius * 0.5, radius * 0.75, 0, Math.PI * 2);
    ctx.arc(x + 3, y - radius * 0.2, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Bright highlight leaves
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.arc(x - 3, y - radius * 0.65, radius * 0.4, 0, Math.PI * 2);
    ctx.arc(x + 2, y - radius * 0.45, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTopiary(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = "#78350f";
    ctx.fillRect(x - 6, y, 12, 14);

    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(x, y - 6, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.arc(x - 2, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTrophy(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = "#d97706";
    ctx.fillRect(x - 4, y + 4, 8, 4);

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(x, y - 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(x - 2, y + 1, 4, 4);
  }

  drawLantern(x, y) {
    const ctx = this.ctx;
    // Glowing warm halo
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 22);
    grad.addColorStop(0, "rgba(251, 191, 36, 0.6)");
    grad.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Lantern fixture
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x - 4, y - 8, 8, 16);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x - 3, y - 6, 6, 12);
  }

  drawPixelTree(x, y) {
    const ctx = this.ctx;
    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + 25, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = "#5c2411";
    ctx.fillRect(x - 6, y - 10, 12, 35);

    // Leaves Cluster (Lush layered pixel circles)
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.arc(x, y - 30, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(x - 8, y - 36, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(x + 10, y - 32, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.arc(x - 4, y - 44, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}
