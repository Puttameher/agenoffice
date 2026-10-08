import { DESK_COORDINATES, DOOR_COORDINATES, MANAGER_MEETING_SPOT, ROOM_BOUNDS } from "./canvas.js";
import { findOfficePath } from "./pathfinder.js";
import { soundManager } from "./sound.js";

export class Character {
  constructor({ id, name, role, deskId = 1, isManager = false, isTemporary = false, color = "#3b82f6" }) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.deskId = deskId;
    this.isManager = isManager;
    this.isTemporary = isTemporary;
    this.color = color;

    // Get assigned desk position and sit directly in ergonomic chair
    const deskPos = DESK_COORDINATES[deskId] || DOOR_COORDINATES;
    this.x = deskPos.x;
    this.y = isManager ? deskPos.y - 15 : deskPos.y + 44;

    this.targetX = this.x;
    this.targetY = this.y;
    this.path = [];
    this.speed = 3.6;

    // State machine: 'IDLE', 'WALKING', 'WORKING', 'TALKING', 'LEAVING', 'GARDEN_BENCH', 'GARDEN_WALK', 'COFFEE', 'PLAYING', 'FOCUS_READ', 'PLAYING_WITH_CAT'
    this.state = "IDLE";
    this.level = 1;
    this.xp = 0;
    this.badges = [];
    this.tasksCompleted = 0;
    this.currentSpot = null;
    this.lastRoamTime = Date.now() + Math.random() * 8000;
    this.walkFrame = 0;
    this.workFrame = 0;
    this.petFrame = 0;
    this.catPlayTarget = null;
    this.speechText = null;
    this.speechTimeout = null;
    this.opacity = 1.0;
    this.onArrival = null;
    this.onSay = null;
    this.offsetX = 0; // Separation offset to prevent overlapping
  }

  say(text, durationMs = 4200) {
    this.speechText = text;
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    this.speechTimeout = setTimeout(() => {
      this.speechText = null;
    }, durationMs);

    try {
      const pitch = this.isManager ? 0.85 : (0.95 + ((this.deskId || 1) * 0.08));
      soundManager.playSpeechBlip(this.x, pitch);
    } catch (e) {}

    if (typeof this.onSay === "function") {
      this.onSay(this, text);
    }
  }

  walkTo(x, y, onArrival = null) {
    this.targetX = x;
    this.targetY = y;
    // Calculate realistic navigation path through room doorways and around desks
    this.path = findOfficePath(this.x, this.y, x, y);
    this.state = "WALKING";
    this.onArrival = onArrival;
  }

  playWithCat(cat, onArrival = null) {
    if (!cat) return;
    this.catPlayTarget = cat;
    const approachX = cat.x > 150 ? cat.x - 28 : cat.x + 28;
    const approachY = cat.y;
    this.walkTo(approachX, approachY, () => {
      this.state = "PLAYING_WITH_CAT";
      this.petFrame = 0;
      if (typeof cat.startPlaying === "function") {
        cat.startPlaying(this);
      }
      this.say("I'm playing with Pixel! Who's a good office cat? 🐾❤️", 3500);
      if (onArrival) onArrival();
    });
  }

  goToDesk(onArrival = null) {
    if (!this.deskId || !DESK_COORDINATES[this.deskId]) {
      this.state = "IDLE";
      if (onArrival) onArrival();
      return;
    }
    const pos = DESK_COORDINATES[this.deskId];
    const targetY = this.isManager ? pos.y - 15 : pos.y + 44;
    this.currentSpot = null;
    this.walkTo(pos.x, targetY, () => {
      this.state = "IDLE";
      if (onArrival) onArrival();
    });
  }

  goToRelaxationSpot(spot, onArrival = null) {
    this.currentSpot = spot;
    this.walkTo(spot.x, spot.y, () => {
      this.state = spot.type || "IDLE";
      if (onArrival) onArrival();
    });
  }

  claimWorkstation(deskId, onArrival = null) {
    this.deskId = deskId;
    this.currentSpot = null;
    this.goToDesk(onArrival);
  }

  yieldWorkstation(destinationSpot = null, onArrival = null) {
    this.deskId = null;
    if (destinationSpot) {
      this.goToRelaxationSpot(destinationSpot, onArrival);
    } else {
      this.goToTeaBreak(onArrival);
    }
  }

  goToManager(onArrival = null) {
    const offsetX = (this.deskId ? (this.deskId % 2 === 0 ? 28 : -28) : 0);
    this.walkTo(MANAGER_MEETING_SPOT.x + offsetX, MANAGER_MEETING_SPOT.y, () => {
      this.state = "TALKING";
      if (onArrival) onArrival();
    });
  }

  goToMeetingRoom(onArrival = null) {
    const mr = ROOM_BOUNDS.meetingRoom;
    this.walkTo(mr.x + mr.w / 2, mr.y + 130, () => {
      this.state = "TALKING";
      if (onArrival) onArrival();
    });
  }

  goToLounge(onArrival = null) {
    this.goToTeaBreak(onArrival);
  }

  goToTeaBreak(onArrival = null) {
    const lg = ROOM_BOUNDS.lounge;
    this.walkTo(lg.x + 60, lg.y + 115, () => {
      this.state = "TEA_BREAK";
      this.say("Holding tea... Refreshing attention context ☕", 3200);
      if (onArrival) onArrival();
    });
  }

  goToTeaBreakRoom(onArrival = null) {
    const tb = ROOM_BOUNDS.teaBreakRoom || ROOM_BOUNDS.contextLab;
    this.walkTo(tb.x + 65, tb.y + 110, () => {
      this.state = "TEA_BREAK";
      this.say("Steeping fresh herbal tea & distilling workflow context 🍵⚡", 3500);
      if (onArrival) onArrival();
    });
  }

  goToArcade(onArrival = null) {
    const lg = ROOM_BOUNDS.lounge;
    this.walkTo(lg.x + 140, lg.y + 115, () => {
      this.state = "PLAYING";
      this.say("Playing retro 8-bit! Creativity boost +15 👾", 3200);
      if (onArrival) onArrival();
    });
  }

  leaveOffice(onArrival = null) {
    this.state = "LEAVING";
    this.walkTo(DOOR_COORDINATES.x, DOOR_COORDINATES.y, () => {
      this.opacity = 0;
      if (onArrival) onArrival();
    });
  }

  update() {
    if (this.state === "WALKING") {
      if (this.path && this.path.length > 0) {
        const nextNode = this.path[0];
        const dx = nextNode.x - this.x;
        const dy = nextNode.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.speed) {
          this.x += (dx / dist) * this.speed;
          this.y += (dy / dist) * this.speed;
          this.walkFrame += 0.24;
        } else {
          this.x = nextNode.x;
          this.y = nextNode.y;
          this.path.shift();

          if (this.path.length === 0) {
            this.state = "IDLE";
            if (this.onArrival) {
              const cb = this.onArrival;
              this.onArrival = null;
              cb();
            }
          }
        }
      } else {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.speed) {
          this.x += (dx / dist) * this.speed;
          this.y += (dy / dist) * this.speed;
          this.walkFrame += 0.24;
        } else {
          this.x = this.targetX;
          this.y = this.targetY;
          this.state = "IDLE";
          if (this.onArrival) {
            const cb = this.onArrival;
            this.onArrival = null;
            cb();
          }
        }
      }
    }

    if (this.state === "WORKING") {
      this.workFrame += 0.22;
    }

    if (this.state === "PLAYING_WITH_CAT") {
      this.petFrame += 0.22;
    }
  }

  draw(ctx) {
    if (this.opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    const x = Math.round(this.x + (this.offsetX || 0));
    const y = Math.round(this.y);

    // Uniformly scale agent character presence to match enlarged workstations
    ctx.translate(x, y);
    ctx.scale(1.28, 1.28);
    ctx.translate(-x, -y);

    const isWalking = this.state === "WALKING";
    const isAtWorkstation = (this.deskId !== null || this.isManager) && (this.state === "WORKING" || this.state === "IDLE" || (this.state === "TALKING" && this.isManager));
    const isRelaxSitting = this.state === "GARDEN_BENCH" || this.state === "COUCH" || (this.currentSpot && (this.currentSpot.sit || this.currentSpot.type === "GARDEN_BENCH" || this.currentSpot.type === "COUCH"));
    const isSitting = !isWalking && (isAtWorkstation || isRelaxSitting);
    const bob = isWalking ? Math.abs(Math.sin(this.walkFrame * 2.6)) * 3 : (isSitting ? 2 : 0);

    // 1. Shadow underneath
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Accurate Animated Stepping or Seated Legs
    this.drawLegs(ctx, x, y - bob, isWalking, isSitting);

    // 3. Body / Clothing custom to agent (with ergonomic chair backrest when seated)
    this.drawAgentBody(ctx, x, y - bob, isSitting);

    // 4. Working State: Tiny Hands/Fingers Typing on Laptop + Code particles
    if (this.state === "WORKING") {
      this.drawTypingAnimation(ctx, x, y - bob);
    }

    // 5. Creative Tea / Coffee Break State
    if (this.state === "TEA_BREAK" || this.state === "COFFEE") {
      // Steaming coffee mug in hand
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 11, y - 2 - bob, 7, 9);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(x + 12, y - 1 - bob, 5, 4);
      // Steam
      ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
      ctx.fillRect(x + 13, y - 6 - bob, 2, 4);

      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("☕", x, y - 34 - bob);
    }

    // 6. Creative Arcade Playing State
    if (this.state === "PLAYING") {
      const sparkle = Math.sin(this.workFrame * 2.5) > 0;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(sparkle ? "👾" : "🕹️", x, y - 34 - bob);
    }

    // 7. Garden Bench Nature State
    if (this.state === "GARDEN_BENCH") {
      const natureIcon = (Math.floor(this.workFrame * 0.5) % 2 === 0) ? "🌸" : "🍃";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(natureIcon, x, y - 34 - bob);
    }

    // 8. Garden Walk Nature State
    if (this.state === "GARDEN_WALK") {
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🌿", x, y - 34 - bob);
    }

    // 9. Tea Break & Context Synthesizer State
    if (this.state === "TEA_BREAK" || this.state === "FOCUS_READ") {
      // Steaming porcelain matcha bowl in hands
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(x + 11, y + 2 - bob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#10b981"; // Fresh matcha green tea
      ctx.beginPath();
      ctx.arc(x + 11, y + 2 - bob, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Rising steam from tea bowl
      ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
      ctx.fillRect(x + 10, y - 4 - bob, 2, 4);

      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🍵", x, y - 34 - bob);
    }

    // 10. Playing with Cat State: Dynamic Animated Hand Movements & Petting Wand!
    if (this.state === "PLAYING_WITH_CAT") {
      const isFacingRight = !this.catPlayTarget || this.catPlayTarget.x >= this.x;
      const dir = isFacingRight ? 1 : -1;

      // Agent bends down towards cat
      const handWave = Math.sin(this.petFrame * 4.0);
      const handCos = Math.cos(this.petFrame * 4.0);
      const handX = x + dir * (12 + handWave * 6);
      const handY = y + 7 + handCos * 3;

      // Outstretched Arm
      ctx.strokeStyle = this.color || "#3b82f6";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x + dir * 6, y);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Hand (skin tone)
      ctx.fillStyle = "#fed7aa";
      ctx.beginPath();
      ctx.arc(handX, handY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Alternating Toy Feather Wand and Petting contact sparkles
      const wandTipX = handX + dir * 12;
      const wandTipY = handY - 4 + handWave * 5;

      // Feather wand stick
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(wandTipX, wandTipY);
      ctx.stroke();

      // Fluttering feather toy on tip
      ctx.fillStyle = "#ec4899";
      ctx.beginPath();
      ctx.ellipse(wandTipX + dir * 3, wandTipY, 5, 2.5, handWave * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Little floating sparkle
      ctx.fillStyle = "#fde047";
      ctx.fillRect(wandTipX + dir * 7, wandTipY - 2, 2, 2);

      // Playful Emoji Bubble
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🐱❤️", x, y - 34 - bob);
    }

    // 11. Speech Bubble on Top of Head
    if (this.speechText) {
      this.drawSpeechBubble(ctx, x, y - 34 - bob, this.speechText);
    } else if (!this.isManager && this.level) {
      // Level Badge above head when resting or working
      ctx.save();
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
      ctx.fillRect(x - 14, y - 36 - bob, 28, 10);
      ctx.strokeStyle = this.level >= 5 ? "#fbbf24" : (this.color || "#38bdf8");
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 14, y - 36 - bob, 28, 10);
      ctx.fillStyle = this.level >= 5 ? "#fbbf24" : "#e2e8f0";
      ctx.fillText(`Lv.${this.level}`, x, y - 28 - bob);
      ctx.restore();
    }

    ctx.restore();
  }

  drawLegs(ctx, x, y, isWalking, isSitting = false) {
    const legW = 5;
    const legH = 9;
    const legY = y + 7;

    if (isSitting) {
      // Accurate Seated Silhouette: Horizontal thighs, bent knees, tucked calves, and feet resting on floor/chair base
      ctx.fillStyle = "#1e293b";
      // Left & right thighs extending horizontally forward
      ctx.fillRect(x - 8, legY - 2, 7, 5);
      ctx.fillRect(x + 1, legY - 2, 7, 5);
      // Calves extending downward from knees
      ctx.fillRect(x - 8, legY + 2, 6, 6);
      ctx.fillRect(x + 2, legY + 2, 6, 6);
      // Shoes / sneakers resting neatly
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x - 9, legY + 7, 7, 3);
      ctx.fillRect(x + 1, legY + 7, 7, 3);
      return;
    }

    const stride = isWalking ? Math.sin(this.walkFrame * 2.6) * 5.5 : 0;
    const liftL = isWalking ? Math.max(0, -Math.sin(this.walkFrame * 2.6) * 3) : 0;
    const liftR = isWalking ? Math.max(0, Math.sin(this.walkFrame * 2.6) * 3) : 0;

    // Dark Trousers
    ctx.fillStyle = "#1e293b";
    // Left leg
    ctx.fillRect(x - 7 - stride, legY, legW, legH - liftL);
    // Right leg
    ctx.fillRect(x + 2 + stride, legY, legW, legH - liftR);

    // Cute Shoes / Sneakers
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x - 8 - stride, legY + legH - 2 - liftL, legW + 2, 3);
    ctx.fillRect(x + 1 + stride, legY + legH - 2 - liftR, legW + 2, 3);
  }

  drawTypingAnimation(ctx, x, y) {
    // Mini Laptop on desk in front of agent
    const lapW = 32;
    const lapH = 9;
    const lapX = x - lapW / 2;
    const lapY = y + 4;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(lapX, lapY, lapW, lapH);
    ctx.fillStyle = "#334155";
    ctx.fillRect(lapX + 2, lapY + 1, lapW - 4, lapH - 2);

    // Glowing screen edge
    ctx.fillStyle = this.color || "#38bdf8";
    ctx.fillRect(lapX + 3, lapY + 2, lapW - 6, 2);

    // Cute Tiny Skin Hands with Rapid Finger-Tapping
    const tapL = Math.sin(this.workFrame * 8) > 0 ? -2 : 1;
    const tapR = Math.cos(this.workFrame * 8) > 0 ? -2 : 1;

    // Left hand
    ctx.fillStyle = "#fed7aa";
    ctx.fillRect(x - 10, lapY - 2 + tapL, 6, 5);
    // Little tapping fingers
    ctx.fillStyle = "#fbcfe8";
    ctx.fillRect(x - 10, lapY + 3 + tapL, 2, 2);
    ctx.fillRect(x - 7, lapY + 3 + tapL, 2, 2);

    // Right hand
    ctx.fillStyle = "#fed7aa";
    ctx.fillRect(x + 4, lapY - 2 + tapR, 6, 5);
    // Little tapping fingers
    ctx.fillStyle = "#fbcfe8";
    ctx.fillRect(x + 5, lapY + 3 + tapR, 2, 2);
    ctx.fillRect(x + 8, lapY + 3 + tapR, 2, 2);

    // Floating Code Sparkles & Particle Clatter
    const sparkle = Math.sin(this.workFrame) > 0;
    ctx.fillStyle = sparkle ? "#38bdf8" : "#10b981";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("💻", x, y - 36);

    const chars = ["0", "1", "⚡", "✦"];
    const curChar = chars[Math.floor(this.workFrame * 1.5) % chars.length];
    ctx.fillStyle = sparkle ? "#facc15" : "#38bdf8";
    ctx.font = "bold 9px monospace";
    ctx.fillText(curChar, x - 14 + ((this.workFrame * 4) % 28), y - 26);
  }

  drawAgentBody(ctx, x, y, isSitting = false) {
    const isCEO = this.isManager || this.id === "manager";
    const nameLower = this.name.toLowerCase();

    // Base Dimensions (Scaled up for bold, clear visibility)
    const bodyW = 24;
    const bodyH = 22;
    const headS = 18;

    // If seated at workstation, render high-back ergonomic chair cushion behind back
    if (isSitting) {
      const chairBackY = y - bodyH / 2 - 4;
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(x - 14, chairBackY, 28, 25, 6);
      ctx.fill();
      ctx.strokeStyle = this.color || (isCEO ? "#fbbf24" : "#38bdf8");
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Padded Armrests Left & Right
      ctx.fillStyle = "#334155";
      ctx.fillRect(x - 16, y - 2, 3, 10);
      ctx.fillRect(x + 13, y - 2, 3, 10);
    }

    if (isCEO) {
      // CEO / Manager (Jordan): Dark navy tailored suit, gold tie, white shirt, headset
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 4, y - bodyH / 2, 8, 9);
      // Gold tie
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(x - 1.5, y - bodyH / 2 + 2, 3, 7);

      // Head
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Hair
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 2, headS + 2, 7);

      // Headset band & red mic light
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - bodyH / 2 - headS + 2, headS / 2 + 1, Math.PI, 0);
      ctx.stroke();

      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x + headS / 2 - 1, y - bodyH / 2 - 4, 3, 3);

    } else if (nameLower.includes("alex")) {
      // Alex (Coding Agent): Brown bomber jacket, backwards cap, blue tee
      ctx.fillStyle = "#78350f";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(x - 5, y - bodyH / 2, 10, 11);

      // Head
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Backwards Cap & Hair
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 3, headS + 2, 8);
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x - headS / 2 + 2, y - bodyH / 2 - headS - 4, headS - 2, 6);

    } else if (nameLower.includes("nova")) {
      // Nova (Research Agent): Purple jacket, magenta bob hair, glasses
      ctx.fillStyle = "#7e22ce";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);
      ctx.fillStyle = "#f3e8ff";
      ctx.fillRect(x - 4, y - bodyH / 2, 8, 10);

      // Head
      ctx.fillStyle = "#ffedd5";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Magenta Bob Hair
      ctx.fillStyle = "#ec4899";
      ctx.fillRect(x - headS / 2 - 2, y - bodyH / 2 - headS - 3, headS + 4, 8);
      ctx.fillRect(x - headS / 2 - 2, y - bodyH / 2 - headS + 2, 4, 11);
      ctx.fillRect(x + headS / 2 - 2, y - bodyH / 2 - headS + 2, 4, 11);

      // Glasses
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x - 6, y - bodyH / 2 - headS + 5, 5, 5);
      ctx.strokeRect(x + 1, y - bodyH / 2 - headS + 5, 5, 5);

    } else if (nameLower.includes("rio")) {
      // Rio (Analysis Agent): Blue polo shirt, short brown hair
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);
      ctx.fillStyle = "#f97316";
      ctx.fillRect(x - 4, y - bodyH / 2, 8, 5);

      // Head
      ctx.fillStyle = "#fde047";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Short brown hair
      ctx.fillStyle = "#5c2411";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 2, headS + 2, 7);

    } else if (nameLower.includes("mika")) {
      // Mika (Content Agent): Emerald casual tee, bright cyan hair
      ctx.fillStyle = "#059669";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);

      // Head
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Vibrant cyan hair
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 3, headS + 2, 8);
      ctx.fillRect(x - headS / 2 - 2, y - bodyH / 2 - headS + 2, 4, 8);

    } else if (nameLower.includes("zane")) {
      // Zane (Design Agent): Olive jacket, green beanie, orange headphones
      ctx.fillStyle = "#4d7c0f";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);

      // Head
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Green beanie hat
      ctx.fillStyle = "#15803d";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 4, headS + 2, 8);

      // Orange headphones
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(x - bodyW / 2 - 3, y - bodyH / 2 - 1, 5, 6);
      ctx.fillRect(x + bodyW / 2 - 2, y - bodyH / 2 - 1, 5, 6);

    } else if (nameLower.includes("taro")) {
      // Taro (Operations Agent): Slate navy vest, white shirt, neat black hair
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);
      ctx.fillStyle = "#334155";
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, 6, bodyH);
      ctx.fillRect(x + bodyW / 2 - 6, y - bodyH / 2, 6, bodyH);

      // Head
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Neat black hair
      ctx.fillStyle = "#09090b";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 2, headS + 2, 7);

    } else {
      // Temporary or custom specialist
      ctx.fillStyle = this.isTemporary ? "#f59e0b" : this.color;
      ctx.fillRect(x - bodyW / 2, y - bodyH / 2, bodyW, bodyH);

      // Head
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(x - headS / 2, y - bodyH / 2 - headS, headS, headS);

      // Hair
      ctx.fillStyle = "#451a03";
      ctx.fillRect(x - headS / 2 - 1, y - bodyH / 2 - headS - 2, headS + 2, 7);
    }

    // Eyes with pupil sparkle
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x - 5, y - bodyH / 2 - headS + 7, 3, 3);
    ctx.fillRect(x + 2, y - bodyH / 2 - headS + 7, 3, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 5, y - bodyH / 2 - headS + 7, 1.2, 1.2);
    ctx.fillRect(x + 2, y - bodyH / 2 - headS + 7, 1.2, 1.2);
  }

  drawSpeechBubble(ctx, x, y, text) {
    ctx.font = "bold 11px 'Inter', sans-serif";
    const maxLineW = 190;
    const words = text.split(" ");
    const lines = [];
    let curLine = "";

    for (const w of words) {
      const testLine = curLine ? `${curLine} ${w}` : w;
      if (ctx.measureText(testLine).width > maxLineW && curLine) {
        lines.push(curLine);
        curLine = w;
      } else {
        curLine = testLine;
      }
    }
    if (curLine) lines.push(curLine);

    let maxW = 0;
    for (const l of lines) {
      const lw = ctx.measureText(l).width;
      if (lw > maxW) maxW = lw;
    }

    const padX = 10;
    const padY = 7;
    const lineH = 14;
    const bw = Math.max(76, maxW + padX * 2);
    const bh = lines.length * lineH + padY * 2;
    const bx = x - bw / 2;
    const by = y - bh - 6;

    // Rounded speech bubble card with agent accent glow
    ctx.fillStyle = "rgba(10, 14, 23, 0.96)";
    ctx.strokeStyle = this.color || "#f59e0b";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    // Pointer Caret
    ctx.fillStyle = "rgba(10, 14, 23, 0.96)";
    ctx.beginPath();
    ctx.moveTo(x - 5, by + bh);
    ctx.lineTo(x + 5, by + bh);
    ctx.lineTo(x, by + bh + 6);
    ctx.fill();

    ctx.strokeStyle = this.color || "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, by + bh);
    ctx.lineTo(x, by + bh + 6);
    ctx.lineTo(x + 5, by + bh);
    ctx.stroke();

    // Text Lines
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    lines.forEach((line, idx) => {
      ctx.fillText(line, bx + bw / 2, by + padY + (idx + 1) * lineH - 3);
    });
  }
}

/**
 * Active Living Office Pet: Pixel the Cat
 * Navigates along realistic paths through doors, roams between relaxation spots,
 * and enthusiastically interacts with playing agents.
 */
export class OfficeCat {
  constructor(x = 64, y = 66) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.path = [];
    this.speed = 1.6;
    this.state = "RESTING"; // "RESTING", "WALKING", "PLAYING"
    this.facing = "right";
    this.walkFrame = 0;
    this.purrFrame = 0;
    this.playFrame = 0;
    this.speechText = null;
    this.speechTimeout = null;
    this.interactingAgent = null;
    this.nextRoamTime = Date.now() + 12000 + Math.random() * 8000;
  }

  say(text, durationMs = 3200) {
    this.speechText = text;
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    this.speechTimeout = setTimeout(() => {
      this.speechText = null;
    }, durationMs);
  }

  walkTo(x, y, onArrival = null) {
    this.targetX = x;
    this.targetY = y;
    this.path = findOfficePath(this.x, this.y, x, y);
    this.facing = x >= this.x ? "right" : "left";
    this.state = "WALKING";
    this.onArrival = onArrival;
  }

  startPlaying(agent) {
    this.interactingAgent = agent;
    this.state = "PLAYING";
    this.playFrame = 0;
    this.facing = agent && agent.x < this.x ? "left" : "right";
    const purrSounds = [
      "Purr... Meow! ❤️",
      "*purrs happily & rolls over* 🐾",
      "Meow! Attention context refreshed! ✨",
      "*bats playfully at fingers* 🐱💖"
    ];
    this.say(purrSounds[Math.floor(Math.random() * purrSounds.length)], 3500);

    setTimeout(() => {
      if (this.state === "PLAYING") {
        this.state = "RESTING";
        this.interactingAgent = null;
      }
    }, 6500);
  }

  update() {
    this.purrFrame += 0.05;

    if (this.state === "WALKING") {
      if (this.path && this.path.length > 0) {
        const nextNode = this.path[0];
        const dx = nextNode.x - this.x;
        const dy = nextNode.y - this.y;
        const dist = Math.hypot(dx, dy);

        this.facing = dx >= 0 ? "right" : "left";

        if (dist > this.speed) {
          this.x += (dx / dist) * this.speed;
          this.y += (dy / dist) * this.speed;
          this.walkFrame += 0.22;
        } else {
          this.x = nextNode.x;
          this.y = nextNode.y;
          this.path.shift();

          if (this.path.length === 0) {
            this.state = "RESTING";
            this.nextRoamTime = Date.now() + 9000 + Math.random() * 11000;
            if (this.onArrival) {
              const cb = this.onArrival;
              this.onArrival = null;
              cb();
            }
          }
        }
      } else {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        this.facing = dx >= 0 ? "right" : "left";

        if (dist > this.speed) {
          this.x += (dx / dist) * this.speed;
          this.y += (dy / dist) * this.speed;
          this.walkFrame += 0.22;
        } else {
          this.x = this.targetX;
          this.y = this.targetY;
          this.state = "RESTING";
          this.nextRoamTime = Date.now() + 9000 + Math.random() * 11000;
          if (this.onArrival) {
            const cb = this.onArrival;
            this.onArrival = null;
            cb();
          }
        }
      }
    } else if (this.state === "PLAYING") {
      this.playFrame += 0.25;
    } else if (this.state === "RESTING") {
      // Natural idle cat roaming within cozy spots
      if (Date.now() > this.nextRoamTime) {
        this.roamToNextSpot();
      }
    }
  }

  roamToNextSpot() {
    // Cat favorite spots (Corner velvet couch, center rug, near foosball, pinball, espresso bar)
    const catSpots = [
      { x: 64, y: 66 },   // corner velvet couch (primary throne)
      { x: 120, y: 120 }, // lounge center rug
      { x: 70, y: 130 },  // near espresso bar
      { x: 185, y: 110 }, // near pinball machine
      { x: 110, y: 185 }, // near foosball table
      { x: 310, y: 160 }  // doorway curiosity peek
    ];

    const target = catSpots[Math.floor(Math.random() * catSpots.length)];
    this.walkTo(target.x, target.y);
  }
}
