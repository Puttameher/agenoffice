import { Character, OfficeCat } from "./characters.js";
import {
  DESK_COORDINATES,
  DOOR_COORDINATES,
  ROOM_BOUNDS,
  CAT_COORDINATES,
  MANAGER_MEETING_SPOT,
  RELAXATION_SPOTS
} from "./canvas.js";
import { soundManager } from "./sound.js";
import { getNavZone, NAV_ZONES } from "./pathfinder.js";

export class OfficeManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.characters = new Map(); // id -> Character
    this.workstationOccupants = new Map(); // deskId (1..6) -> characterId
    this.manager = null;
    this.cat = new OfficeCat(CAT_COORDINATES.x, CAT_COORDINATES.y);
    this.catPurrs = 0;
    this.onAgentSpeech = null;
    this.roamInterval = null;

    this.initManager();
    this.startAutonomousRoaming();
  }

  initManager() {
    this.manager = new Character({
      id: "manager",
      name: "Jordan",
      role: "CEO (Orchestrator)",
      deskId: 0,
      isManager: true,
      color: "#f59e0b"
    });
    this.manager.onSay = (char, text) => {
      if (typeof this.onAgentSpeech === "function") {
        this.onAgentSpeech(char, text);
      }
    };
    this.characters.set("manager", this.manager);
    this.characters.set("orchestrator", this.manager);
  }

  getRandomRelaxationSpot(preferredZone = null) {
    let pool = RELAXATION_SPOTS;
    if (preferredZone) {
      const filtered = RELAXATION_SPOTS.filter(s => {
        if (preferredZone === "tea_break" || preferredZone === "context") {
          return s.zone === "tea_break" || s.zone === "context";
        }
        return s.zone === preferredZone;
      });
      if (filtered.length > 0) pool = filtered;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // --- DYNAMIC WORKSTATION ALLOCATION (HOT-DESKING) ---
  assignWorkstationForAgent(agent) {
    if (!agent) return 1;

    // 1. If agent already occupies an active workstation, keep it
    for (const [deskId, occId] of this.workstationOccupants.entries()) {
      if (occId === agent.id) {
        agent.deskId = deskId;
        return deskId;
      }
    }

    // 2. Look for any vacant workstation among desks 1 to 6
    for (let id = 1; id <= 6; id++) {
      if (!this.workstationOccupants.has(id)) {
        this.workstationOccupants.set(id, agent.id);
        agent.deskId = id;
        return id;
      }
    }

    // 3. All 6 workstations are occupied! Look for an IDLE agent to yield their chair
    for (let id = 1; id <= 6; id++) {
      const occId = this.workstationOccupants.get(id);
      const occupant = this.characters.get(occId);
      if (occupant && occupant.id !== agent.id && occupant.state !== "WORKING" && occupant.state !== "TALKING") {
        const displaced = occupant;
        const gardenSpot = this.getRandomRelaxationSpot("garden");

        displaced.say(`Desk is all yours, ${agent.name}! Taking a nature break in the garden 🍃`, 3600);
        displaced.yieldWorkstation(gardenSpot);

        this.workstationOccupants.set(id, agent.id);
        agent.deskId = id;
        agent.say(`Thanks ${displaced.name}! Powering up workstation #${id} 💻`, 3000);
        return id;
      }
    }

    // Fallback: claim desk 1
    this.workstationOccupants.set(1, agent.id);
    agent.deskId = 1;
    return 1;
  }

  releaseWorkstation(agent) {
    if (!agent) return;
    for (const [deskId, occId] of this.workstationOccupants.entries()) {
      if (occId === agent.id) {
        this.workstationOccupants.delete(deskId);
      }
    }
    agent.deskId = null;
  }

  syncAgents(agents) {
    let deskIndex = 1;
    for (const a of agents) {
      // The office layout accommodates 6 open workstations + 1 Manager Jordan
      if (this.characters.size >= 7 && !this.characters.has(a.id)) {
        continue;
      }

      if (!this.characters.has(a.id)) {
        let assignedDesk = null;
        if (deskIndex <= 6 && !this.workstationOccupants.has(deskIndex)) {
          assignedDesk = deskIndex;
          this.workstationOccupants.set(deskIndex, a.id);
          deskIndex++;
        }

        if (!assignedDesk) continue;

        const deskConfig = DESK_COORDINATES[assignedDesk] || { color: "#3b82f6" };
        const char = new Character({
          id: a.id,
          name: a.name,
          role: a.role,
          deskId: assignedDesk,
          isTemporary: !a.permanent,
          color: deskConfig.color || "#3b82f6"
        });

        char.onSay = (c, text) => {
          if (typeof this.onAgentSpeech === "function") {
            this.onAgentSpeech(c, text);
          }
        };
        char.level = a.level || 1;
        char.xp = a.xp || 0;
        char.badges = a.badges || [];
        char.tasksCompleted = a.tasks_completed || 0;
        this.characters.set(a.id, char);
      } else {
        const char = this.characters.get(a.id);
        char.name = a.name;
        char.role = a.role;
        char.level = a.level || 1;
        char.xp = a.xp || 0;
        char.badges = a.badges || [];
        char.tasksCompleted = a.tasks_completed || 0;
        char.onSay = (c, text) => {
          if (typeof this.onAgentSpeech === "function") {
            this.onAgentSpeech(c, text);
          }
        };
      }
    }
  }

  syncIdleCharacters() {
    for (const char of this.characters.values()) {
      if (char.isManager) {
        const d = DESK_COORDINATES[0];
        char.x = d.x;
        char.y = d.y - 15;
        char.targetX = d.x;
        char.targetY = d.y - 15;
      } else if (char.state === "WORKING" || (char.state === "IDLE" && char.deskId)) {
        const d = DESK_COORDINATES[char.deskId] || DOOR_COORDINATES;
        const targetY = d.y + 44;
        char.x = d.x;
        char.y = targetY;
        char.targetX = d.x;
        char.targetY = targetY;
      } else if (char.currentSpot) {
        char.x = char.currentSpot.x;
        char.y = char.currentSpot.y;
        char.targetX = char.currentSpot.x;
        char.targetY = char.currentSpot.y;
      }
    }
  }

  // --- AUTONOMOUS IDLE ROAMING & NATURE EXPLORATION ---
  startAutonomousRoaming() {
    if (this.roamInterval) clearInterval(this.roamInterval);
    this.roamInterval = setInterval(() => {
      this.tickAutonomousRoaming();
    }, 4500);
  }

  tickAutonomousRoaming() {
    const chars = Array.from(this.characters.values()).filter(c =>
      !c.isManager &&
      c.state !== "WORKING" &&
      c.state !== "TALKING" &&
      c.state !== "WALKING" &&
      c.state !== "LEAVING"
    );

    if (chars.length === 0) return;

    const now = Date.now();
    // Pick agents who have spent enough peaceful time at their current location
    const readyAgents = chars.filter(c => (now - (c.lastRoamTime || 0)) > (14000 + Math.random() * 8000));
    if (readyAgents.length === 0) return;

    const roamer = readyAgents[Math.floor(Math.random() * readyAgents.length)];
    roamer.lastRoamTime = now;

    // Check if an open workstation exists
    const openDeskIds = [];
    for (let id = 1; id <= 6; id++) {
      if (!this.workstationOccupants.has(id)) openDeskIds.push(id);
    }

    // 20% chance: if agent has no desk and an open workstation exists, sit down to check emails
    if (openDeskIds.length > 0 && roamer.deskId === null && Math.random() < 0.20) {
      const chosenDesk = openDeskIds[Math.floor(Math.random() * openDeskIds.length)];
      this.workstationOccupants.set(chosenDesk, roamer.id);
      roamer.claimWorkstation(chosenDesk, () => {
        if (Math.random() < 0.5) roamer.say("Checking project updates at desk 📋", 2800);
      });
      return;
    }

    // Check if another agent is already visiting the Break Room / Lounge
    const loungeVisitors = Array.from(this.characters.values()).filter(c => {
      if (c.isManager || c === roamer) return false;
      const zCurr = getNavZone(c.x, c.y);
      const zTgt = getNavZone(c.targetX, c.targetY);
      return zCurr === NAV_ZONES.LOUNGE || zTgt === NAV_ZONES.LOUNGE;
    });
    const isLoungeOccupied = loungeVisitors.length >= 1;

    // 25% chance: if Break Room is free, visit Pixel the cat in the lounge for an interactive play break!
    if (this.cat && !isLoungeOccupied && Math.random() < 0.28) {
      if (roamer.deskId !== null) {
        this.workstationOccupants.delete(roamer.deskId);
        roamer.deskId = null;
      }
      roamer.say("I'm going over to play with Pixel! 🐾", 3000);
      roamer.playWithCat(this.cat, () => {
        this.renderer.addHeart(this.cat.x, this.cat.y);
      });
      return;
    }

    // Explore relaxation spot (Sakura Garden, Zen Fountain, Tea Break Lounge, or empty games)
    const preferredZone = isLoungeOccupied ? "garden" : (Math.random() < 0.5 ? "garden" : "tea_break");
    const spot = this.getRandomRelaxationSpot(preferredZone);
    if (!spot) return;

    // If leaving a computer workstation, free it so others can work!
    if (roamer.deskId !== null) {
      this.workstationOccupants.delete(roamer.deskId);
      roamer.deskId = null;
    }

    roamer.goToRelaxationSpot(spot);
  }

  getAgent(agentId) {
    return this.characters.get(agentId);
  }

  handleBackendEvent(event) {
    const { type, agent_id, task_id, metadata } = event;
    const agent = agent_id ? this.characters.get(agent_id) : null;

    switch (type) {
      case "TASK_CREATED":
        this.renderer.setWorkflowStage("Plan");
        this.manager.say("New task received! Formulating plan...", 3500);
        soundManager.playDispatch();
        break;

      case "AGENT_CREATED":
        if (metadata && metadata.temporary) {
          const tempChar = new Character({
            id: agent_id,
            name: metadata.name || "TempSpecialist",
            role: metadata.role || "Specialist",
            deskId: 6,
            isTemporary: true,
            color: "#f59e0b"
          });
          tempChar.x = DOOR_COORDINATES.x;
          tempChar.y = DOOR_COORDINATES.y;
          this.characters.set(agent_id, tempChar);
          tempChar.say("Specialist entering office!", 3000);
          setTimeout(() => tempChar.goToDesk(), 700);
        }
        break;

      case "AGENT_ASSIGNED":
        this.renderer.setWorkflowStage("Assign");
        const assignedName = metadata?.agent_name || (agent ? agent.name : "Specialist");
        const isCollab = metadata?.is_collaborative;
        const collabName = metadata?.collaborating_agent_name;
        const collabAgent = metadata?.collaborating_agent_id ? this.characters.get(metadata.collaborating_agent_id) : null;

        if (isCollab && collabName) {
          soundManager.playCollabFanfare();
          this.manager.say(`🤝 Swarm Briefing! ${assignedName} & ${collabName}, assemble!`, 3400);
        } else {
          this.manager.say(`${assignedName}, please come over for the project briefing.`, 3200);
        }

        if (agent) {
          this.assignWorkstationForAgent(agent);
          agent.goToManager(() => {
            agent.say(isCollab ? `Lead ready! Pairing with ${collabName || 'reviewer'} 💻` : "I'm ready for the briefing, Jordan!", 2800);
            setTimeout(() => {
              this.manager.say("Zero-hallucination standard! Deliver top tier craftsmanship.", 3000);
              setTimeout(() => {
                agent.say("Understood! Crafting the solution now.", 2400);
                setTimeout(() => {
                  agent.goToDesk(() => {
                    agent.state = "WORKING";
                    soundManager.playType();
                  });
                }, 800);
              }, 1200);
            }, 1000);
          });
        }

        if (collabAgent) {
          this.assignWorkstationForAgent(collabAgent);
          setTimeout(() => {
            collabAgent.say(`Co-pilot standing by to audit & verify 🛡️`, 2800);
            collabAgent.goToDesk(() => {
              collabAgent.state = "WORKING";
            });
          }, 1400);
        }
        break;

      case "AGENT_RETRIEVING":
        break;

      case "AGENT_STARTED":
      case "AGENT_WORKING":
        this.renderer.setWorkflowStage("Execute");
        if (agent) {
          if (!agent.deskId) this.assignWorkstationForAgent(agent);
          agent.state = "WORKING";
          soundManager.playType();
        }
        break;

      case "AGENT_COMPLETED":
        if (agent) {
          agent.state = "IDLE";
          agent.goToManager(() => {
            agent.say("Here is my initial solution draft for your review, Jordan!", 2800);
            setTimeout(() => {
              this.manager.say("Good start, but push precision further! Polish it and run the tests.", 3500);
              setTimeout(() => {
                agent.say("Understood! Refactoring and tightening output now.", 2600);
                setTimeout(() => {
                  agent.goToDesk(() => {
                    agent.state = "WORKING";
                    soundManager.playType();

                    setTimeout(() => {
                      agent.state = "IDLE";
                      agent.goToManager(() => {
                        agent.say("Here is my revised and polished submission, Jordan!", 2800);
                        setTimeout(() => {
                          this.manager.say("Now THAT is excellence! Evaluated Score: 0.98! Approved! 🏆", 3500);
                          setTimeout(() => {
                            agent.say("Thank you, Jordan! Taking a short break in the garden 🌸", 3200);
                            setTimeout(() => {
                              // Yield the workstation so another agent can use it!
                              this.releaseWorkstation(agent);
                              const gardenSpot = this.getRandomRelaxationSpot("garden");
                              agent.goToRelaxationSpot(gardenSpot);
                            }, 800);
                          }, 1400);
                        }, 1200);
                      });
                    }, 2800);
                  });
                }, 800);
              }, 1400);
            }, 1200);
          });
        }
        break;

      case "EVALUATION_COMPLETED":
        this.renderer.setWorkflowStage("Learn");
        const score = metadata?.score !== undefined ? metadata.score : 0.98;
        this.manager.say(`Evaluation verified! Quality score: ${(score).toFixed(2)}`, 3500);
        break;

      case "EXPERIENCE_CREATED":
        this.manager.say("Distilling learning experience for memory...", 3000);
        break;

      case "AGENT_ARCHIVED":
        if (agent) {
          agent.say("Specialist mission complete. Leaving office!", 3000);
          this.releaseWorkstation(agent);
          agent.leaveOffice(() => {
            this.characters.delete(agent_id);
          });
        }
        break;

      case "FEEDBACK_RECEIVED":
        this.manager.say(`Received human rating: ${metadata?.rating || 5}★!`, 3500);
        break;

      case "TASK_COMPLETED":
        this.renderer.setWorkflowStage("Repeat");
        this.manager.say("Task cycle complete! Ready for next.", 3500);
        soundManager.playComplete();
        break;

      case "TASK_FAILED":
        this.manager.say("Task failed. Reviewing error.", 4000);
        if (agent) agent.goToDesk();
        break;
    }
  }

  // --- HIT TESTING FOR MOUSE CLICKS ---
  handleClick(canvasX, canvasY) {
    // 1. Cat Click
    const catX = this.cat ? this.cat.x : CAT_COORDINATES.x;
    const catY = this.cat ? this.cat.y : CAT_COORDINATES.y;
    const catDist = Math.hypot(canvasX - catX, canvasY - catY);
    if (catDist < 30) {
      soundManager.playMeow();
      this.renderer.addHeart(catX, catY);

      // Dispatch an agent to play with Pixel with dynamic petting & wand movements
      let playAgent = null;
      for (const char of this.characters.values()) {
        if (!char.isManager && (char.state === "IDLE" || char.state === "COFFEE" || char.state === "TEA_BREAK")) {
          playAgent = char;
          break;
        }
      }
      if (!playAgent) {
        const pool = Array.from(this.characters.values()).filter(c => !c.isManager);
        if (pool.length > 0) playAgent = pool[Math.floor(Math.random() * pool.length)];
      }

      if (playAgent && this.cat) {
        if (playAgent.deskId !== null) {
          this.workstationOccupants.delete(playAgent.deskId);
          playAgent.deskId = null;
        }
        playAgent.say("Visiting Pixel for interactive playtime! 🐾", 3000);
        playAgent.playWithCat(this.cat);
      } else if (this.cat) {
        this.cat.startPlaying(null);
      }
      return { type: "cat" };
    }

    // 2. Direct Click on ANY Character (at desk, roaming in garden, drinking coffee, or at arcade!)
    for (const char of this.characters.values()) {
      if (Math.hypot(canvasX - char.x, canvasY - (char.y + 4)) < 24) {
        soundManager.playClick();
        if (char.isManager) {
          this.manager.say("Jordan: Standing by to orchestrate your workflow!", 3000);
          return { type: "ceo", agent: this.manager };
        }
        char.say(`Hi! I'm ${char.name}, ${char.role}!`, 3000);
        return { type: "agent_character", agent: char };
      }
    }

    // 3. Task Board Click
    const tb = ROOM_BOUNDS.taskBoard;
    if (canvasX >= tb.x && canvasX <= tb.x + tb.w && canvasY >= tb.y && canvasY <= tb.y + tb.h) {
      soundManager.playClick();
      const itemH = 36;
      for (let i = 0; i < this.renderer.tasks.length; i++) {
        const iy = tb.y + 42 + i * itemH;
        if (canvasY >= iy && canvasY <= iy + itemH) {
          return { type: "task_item", task: this.renderer.tasks[i], index: i };
        }
      }
      return { type: "task_board" };
    }

    // 4. Courtyard Nature Garden Click
    const cy = ROOM_BOUNDS.courtyard;
    if (canvasX >= cy.x && canvasX <= cy.x + cy.w && canvasY >= cy.y && canvasY <= cy.y + cy.h) {
      soundManager.playClick();
      return { type: "room", roomKey: "courtyard", title: "🌿 Courtyard Nature Garden" };
    }

    // 5. Mini Arcade Cabinet Click in Play Room
    const lg = ROOM_BOUNDS.lounge;
    const arcX = lg.x + 120;
    const arcY = lg.y + 40;
    if (canvasX >= arcX && canvasX <= arcX + 44 && canvasY >= arcY && canvasY <= arcY + 80) {
      soundManager.playComplete();
      this.manager.say("Arcade challenge accepted! +20 Creative Focus 👾", 3500);
      const chars = Array.from(this.characters.values()).filter(c => !c.isManager);
      if (chars.length > 0) {
        const gamer = chars[Math.floor(Math.random() * chars.length)];
        gamer.goToArcade(() => {
          setTimeout(() => gamer.goToRelaxationSpot(this.getRandomRelaxationSpot("garden")), 5000);
        });
      }
      return { type: "arcade" };
    }

    // 6. Steaming Tea / Coffee Counter Click
    const tX = lg.x + 22;
    const tY = lg.y + 102;
    if (canvasX >= tX && canvasX <= tX + 85 && canvasY >= tY && canvasY <= tY + 40) {
      soundManager.playClick();
      this.manager.say("Brewing fresh tea! Calling context refresh ☕", 3000);
      const chars = Array.from(this.characters.values()).filter(c => !c.isManager);
      if (chars.length > 0) {
        const agent = chars[Math.floor(Math.random() * chars.length)];
        agent.goToTeaBreak(() => {
          setTimeout(() => agent.goToRelaxationSpot(this.getRandomRelaxationSpot("garden")), 5000);
        });
      }
      return { type: "tea_break" };
    }

    // 7. Workflow Card Click
    const cs = ROOM_BOUNDS.ceoSuite;
    const wfX = cs.x + cs.w + 12;
    const wfY = cs.y + 40;
    if (canvasX >= wfX && canvasX <= wfX + 84 && canvasY >= wfY && canvasY <= wfY + 135) {
      soundManager.playClick();
      return { type: "workflow" };
    }

    // 8. CEO Desk Click
    const d0 = DESK_COORDINATES[0];
    if (Math.hypot(canvasX - d0.x, canvasY - d0.y) < 60) {
      soundManager.playClick();
      this.manager.say("Jordan: Standing by to orchestrate your workflow!", 3000);
      return { type: "ceo", agent: this.manager };
    }

    // 9. Agent Desks (1 to 6) Click
    for (let id = 1; id <= 6; id++) {
      const d = DESK_COORDINATES[id];
      const dist = Math.hypot(canvasX - d.x, canvasY - d.y);
      if (dist < 82) {
        soundManager.playClick();
        const occupantId = this.workstationOccupants.get(id);
        const foundChar = occupantId ? this.characters.get(occupantId) : null;
        if (foundChar) {
          foundChar.say(`Hi! I'm ${foundChar.name}, ${foundChar.role}!`, 3000);
        } else {
          this.manager.say(`Workstation #${id} is open and ready for any agent! 💻`, 3000);
        }
        return { type: "desk", deskId: id, agent: foundChar };
      }
    }

    // 10. Other Rooms Click
    for (const [key, room] of Object.entries(ROOM_BOUNDS)) {
      if (canvasX >= room.x && canvasX <= room.x + room.w && canvasY >= room.y && canvasY <= room.y + room.h) {
        soundManager.playClick();
        return { type: "room", roomKey: key, title: room.title };
      }
    }

    return null;
  }

  handleMouseMove(canvasX, canvasY) {
    // Check desk hover
    let hoveredDesk = null;
    for (let id = 1; id <= 6; id++) {
      const d = DESK_COORDINATES[id];
      if (Math.hypot(canvasX - d.x, canvasY - d.y) < 82) {
        hoveredDesk = id;
        break;
      }
    }
    this.renderer.hoveredDesk = hoveredDesk;

    // Check task item hover
    const tb = ROOM_BOUNDS.taskBoard;
    let hoveredTask = -1;
    if (canvasX >= tb.x && canvasX <= tb.x + tb.w && canvasY >= tb.y + 42 && canvasY <= tb.y + tb.h) {
      const itemH = 36;
      const idx = Math.floor((canvasY - (tb.y + 42)) / itemH);
      if (idx >= 0 && idx < this.renderer.tasks.length) {
        hoveredTask = idx;
      }
    }
    this.renderer.hoveredTaskIndex = hoveredTask;
  }

  updateAndRender() {
    const charList = Array.from(this.characters.values());
    for (const char of charList) {
      char.update();
      char.offsetX = 0; // Reset separation offset
    }

    // Maintain personal space & prevent characters covering each other when standing near same position
    for (let i = 0; i < charList.length; i++) {
      for (let j = i + 1; j < charList.length; j++) {
        const c1 = charList[i];
        const c2 = charList[j];
        // Calculate euclidean distance
        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        if (dist < 26) {
          const overlap = (26 - dist) / 2 + 4;
          if (c1.x <= c2.x) {
            c1.offsetX -= overlap;
            c2.offsetX += overlap;
          } else {
            c1.offsetX += overlap;
            c2.offsetX -= overlap;
          }
        }
      }
    }

    if (this.cat) {
      this.cat.update();
      CAT_COORDINATES.x = Math.round(this.cat.x);
      CAT_COORDINATES.y = Math.round(this.cat.y);
    }

    // Build real-time desk occupant lookup
    const deskOccupants = {};
    for (const [deskId, charId] of this.workstationOccupants.entries()) {
      deskOccupants[deskId] = this.characters.get(charId) || null;
    }

    this.renderer.render(charList, this.cat, deskOccupants);
  }
}
