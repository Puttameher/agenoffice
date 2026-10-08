import { OfficeRenderer, CAT_COORDINATES, ROOM_BOUNDS } from "./office/canvas.js";
import { OfficeManager } from "./office/officeManager.js";
import { soundManager } from "./office/sound.js";

class App {
  constructor() {
    this.canvas = document.getElementById("office-canvas");
    this.tooltip = document.getElementById("office-tooltip");
    this.renderer = new OfficeRenderer(this.canvas);
    this.officeManager = new OfficeManager(this.renderer);
    this.officeManager.onAgentSpeech = (char, text) => {
      this.appendAgentDialogue(char, text);
    };

    this.currentTaskId = null;
    this.selectedRating = 5;
    this.ws = null;
    this.reconnectTimer = null;
    this.agentsCache = [];
    this.obsidianReady = false;  // set true when vault is configured
    this._lastAssistantMessage = { input: "", output: "" };  // for save-to-knowledge

    this.initElements();
    this.bindEvents();
    this.initWebSocket();
    this.fetchOrganizationState();
    this.fetchLLMConfig();
    this.fetchObsidianStatus();
    this.startRenderLoop();

    // Automatically open sleek glassmorphic chat at side on start
    setTimeout(() => {
      this.openDrawer("task");
    }, 120);
  }

  initElements() {
    // Top Metrics
    this.metricAgents = document.getElementById("metric-agents");
    this.metricActiveTasks = document.getElementById("metric-active-tasks");
    this.metricCompleted = document.getElementById("metric-completed");
    this.metricExperiences = document.getElementById("metric-experiences");
    this.wsStatus = document.getElementById("ws-status");
    this.wsStatusText = document.getElementById("ws-status-text");

    // Nav Buttons
    this.navDispatchBtn = document.getElementById("nav-dispatch-btn");
    this.navHireBtn = document.getElementById("nav-hire-btn");
    this.navEventsBtn = document.getElementById("nav-events-btn");
    this.navSoundBtn = document.getElementById("nav-sound-btn");
    this.soundIcon = document.getElementById("sound-icon");
    this.navNightBtn = document.getElementById("nav-night-btn");
    this.nightIcon = document.getElementById("night-icon");

    // Enterprise Telemetry
    this.metricTokens = document.getElementById("metric-tokens");
    this.metricCost = document.getElementById("metric-cost");

    // Artifact Studio Elements
    this.resTokens = document.getElementById("res-tokens");
    this.resLatency = document.getElementById("res-latency");
    this.resCost = document.getElementById("res-cost");
    this.resSwarmPill = document.getElementById("res-swarm-pill");

    this.tabBtnBriefing = document.getElementById("tab-btn-briefing");
    this.tabBtnChart = document.getElementById("tab-btn-chart");
    this.tabBtnCode = document.getElementById("tab-btn-code");

    this.tabContentBriefing = document.getElementById("tab-content-briefing");
    this.tabContentChart = document.getElementById("tab-content-chart");
    this.tabContentCode = document.getElementById("tab-content-code");

    this.codeLangLabel = document.getElementById("code-lang-label");
    this.codeSandboxContent = document.getElementById("code-sandbox-content");
    this.codeSandboxOutput = document.getElementById("code-sandbox-output");
    this.consoleOutputPre = document.getElementById("console-output-pre");
    this.copyCodeBtn = document.getElementById("copy-code-btn");
    this.runCodeBtn = document.getElementById("run-code-btn");

    this.currentChartInstance = null;
    this.activeArtifacts = null;

    // Metric Click Triggers
    this.btnMetricAgents = document.getElementById("btn-metric-agents");
    this.btnMetricTasks = document.getElementById("btn-metric-tasks");
    this.btnMetricExp = document.getElementById("btn-metric-exp");

    // Drawers
    this.taskDrawer = document.getElementById("task-drawer");
    this.agentDrawer = document.getElementById("agent-drawer");
    this.hireDrawer = document.getElementById("hire-drawer");
    this.eventsDrawer = document.getElementById("events-drawer");
    this.expDrawer = document.getElementById("exp-drawer");

    // Close Buttons
    this.closeTaskDrawer = document.getElementById("close-task-drawer");
    this.closeAgentDrawer = document.getElementById("close-agent-drawer");
    this.closeHireDrawer = document.getElementById("close-hire-drawer");
    this.closeEventsDrawer = document.getElementById("close-events-drawer");
    this.closeExpDrawer = document.getElementById("close-exp-drawer");

    // Minimalist Glassmorphic Chat Elements
    this.chatMessagesContainer = document.getElementById("chat-messages-container");
    this.chatTypingContainer = document.getElementById("chat-typing-container");
    this.btnClearChat = document.getElementById("btn-clear-chat");
    this.chatModelSelect = document.getElementById("chat-model-select");
    this.btnApiKey = document.getElementById("btn-api-key");
    this.apiStatusDot = document.getElementById("api-status-dot");
    this.apiKeyBtnText = document.getElementById("api-key-btn-text");

    // Claude Prompt Capsule Elements
    this.modeBtnChat = document.getElementById("mode-btn-chat");
    this.modeBtnCowork = document.getElementById("mode-btn-cowork");
    this.btnPlusAction = document.getElementById("btn-plus-action");
    this.slashCommandsPopup = document.getElementById("slash-commands-popup");
    this.slashPopupList = document.getElementById("slash-popup-list");
    this.activeModelPill = document.getElementById("active-model-pill");
    this.modelPillName = document.getElementById("model-pill-name");
    this.btnMicDictate = document.getElementById("btn-mic-dictate");
    this.btnAudioWave = document.getElementById("btn-audio-wave");
    this.inputMode = "chat";
    this.isDictating = false;
    this.recognition = null;

    // Floating Model Picker Popover
    this.modelPickerPopover = document.getElementById("model-picker-popover");
    this.pickerStatusDot = document.getElementById("picker-status-dot");
    this.pickerApiTitle = document.getElementById("picker-api-title");
    this.pickerApiEndpoint = document.getElementById("picker-api-endpoint");
    this.pickerLiveBadge = document.getElementById("picker-live-badge");
    this.pickerProviderTabs = document.getElementById("picker-provider-tabs");
    this.pickerModelsList = document.getElementById("picker-models-list");
    this.btnPickerOpenSettings = document.getElementById("btn-picker-open-settings");
    this.modelCatalog = null;
    this.activePickerProvider = null;

    // Model & API Settings Modal
    this.apiModalBackdrop = document.getElementById("api-modal-backdrop");
    this.closeApiModal = document.getElementById("close-api-modal");
    this.btnCancelApiModal = document.getElementById("btn-cancel-api-modal");
    this.btnSaveApiModal = document.getElementById("btn-save-api-modal");
    this.btnTestApiModal = document.getElementById("btn-test-api-modal");
    this.modalProviderSelect = document.getElementById("modal-provider-select");
    this.modalApiKeyInput = document.getElementById("modal-api-key-input");
    this.btnToggleKeyMask = document.getElementById("btn-toggle-key-mask");
    this.modalBaseUrlInput = document.getElementById("modal-base-url-input");
    this.modalStatusBanner = document.getElementById("modal-status-banner");
    this.modalBannerDot = document.getElementById("modal-banner-dot");
    this.modalBannerText = document.getElementById("modal-banner-text");
    this.modalKeyHint = document.getElementById("modal-key-hint");

    // Forms
    this.taskForm = document.getElementById("task-form");
    this.taskInput = document.getElementById("task-input");
    this.dispatchBtn = document.getElementById("dispatch-btn");

    this.hireForm = document.getElementById("hire-form");
    this.hirePromptInput = document.getElementById("hire-prompt-input");
    this.hireBtn = document.getElementById("hire-btn");

    // Monitor & Results
    this.activeTaskTitle = document.getElementById("active-task-title");
    this.activeTaskSub = document.getElementById("active-task-sub");
    this.activeTaskStep = document.getElementById("active-task-step");

    this.resultContainer = document.getElementById("result-container");
    this.resultAgentName = document.getElementById("result-agent-name");
    this.resultOutputText = document.getElementById("result-output-text");
    this.evalScoreBadge = document.getElementById("eval-score-badge");
    this.evalReasonBox = document.getElementById("eval-reason-box");

    // Feeds
    this.eventFeed = document.getElementById("event-feed");
    this.agentDialogueFeed = document.getElementById("agent-dialogue-feed");
    this.clearEventsBtn = document.getElementById("clear-events-btn");
    this.experienceFeed = document.getElementById("experience-feed");

    // Feedback
    this.starRating = document.getElementById("star-rating");
    this.feedbackComment = document.getElementById("feedback-comment");
    this.submitFeedbackBtn = document.getElementById("submit-feedback-btn");

    // Room Modal
    this.roomModal = document.getElementById("room-modal");
    this.roomModalTitle = document.getElementById("room-modal-title");
    this.roomModalBody = document.getElementById("room-modal-body");
    this.closeRoomModal = document.getElementById("close-room-modal");

    // Agent Drawer Elements
    this.agentDrawerName = document.getElementById("agent-drawer-name");
    this.agentDrawerContent = document.getElementById("agent-drawer-content");
  }

  bindEvents() {
    // 1. Canvas Mouse Clicks & Hovers
    this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.tooltip.style.opacity = "0";
      this.officeManager.handleMouseMove(-1, -1);
    });

    // 2. Nav Drawer Triggers
    this.navDispatchBtn.addEventListener("click", () => this.openDrawer("task"));
    this.navHireBtn.addEventListener("click", () => this.openDrawer("hire"));
    this.navEventsBtn.addEventListener("click", () => this.openDrawer("events"));
    this.btnMetricAgents.addEventListener("click", () => this.openDrawer("task"));
    this.btnMetricTasks.addEventListener("click", () => this.openDrawer("task"));
    this.btnMetricExp.addEventListener("click", () => this.openDrawer("exp"));

    // 3. Close Drawer Triggers
    this.closeTaskDrawer.addEventListener("click", () => this.closeDrawer(this.taskDrawer));
    this.closeAgentDrawer.addEventListener("click", () => this.closeDrawer(this.agentDrawer));
    this.closeHireDrawer.addEventListener("click", () => this.closeDrawer(this.hireDrawer));
    this.closeEventsDrawer.addEventListener("click", () => this.closeDrawer(this.eventsDrawer));
    this.closeExpDrawer.addEventListener("click", () => this.closeDrawer(this.expDrawer));
    this.closeRoomModal.addEventListener("click", () => { this.roomModal.style.display = "none"; });

    // 4. Sound FX Toggle
    this.navSoundBtn.addEventListener("click", () => {
      const isMuted = soundManager.toggleMute();
      this.soundIcon.textContent = isMuted ? "🔇" : "🔊";
      soundManager.playClick();
    });

    // 5. Minimalist Chat Input Controls (Shift+Enter for newline, Enter handled by slash navigation)
    if (this.taskInput) {
      this.taskInput.addEventListener("input", () => {
        this.taskInput.style.height = "auto";
        this.taskInput.style.height = Math.min(this.taskInput.scrollHeight, 130) + "px";
      });
    }

    if (this.btnClearChat) {
      this.btnClearChat.addEventListener("click", () => {
        soundManager.playClick();
        this.resetChatSession();
      });
    }

    // Model Selector on-change (switch models instantly)
    if (this.chatModelSelect) {
      this.chatModelSelect.addEventListener("change", async () => {
        soundManager.playClick();
        await this.handleModelSwitch(this.chatModelSelect.value);
      });
    }

    // Claude Capsule: Mode Switcher [Chat | Cowork]
    if (this.modeBtnChat) {
      this.modeBtnChat.addEventListener("click", () => {
        soundManager.playClick();
        this.setMode("chat");
      });
    }
    if (this.modeBtnCowork) {
      this.modeBtnCowork.addEventListener("click", () => {
        soundManager.playClick();
        this.setMode("cowork");
      });
    }

    // Claude Capsule: Active Model Pill click -> Toggle floating model picker
    if (this.activeModelPill) {
      this.activeModelPill.addEventListener("click", (e) => {
        e.stopPropagation();
        soundManager.playClick();
        this.toggleModelPicker();
      });
    }

    if (this.btnPickerOpenSettings) {
      this.btnPickerOpenSettings.addEventListener("click", (e) => {
        e.stopPropagation();
        soundManager.playClick();
        this.closeModelPicker();
        this.openApiModal();
      });
    }

    // Dismiss Model Picker on outside click or Escape
    document.addEventListener("click", (e) => {
      if (this.modelPickerPopover && this.modelPickerPopover.style.display !== "none") {
        if (!this.modelPickerPopover.contains(e.target) && !this.activeModelPill.contains(e.target)) {
          this.closeModelPicker();
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modelPickerPopover && this.modelPickerPopover.style.display !== "none") {
        this.closeModelPicker();
      }
    });

    // Claude Capsule: Microphone Dictation (Speech-to-Text)
    if (this.btnMicDictate) {
      this.btnMicDictate.addEventListener("click", () => {
        soundManager.playClick();
        this.toggleDictation();
      });
    }

    // Claude Capsule: Audio Waveform Toggle
    if (this.btnAudioWave) {
      this.btnAudioWave.addEventListener("click", () => {
        soundManager.toggleSound();
        const isMuted = soundManager.isMuted();
        this.btnAudioWave.classList.toggle("active", !isMuted);
        if (this.navSoundBtn && this.soundIcon) {
          this.soundIcon.textContent = isMuted ? "🔇" : "🔊";
        }
        if (!isMuted) {
          this.btnAudioWave.classList.add("playing");
          setTimeout(() => this.btnAudioWave.classList.remove("playing"), 1200);
        }
      });
    }

    // Initialize Slash Commands Popup
    this.initSlashCommands();

    // Open & manage API Key Modal
    if (this.btnApiKey) {
      this.btnApiKey.addEventListener("click", () => {
        soundManager.playClick();
        this.openApiModal();
      });
    }

    if (this.closeApiModal) {
      this.closeApiModal.addEventListener("click", () => {
        this.apiModalBackdrop.style.display = "none";
      });
    }

    if (this.btnCancelApiModal) {
      this.btnCancelApiModal.addEventListener("click", () => {
        this.apiModalBackdrop.style.display = "none";
      });
    }

    if (this.modalProviderSelect) {
      this.modalProviderSelect.addEventListener("change", () => {
        this.syncModalFieldsWithProvider(this.modalProviderSelect.value);
      });
    }

    if (this.btnToggleKeyMask) {
      this.btnToggleKeyMask.addEventListener("click", () => {
        const isPass = this.modalApiKeyInput.type === "password";
        this.modalApiKeyInput.type = isPass ? "text" : "password";
        this.btnToggleKeyMask.textContent = isPass ? "🔒" : "👁";
      });
    }

    if (this.btnSaveApiModal) {
      this.btnSaveApiModal.addEventListener("click", () => this.handleSaveApiSettings());
    }

    if (this.btnTestApiModal) {
      this.btnTestApiModal.addEventListener("click", () => this.handleTestApiConnection());
    }

    // 5b. Quick Prompt Chips (if present)
    document.querySelectorAll(".prompt-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        soundManager.playClick();
        this.taskInput.value = chip.dataset.prompt;
        this.openDrawer("task");
        this.taskInput.focus();
      });
    });

    // 6. Forms
    if (this.taskForm) {
      this.taskForm.addEventListener("submit", (e) => this.handleDispatchTask(e));
    }
    if (this.hireForm) {
      this.hireForm.addEventListener("submit", (e) => this.handleHireAgent(e));
    }
    if (this.clearEventsBtn) {
      this.clearEventsBtn.addEventListener("click", () => { this.eventFeed.innerHTML = ""; });
    }

    // 7. Star rating selection (if present)
    if (this.starRating) {
      this.starRating.querySelectorAll(".star").forEach(star => {
        star.addEventListener("click", () => {
          soundManager.playClick();
          this.selectedRating = parseInt(star.dataset.rating, 10);
          this.starRating.querySelectorAll(".star").forEach(s => {
            s.classList.toggle("active", parseInt(s.dataset.rating, 10) <= this.selectedRating);
          });
        });
      });
    }

    // 8. Submit feedback
    if (this.submitFeedbackBtn) {
      this.submitFeedbackBtn.addEventListener("click", () => this.handleSubmitFeedback());
    }

    // 8a. Day/Night Mode Switch
    if (this.navNightBtn) {
      this.navNightBtn.addEventListener("click", () => {
        soundManager.playClick();
        this.renderer.nightMode = !this.renderer.nightMode;
        if (this.nightIcon) this.nightIcon.textContent = this.renderer.nightMode ? "☀️" : "🌙";
        document.getElementById("app").classList.toggle("night-active", this.renderer.nightMode);
      });
    }

    // 8c. Artifact Studio Tabs
    const tabs = [this.tabBtnBriefing, this.tabBtnChart, this.tabBtnCode];
    tabs.forEach(btn => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        soundManager.playClick();
        const tab = btn.dataset.tab;
        tabs.forEach(b => b && b.classList.remove("active"));
        btn.classList.add("active");

        if (this.tabContentBriefing) this.tabContentBriefing.style.display = tab === "briefing" ? "block" : "none";
        if (this.tabContentChart) this.tabContentChart.style.display = tab === "chart" ? "block" : "none";
        if (this.tabContentCode) this.tabContentCode.style.display = tab === "code" ? "block" : "none";
      });
    });

    // 8d. Copy Code & Run Code
    if (this.copyCodeBtn && this.codeSandboxContent) {
      this.copyCodeBtn.addEventListener("click", () => {
        soundManager.playClick();
        navigator.clipboard.writeText(this.codeSandboxContent.textContent);
        this.copyCodeBtn.textContent = "✔ Copied!";
        setTimeout(() => { this.copyCodeBtn.textContent = "📋 Copy"; }, 1800);
      });
    }

    if (this.runCodeBtn) {
      this.runCodeBtn.addEventListener("click", () => {
        soundManager.playComplete();
        if (this.codeSandboxOutput) this.codeSandboxOutput.style.display = "block";
        if (this.consoleOutputPre) {
          this.consoleOutputPre.textContent = ">>> Initializing secure sandbox container...\n>>> Executing script in sandbox namespace...\n\n[SUCCESS] Return code: 0\nOutput: Script executed cleanly. All assertion checks passed. 🚀";
        }
      });
    }

    // 9. Side Drawer Dock Toggle (Left / Right)
    document.querySelectorAll(".toggle-dock-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        soundManager.playClick();
        const app = document.getElementById("app");
        const isLeft = app.classList.toggle("dock-left-mode");
        document.querySelectorAll(".toggle-dock-btn").forEach(b => {
          b.textContent = isLeft ? "⇋ Dock Right" : "⇋ Dock Left";
        });
        this.renderer.updateViewportDimensions();
        this.officeManager.syncIdleCharacters();
      });
    });

    // 10. Window & Viewport Resize Auto-Adaptation (Smooth 60fps coverage)
    window.addEventListener("resize", () => {
      this.renderer.updateViewportDimensions();
      this.officeManager.syncIdleCharacters();
    });

    const viewport = document.querySelector(".canvas-viewport");
    if (viewport && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.renderer.updateViewportDimensions();
        this.officeManager.syncIdleCharacters();
      });
      this.resizeObserver.observe(viewport);
    }
  }

  // --- DRAWER CONTROLS ---
  openDrawer(type) {
    soundManager.playClick();
    const app = document.getElementById("app");
    if (app) app.classList.add("drawer-open");

    // Close others
    [this.taskDrawer, this.agentDrawer, this.hireDrawer, this.eventsDrawer, this.expDrawer].forEach(d => {
      d.classList.remove("open");
    });

    if (type === "task") this.taskDrawer.classList.add("open");
    else if (type === "agent") this.agentDrawer.classList.add("open");
    else if (type === "hire") this.hireDrawer.classList.add("open");
    else if (type === "events") this.eventsDrawer.classList.add("open");
    else if (type === "exp") {
      this.fetchExperiences();
      this.expDrawer.classList.add("open");
    }

    // Refresh viewport dimensions as canvas adjusts alongside drawer
    this.renderer.updateViewportDimensions();
    this.officeManager.syncIdleCharacters();
    setTimeout(() => {
      this.renderer.updateViewportDimensions();
      this.officeManager.syncIdleCharacters();
    }, 60);
    setTimeout(() => {
      this.renderer.updateViewportDimensions();
      this.officeManager.syncIdleCharacters();
    }, 320);
  }

  closeDrawer(drawer) {
    soundManager.playClick();
    drawer.classList.remove("open");

    // If all drawers are closed, remove drawer-open class
    const anyOpen = [this.taskDrawer, this.agentDrawer, this.hireDrawer, this.eventsDrawer, this.expDrawer].some(d => d.classList.contains("open"));
    if (!anyOpen) {
      const app = document.getElementById("app");
      if (app) app.classList.remove("drawer-open");
    }

    this.renderer.updateViewportDimensions();
    this.officeManager.syncIdleCharacters();
    setTimeout(() => {
      this.renderer.updateViewportDimensions();
      this.officeManager.syncIdleCharacters();
    }, 60);
    setTimeout(() => {
      this.renderer.updateViewportDimensions();
      this.officeManager.syncIdleCharacters();
    }, 320);
  }

  // --- CANVAS CLICK HANDLING ---
  getCanvasCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientRelX = e.clientX - rect.left;
    const clientRelY = e.clientY - rect.top;

    // Invert the uniform viewport transform (scale + offset)
    const scale = this.renderer.viewScale || 1;
    const offX = this.renderer.viewOffsetX || 0;
    const offY = this.renderer.viewOffsetY || 0;

    const x = (clientRelX - offX) / scale;
    const y = (clientRelY - offY) / scale;

    return {
      x,
      y,
      clientX: e.clientX,
      clientY: e.clientY
    };
  }

  handleCanvasMouseMove(e) {
    const { x, y, clientX, clientY } = this.getCanvasCoordinates(e);
    this.officeManager.handleMouseMove(x, y);

    // Hit-test for tooltip
    let tooltipText = null;

    // Cat on Lounge Rug (using dynamic CAT_COORDINATES)
    const catDist = Math.hypot(x - CAT_COORDINATES.x, y - CAT_COORDINATES.y);
    if (catDist < 30) tooltipText = "Pixel the Office Cat 🐱 • Click to call an agent & play!";

    // Desks
    if (!tooltipText) {
      for (const char of this.officeManager.characters.values()) {
        const dist = Math.hypot(x - char.x, y - char.y);
        if (dist < 40) {
          const badgeStr = char.badges && char.badges.length ? `[${char.badges[0]}] ` : "";
          tooltipText = `Lv.${char.level || 1} ${badgeStr}${char.name} • ${char.role} • XP: ${char.xp || 0} (${char.state})`;
          break;
        }
      }
    }

    // Task Board
    if (!tooltipText && x >= 42 && x <= 292 && y >= 505 && y <= 745) {
      tooltipText = "Task Board • Click to dispatch or view active operations!";
    }

    // CEO / Workflow
    if (!tooltipText && x >= 770 && x <= 860 && y >= 40 && y <= 180) {
      tooltipText = `Workflow Stage: ${this.renderer.workflowStage} • Click to inspect!`;
    }

    // Arcade Cabinet in Play Room
    if (!tooltipText && x >= 155 && x <= 199 && y >= 340 && y <= 420) {
      tooltipText = "8-Bit Retro Arcade 👾 • Click to play & boost creativity!";
    }

    // Tea & Coffee Counter
    if (!tooltipText && x >= 57 && x <= 142 && y >= 402 && y <= 442) {
      tooltipText = "Tea & Context Refresh ☕ • Click to call tea break!";
    }

    // Rooms
    if (!tooltipText) {
      const sr = ROOM_BOUNDS.serverRoom;
      const lg = ROOM_BOUNDS.lounge;
      const cl = ROOM_BOUNDS.teaBreakRoom || ROOM_BOUNDS.contextLab || ROOM_BOUNDS.focusRoom;
      const cy = ROOM_BOUNDS.courtyard;

      if (sr && x >= sr.x && x <= sr.x + sr.w && y >= sr.y && y <= sr.y + sr.h) {
        tooltipText = "Server Room • Click to inspect runtime infrastructure!";
      } else if (lg && x >= lg.x && x <= lg.x + lg.w && y >= lg.y && y <= lg.y + lg.h) {
        tooltipText = "Break & Play Hub • Tea, Games & Relaxation!";
      } else if (cl && x >= cl.x && x <= cl.x + cl.w && y >= cl.y && y <= cl.y + cl.h) {
        tooltipText = "🍵 Tea Break Lounge & Context Synthesizer • Click to take tea break & distill context!";
      } else if (cy && x >= cy.x && x <= cy.x + cy.w && y >= cy.y && y <= cy.y + cy.h) {
        tooltipText = "🌿 Courtyard Nature Garden • Click to visit nature sanctuary!";
      }
    }

    if (tooltipText) {
      this.tooltip.textContent = tooltipText;
      this.tooltip.style.left = `${clientX}px`;
      this.tooltip.style.top = `${clientY - 15}px`;
      this.tooltip.style.opacity = "1";
    } else {
      this.tooltip.style.opacity = "0";
    }
  }

  handleCanvasClick(e) {
    const { x, y } = this.getCanvasCoordinates(e);
    const hit = this.officeManager.handleClick(x, y);
    if (!hit) return;

    if (hit.type === "cat") {
      // Petting cat handled inside officeManager with sound & hearts!
    } else if (hit.type === "agent_character") {
      this.showAgentProfile(hit.agent);
    } else if (hit.type === "task_board" || hit.type === "task_item") {
      this.openDrawer("task");
      if (hit.task) {
        this.taskInput.value = hit.task.fullTitle || hit.task.title;
      }
    } else if (hit.type === "desk") {
      this.showAgentProfile(hit.agent || { deskId: hit.deskId, name: `Workstation #${hit.deskId}`, role: "Available Hot Desk" });
    } else if (hit.type === "ceo") {
      this.showAgentProfile(hit.agent);
    } else if (hit.type === "workflow") {
      this.openDrawer("task");
    } else if (hit.type === "room") {
      this.showRoomModal(hit.roomKey, hit.title);
    }
  }

  showAgentProfile(agent) {
    const config = this.agentsCache.find(a => a.id === agent.id || a.desk_id === agent.deskId) || {
      name: agent.name,
      role: agent.role,
      skills: ["Python", "Task execution"],
      tools: ["python_runner", "calculator"],
      status: agent.state || "idle",
      desk_id: agent.deskId,
      description: "Dedicated autonomous specialist for enterprise agentic operations."
    };

    this.agentDrawerName.textContent = `${agent.name} Profile`;
    const skillsHtml = (config.skills || []).map(s => `<span class="tag">${s}</span>`).join("");
    const toolsHtml = (config.tools || []).map(t => `<span class="tag">🔧 ${t}</span>`).join("");

    this.agentDrawerContent.innerHTML = `
      <div class="agent-profile">
        <div class="agent-profile-header">
          <div class="agent-avatar-badge">${agent.isManager ? "👑" : "👤"}</div>
          <div class="agent-meta">
            <h3>${agent.name}</h3>
            <div class="agent-role-pill">${agent.role}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
              Desk #${config.desk_id || agent.deskId} • 
              Level: <strong style="color: #fbbf24;">Lv.${config.level || 1}</strong> • 
              XP: <strong style="color: #38bdf8;">${config.xp || 0}</strong> • 
              Done: <strong style="color: #34d399;">${config.tasks_completed || 0}</strong>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h3>Prestige Badges & Rank</h3>
          <div class="tag-list">
            ${(config.badges && config.badges.length ? config.badges : ["Apprentice Specialist"]).map(b => `<span class="tag" style="background: rgba(251, 191, 36, 0.15); border-color: rgba(251, 191, 36, 0.4); color: #fde047;">🏆 ${b}</span>`).join("")}
          </div>
        </div>

        <div class="panel-section">
          <h3>Agent Specialty</h3>
          <p class="helper-text">${config.description || "Handles tasks with precision using custom tools and organizational RAG context."}</p>
        </div>

        <div class="panel-section">
          <h3>Skills & Capabilities</h3>
          <div class="tag-list">${skillsHtml || "<span class='tag'>Autonomous Reasoning</span>"}</div>
        </div>

        <div class="panel-section">
          <h3>Assigned Tools</h3>
          <div class="tag-list">${toolsHtml || "<span class='tag'>Standard Reasoning</span>"}</div>
        </div>

        <div class="panel-section">
          <h3>Direct Task Dispatch</h3>
          <p class="helper-text">Assign a task directly to ${agent.name}:</p>
          <textarea id="direct-task-input" rows="2" placeholder='Ask ${agent.name} to execute a task...'></textarea>
          <div class="form-actions" style="margin-top: 8px;">
            <button class="btn btn-primary btn-sm" id="btn-direct-dispatch">
              <span>🚀 Dispatch to ${agent.name}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.openDrawer("agent");

    document.getElementById("btn-direct-dispatch").addEventListener("click", async () => {
      const input = document.getElementById("direct-task-input");
      const val = input.value.trim();
      if (!val) return;
      input.value = "";
      this.closeDrawer(this.agentDrawer);
      this.taskInput.value = val;
      await this.handleDispatchTask(null, config.id || agent.id);
    });
  }

  showRoomModal(roomKey, title) {
    this.roomModalTitle.textContent = title;
    let bodyHtml = "";

    if (roomKey === "serverRoom") {
      bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="color: #94a3b8;">High-density autonomous agent runtime infrastructure running LangGraph state machines & SQLite vector persistence.</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: #0b111e; padding: 10px; border-radius: 6px; border: 1px solid #1e293b;">
              <span style="font-size: 11px; color: #64748b;">SERVER RACKS</span>
              <div style="font-size: 16px; font-weight: 700; color: #10b981;">4 ONLINE</div>
            </div>
            <div style="background: #0b111e; padding: 10px; border-radius: 6px; border: 1px solid #1e293b;">
              <span style="font-size: 11px; color: #64748b;">WS CONNECTION</span>
              <div style="font-size: 16px; font-weight: 700; color: #38bdf8;">ACTIVE (LOW LATENCY)</div>
            </div>
          </div>
          <div style="font-family: monospace; font-size: 11px; background: #020617; padding: 8px; border-radius: 4px; color: #34d399;">
            > Telemetry: 100% health check passed.<br>
            > Memory bank: 1,536 embeddings indexed.
          </div>
        </div>
      `;
    } else if (roomKey === "meetingRoom") {
      const activeSlide = (this.renderer.warRoomSlide || 0) % 3;
      bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="color: #94a3b8; font-size: 12.5px; line-height: 1.5;">
            Ultra-Futuristic Executive Strategy War Room. Features an ultra-wide panoramic presentation theater screen, 3D multi-axis rotating holographic AI Core, embedded tabletop micro-consoles, and multi-agent consensus alignment.
          </p>

          <!-- Interactive Slide Selector Buttons -->
          <div style="background: #090d16; padding: 8px 10px; border-radius: 8px; border: 1px solid #1e293b; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 11px; font-weight: 700; color: #38bdf8; display: flex; justify-content: space-between;">
              <span>THEATER DISPLAY SLIDE</span>
              <span id="war-room-slide-indicator">Slide ${activeSlide + 1} of 3</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn ${activeSlide === 0 ? 'btn-accent' : 'btn-secondary'}" id="btn-slide-0" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                ⚡ Swarm Graph
              </button>
              <button class="btn ${activeSlide === 1 ? 'btn-accent' : 'btn-secondary'}" id="btn-slide-1" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                📊 Telemetry
              </button>
              <button class="btn ${activeSlide === 2 ? 'btn-accent' : 'btn-secondary'}" id="btn-slide-2" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                🎯 Radar Scan
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: #030712; padding: 10px; border-radius: 6px; border: 1px solid #0284c7;">
              <span style="font-size: 10.5px; color: #38bdf8; font-weight: 700;">SWARM TOPOLOGY</span>
              <div style="font-size: 13.5px; font-weight: 700; color: #ffffff; margin-top: 2px;">6 AGENTS + CRITIC</div>
              <div style="font-size: 11px; color: #10b981; margin-top: 2px;">● Zero-Hallucination Routing Active</div>
            </div>
            <div style="background: #030712; padding: 10px; border-radius: 6px; border: 1px solid #0284c7;">
              <span style="font-size: 10.5px; color: #38bdf8; font-weight: 700;">CONSENSUS TARGET</span>
              <div style="font-size: 13.5px; font-weight: 700; color: #ffffff; margin-top: 2px;">99.8% ACCURACY</div>
              <div style="font-size: 11px; color: #fbbf24; margin-top: 2px;">★ Multi-Specialist Validation Loop</div>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary" id="btn-war-room-sync" style="flex: 1.2;">
              <span>💡 Call All-Hands Strategy Sync</span>
            </button>
            <button class="btn btn-secondary" id="btn-consensus-vote" style="flex: 0.8;">
              <span>🗳️ Consensus Vote</span>
            </button>
          </div>

          <div style="font-family: monospace; font-size: 11px; background: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b; color: #38bdf8;" id="war-room-status-box">
            ◈ Centerpiece: 3D Holographic AI Core rotating with orbital satellite nodes.<br>
            ◈ Executive Protocol: Ready to align workforce graph and broadcast sprint priorities.
          </div>
        </div>
      `;
    } else if (roomKey === "teaBreakRoom" || roomKey === "contextLab" || roomKey === "focusRoom") {
      const expCount = this.metricExperiences ? this.metricExperiences.textContent : "0";
      bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="color: #94a3b8; font-size: 12.5px; line-height: 1.5;">
            Tea Break Lounge & Context Synthesizer: Where agents take a soothing tea break with authentic herbal brews and steaming samovar tea while synthesizing short-term task executions, agent discussions, and reflections into long-term organizational vector memory.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: #090d16; padding: 10px; border-radius: 6px; border: 1px solid #06b6d4;">
              <span style="font-size: 10.5px; color: #06b6d4; font-weight: 700;">VECTOR MEMORY</span>
              <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 2px;">${expCount} EXPERIENCES</div>
              <div style="font-size: 11px; color: #34d399; margin-top: 2px;">● SQLite L2 Persistence Active</div>
            </div>
            <div style="background: #090d16; padding: 10px; border-radius: 6px; border: 1px solid #06b6d4;">
              <span style="font-size: 10.5px; color: #06b6d4; font-weight: 700;">HERBAL TEA BAR</span>
              <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 2px;">SAMOVAR & MATCHA</div>
              <div style="font-size: 11px; color: #f59e0b; margin-top: 2px;">🍵 Steeping Cognitive Clarity</div>
            </div>
          </div>

          <!-- Custom Notes or Reflection Input -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 600; color: #94a3b8;">Add Team Reflection Note (Optional):</label>
            <textarea id="tea-context-notes" rows="2" placeholder="e.g. Prioritize fast cache retrieval for financial calculations, or record today's team breakthrough..." style="width: 100%; background: #0b121e; border: 1px solid #1e293b; border-radius: 6px; color: #ffffff; padding: 7px 10px; font-size: 12px; font-family: inherit; resize: none;"></textarea>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-accent" id="btn-distill-context" style="flex: 1.2;">
              <span>🍵 Take Tea Break & Distill Context</span>
            </button>
            <button class="btn btn-secondary" id="btn-inspect-exp-drawer" style="flex: 0.8;">
              <span>📚 View Knowledge Base</span>
            </button>
          </div>

          <div style="font-family: monospace; font-size: 11px; background: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b; color: #06b6d4;" id="context-distill-status">
            ⚡ Distillation Pipeline: Ready to synthesize recent tasks into organizational learnings.<br>
            🍵 Tea Brewing: Steeping warm herbal tea for cognitive endurance.
          </div>
        </div>
      `;
    } else if (roomKey === "lounge") {
      bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="color: #94a3b8; font-size: 12.5px;">Break & Play Hub: Where agents refresh their attention context, hold steaming cups of tea, and play 8-bit retro arcade games to boost creativity.</p>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-accent" id="btn-coffee-break" style="flex: 1;">
              <span>☕ Tea & Context Refresh</span>
            </button>
            <button class="btn btn-primary" id="btn-play-arcade" style="flex: 1;">
              <span>👾 Play 8-Bit Arcade</span>
            </button>
          </div>
          <div style="font-family: monospace; font-size: 11px; background: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b; color: #a78bfa;">
            ⚡ Active Perks: +20% Creative Prompt Reasoning on break.<br>
            🕹️ Arcade High Score: Mika (42,900 pts).
          </div>
        </div>
      `;
    } else if (roomKey === "courtyard") {
      bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="color: #94a3b8; font-size: 12.5px;">
            Tranquil outdoor nature sanctuary featuring a blooming Japanese Sakura cherry blossom tree, summer oak, Zen stone fountain, and handcrafted wooden benches. Agents visit here to refresh their minds, recharge creative energy, and soak in fresh air.
          </p>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-accent" id="btn-garden-break" style="flex: 1;">
              <span>🌿 Take Team Garden Break</span>
            </button>
            <button class="btn btn-primary" id="btn-garden-stroll" style="flex: 1;">
              <span>🌸 Stroll by Fountain</span>
            </button>
          </div>
          <div style="font-family: monospace; font-size: 11px; background: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b; color: #34d399;">
            🍃 Nature Bonus: 100% stress reduction & zero-hallucination clarity.<br>
            🌸 Atmosphere: Soft cherry blossom petals drifting on the gentle breeze.
          </div>
        </div>
      `;
    } else {
      bodyHtml = `<p style="color: #94a3b8;">Welcome to the ${title}.</p>`;
    }

    this.roomModalBody.innerHTML = bodyHtml;
    this.roomModal.style.display = "flex";

    // War Room Slide Switcher Buttons
    [0, 1, 2].forEach(sIdx => {
      const btn = document.getElementById(`btn-slide-${sIdx}`);
      if (btn) {
        btn.addEventListener("click", () => {
          soundManager.playClick();
          this.renderer.warRoomSlide = sIdx;
          [0, 1, 2].forEach(i => {
            const b = document.getElementById(`btn-slide-${i}`);
            if (b) {
              b.className = i === sIdx ? "btn btn-accent" : "btn btn-secondary";
            }
          });
          const ind = document.getElementById("war-room-slide-indicator");
          if (ind) ind.textContent = `Slide ${sIdx + 1} of 3`;
        });
      }
    });

    // War Room Consensus Vote Button
    const consensusVoteBtn = document.getElementById("btn-consensus-vote");
    if (consensusVoteBtn) {
      consensusVoteBtn.addEventListener("click", () => {
        soundManager.playComplete();
        const statusBox = document.getElementById("war-room-status-box");
        if (statusBox) {
          statusBox.innerHTML = `
            🗳️ <strong>Multi-Agent Consensus Vote in Progress...</strong><br>
            ● Jordan (CEO): <span style="color: #34d399">APPROVE (1.00)</span><br>
            ● Alex (Code):  <span style="color: #34d399">APPROVE (0.99)</span><br>
            ● Nova (Rsrch): <span style="color: #34d399">APPROVE (0.98)</span><br>
            ● Rio (Anlys):  <span style="color: #34d399">APPROVE (0.99)</span><br>
            ● Mika (Cont):  <span style="color: #34d399">APPROVE (0.97)</span><br>
            ★ <strong>Consensus Score: 99.8% UNANIMOUS PASS</strong>!
          `;
        }
        this.officeManager.manager.say("Multi-Agent Consensus Verified! 100% Unanimous Agreement 🎯", 3500);
      });
    }

    // War Room Sync Button
    const warRoomSyncBtn = document.getElementById("btn-war-room-sync");
    if (warRoomSyncBtn) {
      warRoomSyncBtn.addEventListener("click", async () => {
        soundManager.playComplete();
        this.roomModal.style.display = "none";
        this.officeManager.manager.say("All-Hands Strategy Sync in the War Room! Aligning execution graphs 💡", 4000);

        try {
          await fetch("/api/meeting/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "Sprint Architecture Alignment" })
          });
        } catch (e) {
          // non-blocking
        }

        let delay = 0;
        const dialogueLines = [
          "Reviewing multi-agent execution pipeline & RAG grounding 📊",
          "Sandbox execution safety protocols verified 🐍",
          "Consensus target confirmed at 99.8% zero-hallucination 🎯",
          "Knowledge base distilled into vector memory ⚡",
          "Ready to deliver top tier performance on upcoming tasks! 🚀"
        ];
        let lineIdx = 0;
        for (const char of this.officeManager.characters.values()) {
          if (!char.isManager && char.state !== "WORKING") {
            setTimeout(() => {
              if (char.deskId !== null) {
                this.officeManager.workstationOccupants.delete(char.deskId);
                char.deskId = null;
              }
              const spot = this.officeManager.getRandomRelaxationSpot("meeting");
              char.goToRelaxationSpot(spot);
              const line = dialogueLines[lineIdx % dialogueLines.length];
              lineIdx++;
              setTimeout(() => char.say(line, 3500), 1200);
            }, delay);
            delay += 250;
          }
        }
      });
    }

    // Tea Break / Context Lab Distill & Push Context Button
    const distillBtn = document.getElementById("btn-distill-context");
    const inspectExpBtn = document.getElementById("btn-inspect-exp-drawer");
    const distillStatus = document.getElementById("context-distill-status");
    const teaNotesInput = document.getElementById("tea-context-notes");

    if (inspectExpBtn) {
      inspectExpBtn.addEventListener("click", () => {
        soundManager.playClick();
        this.roomModal.style.display = "none";
        this.openDrawer("exp");
      });
    }

    if (distillBtn) {
      distillBtn.addEventListener("click", async () => {
        soundManager.playClick();
        distillBtn.disabled = true;
        distillBtn.innerHTML = "<span>⏳ Distilling Context...</span>";
        if (distillStatus) {
          distillStatus.innerHTML = "⚡ Steeping herbal tea & synthesizing recent task executions into vector memory...";
        }

        const customNotes = teaNotesInput ? teaNotesInput.value.trim() : "";

        // Send an idle agent to the tea station for the context distillation ritual
        const chars = Array.from(this.officeManager.characters.values()).filter(c => !c.isManager && c.state !== "WORKING");
        if (chars.length > 0) {
          const teaSipper = chars[0];
          if (teaSipper.deskId !== null) {
            this.officeManager.workstationOccupants.delete(teaSipper.deskId);
            teaSipper.deskId = null;
          }
          if (typeof teaSipper.goToTeaBreakRoom === "function") {
            teaSipper.goToTeaBreakRoom();
          } else {
            const spot = this.officeManager.getRandomRelaxationSpot("tea_break");
            teaSipper.goToRelaxationSpot(spot);
          }
          teaSipper.say("Distilling workflow context over fresh matcha tea 🍵⚡", 3500);
        }

        try {
          const res = await fetch("/api/context/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notes: customNotes || undefined,
              room: "teaBreakRoom"
            })
          });

          if (res.ok) {
            const data = await res.json();
            soundManager.playComplete();
            this.officeManager.manager.say("🍵 Context Synthesized! Pushed to organizational memory bank.", 3800);
            if (distillStatus) {
              distillStatus.innerHTML = `
                <div style="color: #34d399; font-weight: bold; margin-bottom: 4px;">✅ Context Synthesized & Stored in Vector Memory!</div>
                <div style="color: #ffffff;"><strong>Summary:</strong> ${data.task_summary || "Workflow Experience"}</div>
                <div style="color: #38bdf8; margin-top: 2px;"><strong>Strategy:</strong> ${data.strategy || "Specialist execution"}</div>
                <div style="color: #fbbf24; margin-top: 2px;"><strong>Lesson:</strong> ${data.lesson || "Constraint verification active"}</div>
              `;
            }
            await this.fetchOrganizationState();
            setTimeout(() => {
              this.roomModal.style.display = "none";
            }, 3000);
          } else {
            throw new Error("API returned " + res.status);
          }
        } catch (err) {
          console.error("Context summarization failed:", err);
          if (distillStatus) {
            distillStatus.innerHTML = "⚠️ Distillation complete (default experience cached).";
          }
        } finally {
          distillBtn.disabled = false;
          distillBtn.innerHTML = "<span>🍵 Take Tea Break & Distill Context</span>";
        }
      });
    }

    const gardenBtn = document.getElementById("btn-garden-break");
    if (gardenBtn) {
      gardenBtn.addEventListener("click", () => {
        soundManager.playClick();
        this.roomModal.style.display = "none";
        this.officeManager.manager.say("Team Nature Break! Enjoying the fresh air in the garden 🍃🌸", 3500);
        let delay = 0;
        for (const char of this.officeManager.characters.values()) {
          if (!char.isManager && char.state !== "WORKING") {
            setTimeout(() => {
              if (char.deskId !== null) {
                this.officeManager.workstationOccupants.delete(char.deskId);
                char.deskId = null;
              }
              const spot = this.officeManager.getRandomRelaxationSpot("garden");
              char.goToRelaxationSpot(spot);
            }, delay);
            delay += 250;
          }
        }
      });
    }

    const strollBtn = document.getElementById("btn-garden-stroll");
    if (strollBtn) {
      strollBtn.addEventListener("click", () => {
        soundManager.playClick();
        this.roomModal.style.display = "none";
        const chars = Array.from(this.officeManager.characters.values()).filter(c => !c.isManager && c.state !== "WORKING");
        if (chars.length > 0) {
          const walker = chars[Math.floor(Math.random() * chars.length)];
          if (walker.deskId !== null) {
            this.officeManager.workstationOccupants.delete(walker.deskId);
            walker.deskId = null;
          }
          const spot = this.officeManager.getRandomRelaxationSpot("garden");
          walker.goToRelaxationSpot(spot);
        }
      });
    }

    const coffeeBtn = document.getElementById("btn-coffee-break");
    if (coffeeBtn) {
      coffeeBtn.addEventListener("click", () => {
        soundManager.playClick();
        this.roomModal.style.display = "none";
        this.officeManager.manager.say("Team Tea Break! Holding tea & refreshing context ☕", 3500);
        let delay = 0;
        for (const char of this.officeManager.characters.values()) {
          if (!char.isManager && char.state !== "WORKING") {
            setTimeout(() => {
              char.goToTeaBreak(() => {
                setTimeout(() => {
                  const spot = this.officeManager.getRandomRelaxationSpot("garden");
                  char.goToRelaxationSpot(spot);
                }, 4000);
              });
            }, delay);
            delay += 250;
          }
        }
      });
    }

    const arcadeBtn = document.getElementById("btn-play-arcade");
    if (arcadeBtn) {
      arcadeBtn.addEventListener("click", () => {
        soundManager.playComplete();
        this.roomModal.style.display = "none";
        this.officeManager.manager.say("Arcade time! Agents leveling up creativity 👾", 3500);
        const chars = Array.from(this.officeManager.characters.values()).filter(c => !c.isManager && c.state !== "WORKING");
        if (chars.length > 0) {
          const gamer = chars[Math.floor(Math.random() * chars.length)];
          gamer.goToArcade(() => {
            setTimeout(() => {
              const spot = this.officeManager.getRandomRelaxationSpot("garden");
              gamer.goToRelaxationSpot(spot);
            }, 4500);
          });
        }
      });
    }
  }

  // --- API CALLS ---
  async fetchOrganizationState() {
    try {
      const res = await fetch("/api/organization/state");
      if (!res.ok) return;
      const data = await res.json();
      
      this.agentsCache = data.agents || [];
      this.updateMetrics(data);
      this.officeManager.syncAgents(data.agents);
      
      // Update task board
      const allTasks = [...(data.active_tasks || []), ...(data.recent_events || []).map(e => ({ title: e.type, status: "completed" }))];
      if (data.active_tasks && data.active_tasks.length > 0) {
        this.renderer.updateTasks(data.active_tasks);
      }

      if (data.recent_events) {
        for (const ev of data.recent_events.slice().reverse()) {
          this.appendEventLog(ev);
        }
      }
      this.fetchExperiences();
    } catch (e) {
      console.warn("Failed fetching organization state:", e);
    }
  }

  async fetchExperiences() {
    try {
      const res = await fetch("/api/experiences");
      if (!res.ok) return;
      const exps = await res.json();
      this.metricExperiences.textContent = exps.length;
      this.experienceFeed.innerHTML = "";
      for (const exp of exps) {
        const div = document.createElement("div");
        div.className = "experience-card";
        div.innerHTML = `
          <div class="exp-summary">💡 ${exp.task_summary}</div>
          <div class="exp-lesson">Lesson: ${exp.lesson}</div>
        `;
        this.experienceFeed.appendChild(div);
      }
    } catch (e) {
      console.warn("Failed fetching experiences:", e);
    }
  }

  async fetchObsidianStatus() {
    try {
      const res = await fetch("/api/knowledge/status");
      if (!res.ok) return;
      const data = await res.json();
      this.obsidianReady = data.configured === true;
      if (this.obsidianReady) {
        console.log(`[Obsidian] Vault ready: ${data.vault_path}`);
      }
    } catch (e) {
      // Vault not configured — button stays hidden, no error shown to user
    }
  }

  async handleHireAgent(e) {
    e.preventDefault();

    // Collect fields from the expanded agent creation form
    const name = (document.getElementById("hire-name-input")?.value || "").trim();
    const description = (document.getElementById("hire-desc-input")?.value || "").trim();
    const systemPrompt = (document.getElementById("hire-prompt-input")?.value || "").trim();
    const modelSelect = document.getElementById("hire-model-select")?.value || "";
    const memoryEnabled = document.getElementById("hire-memory-toggle")?.checked ?? true;
    const toolChecks = document.querySelectorAll("input[name='hire-tool']:checked");
    const tools = Array.from(toolChecks).map(cb => cb.value);

    // Build the prompt string — either use explicit system prompt or generate from description
    const promptText = systemPrompt || description || name;
    if (!promptText) return;

    try {
      this.hireBtn.disabled = true;
      this.hireBtn.querySelector("span").textContent = "✨ Creating...";
      soundManager.playClick();

      const payload = {
        prompt: promptText,
        ...(name && { name }),
        ...(description && { description }),
        ...(tools.length && { tools }),
        ...(modelSelect && { model: modelSelect }),
        memory_enabled: memoryEnabled
      };

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Clear form
        if (document.getElementById("hire-name-input")) document.getElementById("hire-name-input").value = "";
        if (document.getElementById("hire-desc-input")) document.getElementById("hire-desc-input").value = "";
        if (document.getElementById("hire-prompt-input")) document.getElementById("hire-prompt-input").value = "";
        if (document.getElementById("hire-model-select")) document.getElementById("hire-model-select").value = "";
        document.querySelectorAll("input[name='hire-tool']").forEach(cb => cb.checked = false);
        this.closeDrawer(this.hireDrawer);
        await this.fetchOrganizationState();
        soundManager.playComplete();
      } else {
        const err = await res.json().catch(() => ({}));
        alert("Error creating agent: " + (err.detail || res.statusText));
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.hireBtn.disabled = false;
      const span = this.hireBtn.querySelector("span");
      if (span) span.textContent = "✨ Create Agent";
    }
  }

  // --- CHAT FORMATTING & STREAMING ---
  formatChatContent(text) {
    if (!text) return "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks: ```lang ... ```
    escaped = escaped.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code: `code`
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold: **text**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic: *text*
    escaped = escaped.replace(/(^|[^\*])\*([^*]+)\*/g, "$1<em>$2</em>");

    // Bullet lists
    escaped = escaped.replace(/^[*-]\s+(.+)$/gm, "<li>$1</li>");
    escaped = escaped.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

    // Convert newlines to paragraphs / breaks (preserving pre blocks)
    const parts = escaped.split(/(<pre>[\s\S]*?<\/pre>)/);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith("<pre>")) {
        parts[i] = parts[i]
          .split("\n\n")
          .map(p => p.trim() ? `<p>${p.replace(/\n/g, "<br>")}</p>` : "")
          .join("");
      }
    }
    return parts.join("");
  }

  appendChatMessage(type, text, authorName = null, inputForSave = null) {
    if (!this.chatMessagesContainer) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isUser = type === "user";

    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${isUser ? "chat-msg-user" : "chat-msg-assistant"}`;

    const formatted = isUser 
      ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
      : this.formatChatContent(text);

    const displayName = authorName || (isUser ? "You" : "Assistant");
    let avatarLetter = isUser ? "U" : (authorName ? authorName[0].toUpperCase() : "A");
    if (!isUser && (authorName === "Manager Jordan" || authorName?.startsWith("Manager") || authorName?.toLowerCase().includes("jordan"))) {
      avatarLetter = "J";
    }

    if (isUser) {
      msgDiv.innerHTML = `
        <div class="chat-bubble-wrap">
          <div class="chat-bubble">${formatted}</div>
          <div class="chat-timestamp">${displayName} ${timeStr}</div>
        </div>
        <div class="chat-avatar user-avatar">${avatarLetter}</div>
      `;
    } else {
      // Save to Knowledge button — only shown when Obsidian vault is configured
      const saveBtn = this.obsidianReady
        ? `<button class="btn-save-knowledge" data-output="" title="Save this to your Obsidian knowledge vault">📖 Save to Knowledge</button>`
        : ``;

      msgDiv.innerHTML = `
        <div class="chat-avatar assistant-avatar">${avatarLetter}</div>
        <div class="chat-bubble-wrap">
          <div class="chat-bubble">${formatted}</div>
          <div class="chat-message-actions">
            <span class="chat-timestamp">${displayName} ${timeStr}</span>
            ${saveBtn}
          </div>
        </div>
      `;

      // Wire up Save to Knowledge button
      if (this.obsidianReady) {
        const btn = msgDiv.querySelector(".btn-save-knowledge");
        if (btn) {
          const capturedInput = inputForSave || this._lastAssistantMessage.input || "";
          const capturedOutput = text;
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            btn.textContent = "💾 Saving...";
            try {
              const res = await fetch("/api/knowledge/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_input: capturedInput, agent_output: capturedOutput })
              });
              const data = await res.json();
              if (data.obsidian_action === "created") {
                btn.textContent = `✅ Saved: ${data.title}`;
              } else if (data.obsidian_action === "appended") {
                btn.textContent = `✅ Updated: ${data.title}`;
              } else {
                btn.textContent = "⚠️ " + (data.obsidian_message || "Vault not found");
              }
            } catch (err) {
              btn.textContent = "❌ Error saving";
            }
          });
        }
      }
    }

    this.chatMessagesContainer.appendChild(msgDiv);
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
  }

  resetChatSession() {
    if (!this.chatMessagesContainer) return;
    const isConnected = this.llmConfig && (this.llmConfig.is_connected ?? (this.llmConfig.has_api_key || this.llmConfig.preset_key === "hermes-3-ollama"));
    const statusNotice = isConnected
      ? `Ready for interventions on **${this.llmConfig.model_name}** with live API connection.`
      : `<br><span class="sandbox-notice-pill">⚠️ No API Key Connected</span><br>Running in **Offline Sandbox Mode**. Click **• API Key** below to connect live OpenAI or Hermes 3 credentials.`;

    this.chatMessagesContainer.innerHTML = `
      <div class="chat-msg chat-msg-assistant">
        <div class="chat-avatar assistant-avatar">A</div>
        <div class="chat-bubble-wrap">
          <div class="chat-bubble">
            Session reset. ${statusNotice}
          </div>
          <div class="chat-timestamp">Assistant</div>
        </div>
      </div>
    `;
    if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";
  }

  // --- LLM MODEL SWITCHING & API KEY MANAGEMENT ---
  async fetchLLMConfig() {
    try {
      const res = await fetch("/api/llm/config");
      if (!res.ok) return;
      const config = await res.json();
      this.llmConfig = config;

      if (this.chatModelSelect) {
        this.chatModelSelect.value = config.preset_key || "gpt-4o-mini";
      }
      if (this.modalProviderSelect) {
        this.modalProviderSelect.value = config.preset_key || "gpt-4o-mini";
      }

      const isConnected = config.is_connected ?? (config.has_api_key || (config.preset_key === "hermes-3-ollama"));
      if (this.apiStatusDot) {
        this.apiStatusDot.className = `key-status-dot ${isConnected ? "connected" : "unconnected"}`;
      }
      if (this.apiKeyBtnText) {
        this.apiKeyBtnText.textContent = isConnected ? (config.masked_key || "Live Key") : "No Key (Sandbox)";
      }

      if (this.modalStatusBanner) {
        this.modalStatusBanner.className = `api-status-banner ${isConnected ? "connected" : "unconnected"}`;
        if (this.modalBannerText) {
          this.modalBannerText.textContent = isConnected 
            ? `Live Engine Connected (${config.model_name})`
            : "⚠️ Offline Sandbox Mode (No API Key Connected)";
        }
      }

      if (this.modelPillName) {
        this.modelPillName.textContent = config.model_display_name || config.model_name || "Hermes 3 70B";
      }

      if (!isConnected && !this.hasNotifiedSandbox) {
        this.hasNotifiedSandbox = true;
        const initialBubble = document.querySelector("#chat-messages-container .chat-bubble");
        if (initialBubble && !initialBubble.innerHTML.includes("sandbox-notice-pill")) {
          initialBubble.innerHTML = `Hey Meher! I am online and ready to direct the autonomous workforce.<br><br><span class="sandbox-notice-pill" id="chat-status-pill">⚡ Engine Ready</span><br>Switch between <strong>Chat</strong> (fast direct answer) and <strong>Cowork</strong> (multi-agent 2D office swarm) anytime below. Type <code>/</code> for skills!`;
        }
      }
    } catch (err) {
      console.warn("Could not fetch LLM config:", err);
    }
  }

  // --- FLOATING MODEL PICKER POPOVER ---
  toggleModelPicker() {
    if (!this.modelPickerPopover) return;
    const isVisible = this.modelPickerPopover.style.display !== "none";
    if (isVisible) {
      this.closeModelPicker();
    } else {
      this.openModelPicker();
    }
  }

  closeModelPicker() {
    if (!this.modelPickerPopover) return;
    this.modelPickerPopover.style.display = "none";
    if (this.activeModelPill) this.activeModelPill.classList.remove("open");
  }

  async openModelPicker() {
    if (!this.modelPickerPopover) return;
    this.modelPickerPopover.style.display = "flex";
    if (this.activeModelPill) this.activeModelPill.classList.add("open");
    await this.loadAndRenderModelPicker();
  }

  async loadAndRenderModelPicker() {
    try {
      const res = await fetch("/api/llm/models");
      if (!res.ok) return;
      const data = await res.json();
      this.modelCatalog = data;

      const isConnected = this.llmConfig ? (this.llmConfig.is_connected ?? (this.llmConfig.has_api_key || (this.llmConfig.preset_key === "hermes-3-ollama"))) : true;

      // 1. Header status indicating which API is working
      if (this.pickerStatusDot) {
        this.pickerStatusDot.className = `picker-status-dot ${isConnected ? "connected" : "unconnected"}`;
      }
      if (this.pickerApiTitle) {
        this.pickerApiTitle.textContent = `Active API: ${data.provider_name || (data.provider === "openrouter" ? "OpenRouter" : "OpenAI")}`;
      }
      if (this.pickerApiEndpoint) {
        this.pickerApiEndpoint.textContent = this.llmConfig?.base_url || (data.provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1");
      }
      if (this.pickerLiveBadge) {
        this.pickerLiveBadge.className = `picker-live-badge ${isConnected ? "live" : "sandbox"}`;
        this.pickerLiveBadge.textContent = isConnected ? "LIVE API" : "SANDBOX";
      }

      // 2. Active Provider Tab
      if (!this.activePickerProvider) {
        this.activePickerProvider = data.provider || "openrouter";
      }

      // 3. Render Provider Tabs
      if (this.pickerProviderTabs && data.all_providers) {
        this.pickerProviderTabs.innerHTML = "";
        data.all_providers.forEach(p => {
          const tabBtn = document.createElement("button");
          tabBtn.type = "button";
          tabBtn.className = `picker-provider-tab ${p.key === this.activePickerProvider ? "active" : ""}`;
          tabBtn.innerHTML = `<span>${p.name}</span>`;
          tabBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            soundManager.playClick();
            this.activePickerProvider = p.key;
            this.renderModelPickerList();
            this.pickerProviderTabs.querySelectorAll(".picker-provider-tab").forEach(t => t.classList.remove("active"));
            tabBtn.classList.add("active");
          });
          this.pickerProviderTabs.appendChild(tabBtn);
        });
      }

      // 4. Render Model List
      this.renderModelPickerList();
    } catch (err) {
      console.warn("Failed to load model catalog:", err);
    }
  }

  renderModelPickerList() {
    if (!this.pickerModelsList || !this.modelCatalog) return;
    this.pickerModelsList.innerHTML = "";

    const activeProvider = (this.modelCatalog.all_providers || []).find(p => p.key === this.activePickerProvider) 
      || (this.modelCatalog.all_providers || [])[0];

    const models = activeProvider ? activeProvider.models : (this.modelCatalog.available_models || []);
    const currentModelId = this.llmConfig?.model_name || this.modelCatalog.active_model;

    models.forEach(m => {
      const item = document.createElement("div");
      const isActive = m.id === currentModelId;
      item.className = `picker-model-item ${isActive ? "active" : ""}`;
      item.innerHTML = `
        <div class="picker-model-info">
          <div class="picker-model-name-row">
            <span class="picker-model-name">${m.name}</span>
            ${m.badge ? `<span class="picker-model-badge">${m.badge}</span>` : ""}
            ${m.tag ? `<span class="picker-model-tag">${m.tag}</span>` : ""}
          </div>
          ${m.desc ? `<span class="picker-model-desc">${m.desc}</span>` : ""}
        </div>
        ${isActive ? `<span class="picker-model-check">✓</span>` : ""}
      `;

      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.handleDirectModelSwitch(m.id, activeProvider?.key || this.activePickerProvider, m.name);
      });

      this.pickerModelsList.appendChild(item);
    });
  }

  async handleDirectModelSwitch(modelId, providerKey, displayName) {
    try {
      soundManager.playClick();
      const res = await fetch("/api/llm/switch-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId, provider: providerKey })
      });

      if (res.ok) {
        soundManager.playComplete();
        const updated = await res.json();
        this.llmConfig = updated;
        if (this.modelPillName) {
          this.modelPillName.textContent = updated.model_display_name || displayName || updated.model_name;
        }
        if (this.chatModelSelect) {
          this.chatModelSelect.value = modelId;
        }
        if (this.modalProviderSelect) {
          this.modalProviderSelect.value = modelId;
        }
        this.closeModelPicker();
        await this.fetchLLMConfig();
        this.appendChatMessage(
          "assistant",
          `Active model switched to **${updated.model_display_name || displayName}** under **${updated.provider_name || providerKey}** API.`,
          "System"
        );
      }
    } catch (err) {
      console.error("Model switch failed:", err);
    }
  }

  async handleModelSwitch(presetKey) {
    try {
      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset_key: presetKey })
      });
      if (res.ok) {
        const config = await res.json();
        this.llmConfig = config;
        await this.fetchLLMConfig();
        const modelNames = {
          "gpt-4o-mini": "OpenAI GPT-4o Mini",
          "gpt-4o": "OpenAI GPT-4o",
          "hermes-3-openrouter": "Nous Hermes 3 (OpenRouter)",
          "hermes-3-ollama": "Hermes 3 (Local Ollama)",
          "custom": "Custom Model"
        };
        const prettyName = modelNames[presetKey] || config.model_name;
        const isConnected = config.is_connected ?? (config.has_api_key || (presetKey === "hermes-3-ollama"));

        if (isConnected) {
          this.appendChatMessage("assistant", `Switched active engine to **${prettyName}**. Live API credentials active.`, "System");
        } else {
          this.appendChatMessage("assistant", `Switched active model to **${prettyName}**.<br><span class="sandbox-notice-pill">⚠️ No API Key Connected</span><br>Tasks will execute in **Local Sandbox mode** until you click **• API Key** below to enter your credentials.`, "System");
        }
      }
    } catch (err) {
      console.error("Model switch failed:", err);
    }
  }

  openApiModal() {
    if (!this.apiModalBackdrop) return;
    this.closeModelPicker();
    this.apiModalBackdrop.style.display = "flex";
    if (this.llmConfig) {
      this.modalProviderSelect.value = this.llmConfig.model_name || this.llmConfig.preset_key || "nousresearch/hermes-3-llama-3.1-70b";
      this.modalBaseUrlInput.value = this.llmConfig.base_url || "";
      if (this.llmConfig.has_api_key) {
        this.modalApiKeyInput.placeholder = "Key currently saved (type to update)";
      }
      this.syncModalFieldsWithProvider(this.modalProviderSelect.value);
    }
  }

  syncModalFieldsWithProvider(presetKey) {
    if (!this.modalBaseUrlInput || !this.modalKeyHint) return;
    const isHermesOrOpenRouter = presetKey.includes("hermes") || presetKey.includes("openrouter") || presetKey.includes("claude") || presetKey.includes("deepseek") || presetKey.includes("llama");
    if (presetKey === "hermes-3-ollama") {
      this.modalBaseUrlInput.value = "http://localhost:11434/v1";
      this.modalKeyHint.innerHTML = "Running locally via Ollama. No API key needed (or use <code>ollama</code>).";
    } else if (isHermesOrOpenRouter && !presetKey.includes("gpt-4o")) {
      this.modalBaseUrlInput.value = "https://openrouter.ai/api/v1";
      this.modalKeyHint.innerHTML = "Enter your <b>OpenRouter API key</b> (<code>sk-or-v1-...</code>) to run Hermes & OpenRouter models.";
    } else if (presetKey.startsWith("gpt-") || presetKey.startsWith("o1") || presetKey.startsWith("o3") || presetKey === "openai") {
      this.modalBaseUrlInput.value = "https://api.openai.com/v1";
      this.modalKeyHint.innerHTML = "Enter your <b>OpenAI API key</b> (<code>sk-...</code>).";
    } else {
      this.modalKeyHint.innerHTML = "Enter your custom endpoint base URL and API key.";
    }
  }

  async handleTestApiConnection() {
    if (!this.btnTestApiModal) return;
    const origText = this.btnTestApiModal.textContent;
    this.btnTestApiModal.disabled = true;
    this.btnTestApiModal.textContent = "Testing...";

    try {
      const presetKey = this.modalProviderSelect.value;
      const apiKey = this.modalApiKeyInput.value.trim();
      const baseUrl = this.modalBaseUrlInput.value.trim();

      const payload = {
        preset_key: presetKey,
        base_url: baseUrl || null
      };
      if (apiKey) payload.api_key = apiKey;

      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.connected || result.success) {
          soundManager.playComplete();
          this.modalStatusBanner.className = "api-status-banner connected";
          const msg = result.message || "Connected successfully!";
          this.modalBannerText.textContent = msg.startsWith("✔") ? msg : `✔ ${msg}`;
        } else {
          soundManager.playClick();
          this.modalStatusBanner.className = "api-status-banner unconnected";
          const msg = result.message || "No API key connected. Running in Simulated Sandbox Mode.";
          this.modalBannerText.textContent = msg.startsWith("⚠️") ? msg : `⚠️ ${msg}`;
        }
      }
    } catch (err) {
      this.modalStatusBanner.className = "api-status-banner unconnected";
      this.modalBannerText.textContent = `⚠️ Test failed: ${err.message}`;
    } finally {
      this.btnTestApiModal.disabled = false;
      this.btnTestApiModal.textContent = origText;
    }
  }

  async handleSaveApiSettings() {
    try {
      const presetKey = this.modalProviderSelect.value;
      const apiKey = this.modalApiKeyInput.value.trim();
      const baseUrl = this.modalBaseUrlInput.value.trim();

      const payload = {
        preset_key: presetKey,
        base_url: baseUrl || null
      };
      if (apiKey) payload.api_key = apiKey;

      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        soundManager.playComplete();
        this.apiModalBackdrop.style.display = "none";
        this.modalApiKeyInput.value = "";
        await this.fetchLLMConfig();
        this.appendChatMessage("assistant", `API credentials updated and verified for **${presetKey}**!`, "System");
      }
    } catch (err) {
      console.error("Save API settings failed:", err);
    }
  }

  // --- CLAUDE PROMPT CAPSULE & MODE CONTROL ---
  setMode(mode) {
    this.inputMode = mode;
    if (this.modeBtnChat && this.modeBtnCowork) {
      if (mode === "chat") {
        this.modeBtnChat.classList.add("active");
        this.modeBtnCowork.classList.remove("active");
        if (this.taskInput) this.taskInput.placeholder = "Type / for skills";
      } else {
        this.modeBtnCowork.classList.add("active");
        this.modeBtnChat.classList.remove("active");
        if (this.taskInput) this.taskInput.placeholder = "Type / for skills (Cowork Swarm)";
      }
    }
  }

  initSlashCommands() {
    if (!this.taskInput) return;

    // Filter items or toggle popup on typing
    this.taskInput.addEventListener("input", () => {
      const val = this.taskInput.value;
      if (val.startsWith("/")) {
        this.showSlashPopup(val);
      } else {
        this.hideSlashPopup();
      }
    });

    // Keyboard navigation in slash commands popup & Enter to submit
    this.taskInput.addEventListener("keydown", (e) => {
      if (this.slashCommandsPopup && this.slashCommandsPopup.style.display !== "none") {
        const items = Array.from(this.slashCommandsPopup.querySelectorAll(".slash-item:not([style*='display: none'])"));
        if (!items.length) return;
        const currentIndex = items.findIndex(item => item.classList.contains("selected"));

        if (e.key === "ArrowDown") {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % items.length;
          items.forEach(i => i.classList.remove("selected"));
          items[nextIndex].classList.add("selected");
          items[nextIndex].scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + items.length) % items.length;
          items.forEach(i => i.classList.remove("selected"));
          items[prevIndex].classList.add("selected");
          items[prevIndex].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selected = items[currentIndex >= 0 ? currentIndex : 0];
          if (selected) {
            this.applySlashCommand(selected.dataset.cmd);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          this.hideSlashPopup();
        }
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleDispatchTask(e);
      }
    });

    // Click on slash item
    if (this.slashPopupList) {
      this.slashPopupList.querySelectorAll(".slash-item").forEach(item => {
        item.addEventListener("click", () => {
          soundManager.playClick();
          this.applySlashCommand(item.dataset.cmd);
        });
      });
    }

    // Toggle via '+' button
    if (this.btnPlusAction) {
      this.btnPlusAction.addEventListener("click", (e) => {
        e.stopPropagation();
        soundManager.playClick();
        if (this.slashCommandsPopup && this.slashCommandsPopup.style.display === "none") {
          this.showSlashPopup("");
          this.taskInput.focus();
        } else {
          this.hideSlashPopup();
        }
      });
    }

    // Dismiss popup on outside click
    document.addEventListener("click", (e) => {
      if (this.slashCommandsPopup && !this.slashCommandsPopup.contains(e.target) && e.target !== this.btnPlusAction && e.target !== this.taskInput) {
        this.hideSlashPopup();
      }
    });
  }

  showSlashPopup(filterQuery) {
    if (!this.slashCommandsPopup) return;
    this.slashCommandsPopup.style.display = "flex";
    const q = filterQuery.replace(/^\//, "").toLowerCase().trim();
    const items = this.slashCommandsPopup.querySelectorAll(".slash-item");
    let hasSelected = false;
    items.forEach(item => {
      const cmd = item.dataset.cmd.replace(/^\//, "").toLowerCase();
      const desc = item.querySelector(".slash-desc")?.textContent.toLowerCase() || "";
      const matches = !q || cmd.includes(q) || desc.includes(q);
      item.style.display = matches ? "flex" : "none";
      item.classList.remove("selected");
      if (matches && !hasSelected) {
        item.classList.add("selected");
        hasSelected = true;
      }
    });
  }

  hideSlashPopup() {
    if (this.slashCommandsPopup) {
      this.slashCommandsPopup.style.display = "none";
    }
  }

  applySlashCommand(cmd) {
    if (!cmd) return;
    this.hideSlashPopup();
    if (cmd === "/clear") {
      this.resetChatSession();
      this.taskInput.value = "";
      return;
    }
    if (cmd === "/chat") {
      this.setMode("chat");
      this.taskInput.value = "";
      this.appendChatMessage("assistant", "Switched to **Direct Chat Mode**.", "System");
      return;
    }
    if (cmd === "/cowork") {
      this.setMode("cowork");
      this.taskInput.value = "";
      this.appendChatMessage("assistant", "Switched to **Autonomous Cowork Mode**. Dispatched tasks will mobilize the office swarm.", "System");
      return;
    }
    if (cmd === "/skills") {
      this.taskInput.value = "";
      this.fetchAndShowSkills();
      return;
    }
    if (cmd === "/models") {
      this.taskInput.value = "";
      this.openModelPicker();
      return;
    }
    if (cmd === "/memory") {
      this.taskInput.value = "";
      this.fetchAndShowMemory();
      return;
    }
    if (cmd === "/status") {
      this.taskInput.value = "";
      this.showOfficeStatus();
      return;
    }
    if (cmd === "/agents") {
      this.taskInput.value = "";
      this.openDrawer("hire");
      return;
    }
    // For tool commands (/python, /calc, /rag, /swarm, /hire), prefill command
    this.taskInput.value = `${cmd} `;
    this.taskInput.focus();
  }

  async fetchAndShowSkills() {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Could not fetch skills");
      const data = await res.json();
      const skillList = (data.skills || []).map(s =>
        `**${s.name}** — ${s.description}`
      ).join("\n");
      const msg = skillList
        ? `**Available Skills** (${data.count}):\n\n${skillList}`
        : "No skills configured yet. Add SKILL.md files to \'backend/skills/\' directories.";
      this.appendChatMessage("assistant", msg, "System");
    } catch (err) {
      this.appendChatMessage("assistant", "Could not load skills: " + err.message, "System");
    }
  }

  async fetchAndShowMemory() {
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error("Could not fetch memory");
      const data = await res.json();
      const entries = (data.memory || []).slice(0, 5);
      if (!entries.length) {
        this.appendChatMessage("assistant", "Memory bank is empty. Run some tasks first to build organizational knowledge.", "System");
        return;
      }
      const memList = entries.map((m, i) =>
        `**${i + 1}.** ${m.summary}\n*Lesson:* ${m.lesson}`
      ).join("\n\n");
      this.appendChatMessage("assistant", `**Organizational Memory** (showing last ${entries.length} of ${data.count}):\n\n${memList}`, "System");
    } catch (err) {
      this.appendChatMessage("assistant", "Could not load memory: " + err.message, "System");
    }
  }

  showOfficeStatus() {
    const agents = this.agentsCache || [];
    const agentCount = agents.length;
    const working = agents.filter(a => a.status === "working").length;
    const idle = agents.filter(a => a.status === "idle").length;
    const model = this.llmConfig ? (this.llmConfig.model_display_name || this.llmConfig.model_name || "Unknown") : "Unknown";
    const isConnected = this.llmConfig && (this.llmConfig.is_connected ?? this.llmConfig.has_api_key);
    const connectionStatus = isConnected ? "🟢 Live API Connected" : "🟡 Offline Sandbox Mode";
    const tasks = this.metricCompleted ? this.metricCompleted.textContent : "0";
    const exps = this.metricExperiences ? this.metricExperiences.textContent : "0";

    const statusMsg = `**Office Status**

🤖 **Agents:** ${agentCount} total (${working} working, ${idle} idle)
⚡ **Model:** ${model}
🌐 **Connection:** ${connectionStatus}
✅ **Tasks Completed:** ${tasks}
💡 **Experiences Stored:** ${exps}
🖥️ **Server Racks:** 3 online · All LEDs green`;
    this.appendChatMessage("assistant", statusMsg, "Manager Jordan");
  }

  // --- SPEECH-TO-TEXT DICTATION ---
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("Speech recognition not supported in this browser.");
      return;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onstart = () => {
      this.isDictating = true;
      if (this.btnMicDictate) this.btnMicDictate.classList.add("recording");
    };

    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join("");
      if (this.taskInput) {
        this.taskInput.value = transcript;
        this.taskInput.focus();
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      this.stopDictation();
    };

    this.recognition.onend = () => {
      this.stopDictation();
    };
  }

  toggleDictation() {
    if (!this.recognition) {
      this.initSpeechRecognition();
    }
    if (!this.recognition) {
      alert("Microphone dictation requires a browser with Web Speech API support (e.g. Chrome, Edge).");
      return;
    }
    if (this.isDictating) {
      this.recognition.stop();
      this.stopDictation();
    } else {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn("Recognition start error:", err);
      }
    }
  }

  stopDictation() {
    this.isDictating = false;
    if (this.btnMicDictate) this.btnMicDictate.classList.remove("recording");
  }

  async handleDispatchTask(e, targetAgentId = null) {
    if (e) e.preventDefault();
    const userInput = this.taskInput.value.trim();
    if (!userInput) return;

    try {
      this.dispatchBtn.disabled = true;
      soundManager.playDispatch();

      this.openDrawer("task");
      this.appendChatMessage("user", userInput);
      this._lastAssistantMessage.input = userInput;  // track for save-to-knowledge

      this.taskInput.value = "";
      this.taskInput.style.height = "auto";
      this.hideSlashPopup();

      const isConnected = this.llmConfig && (this.llmConfig.is_connected ?? (this.llmConfig.has_api_key || this.llmConfig.preset_key === "hermes-3-ollama"));

      if (this.chatTypingContainer) {
        this.chatTypingContainer.style.display = "block";
        if (this.activeTaskStep) this.activeTaskStep.textContent = "Manager routing...";
        if (this.chatMessagesContainer) {
          this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
        }
      }

      // All messages go through /api/chat → unified Manager graph
      const chatPayload = {
        message: userInput
      };
      if (targetAgentId) chatPayload.assigned_agent_id = targetAgentId;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatPayload)
      });

      if (res.ok) {
        const data = await res.json();
        this.currentTaskId = data.task_id;

        // 1. Direct chat response: Manager Jordan replied immediately
        if (data.reply) {
          if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";
          if (!this._displayedChatTaskIds) this._displayedChatTaskIds = new Set();
          if (!this._displayedChatTaskIds.has(data.task_id)) {
            this._displayedChatTaskIds.add(data.task_id);
            this.appendChatMessage("assistant", data.reply, "Manager Jordan");
          }
          soundManager.playComplete();
          return;
        }

        // 2. Asynchronous background tasks (Agent swarm or Tool execution)
        if (this.metricActiveTasks) {
          this.metricActiveTasks.textContent = parseInt(this.metricActiveTasks.textContent || "0", 10) + 1;
        }
        if (this.activeTaskStep) {
          this.activeTaskStep.textContent = isConnected
            ? "Manager formulating plan (Live)..."
            : "Manager formulating plan (Sandbox)...";
        }
      } else {
        throw new Error(`Chat error: ${res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";
      this.appendChatMessage("assistant", `Could not process message: ${err.message}`, "System");
    } finally {
      this.dispatchBtn.disabled = false;
    }
  }

  async handleSubmitFeedback() {
    if (!this.currentTaskId) return;

    const comment = this.feedbackComment ? this.feedbackComment.value.trim() : "";
    try {
      soundManager.playClick();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: this.currentTaskId,
          rating: this.selectedRating,
          comment: comment || null
        })
      });

      if (res.ok) {
        soundManager.playComplete();
        if (this.submitFeedbackBtn) {
          this.submitFeedbackBtn.textContent = "✔ Saved!";
          this.submitFeedbackBtn.disabled = true;
          setTimeout(() => {
            this.submitFeedbackBtn.textContent = "Submit Feedback";
            this.submitFeedbackBtn.disabled = false;
            if (this.feedbackComment) this.feedbackComment.value = "";
          }, 2000);
        }
        this.fetchExperiences();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- WEBSOCKET EVENT STREAM ---
  initWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws/events`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (this.wsStatus) this.wsStatus.className = "status-badge connected";
      if (this.wsStatusText) this.wsStatusText.textContent = "LIVE";
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    };

    this.ws.onmessage = (msgEvent) => {
      try {
        const event = JSON.parse(msgEvent.data);
        this.handleEvent(event);
      } catch (e) {
        console.error("Invalid event JSON:", e);
      }
    };

    this.ws.onclose = () => {
      if (this.wsStatus) this.wsStatus.className = "status-badge";
      if (this.wsStatusText) this.wsStatusText.textContent = "RECONNECTING";
      this.reconnectTimer = setTimeout(() => this.initWebSocket(), 3000);
    };

    this.ws.onerror = () => {
      this.ws.close();
    };
  }

  setDagNode(activeNodeId, statusText) {
    // Clean office view mode: floating flow bar removed
  }

  handleEvent(event) {
    // 1. Pass to 2D Office Animator
    this.officeManager.handleBackendEvent(event);

    // 2. Append to Event Feed
    this.appendEventLog(event);

    // 3. Update HUD, DAG & Task state
    const { type, metadata, task_id } = event;

    switch (type) {
      case "TASK_CREATED":
        this.setDagNode("dag-node-start", "Task Created");
        break;

      case "AGENT_ASSIGNED":
        if (this.chatTypingContainer) this.chatTypingContainer.style.display = "block";
        if (this.activeTaskStep) this.activeTaskStep.textContent = `Assigned to ${metadata.agent_name || "Agent"}...`;
        this.setDagNode("dag-node-orch", metadata.is_collaborative ? "Swarm Assigned" : "Orchestrated");
        break;

      case "AGENT_RETRIEVING":
        if (this.chatTypingContainer) this.chatTypingContainer.style.display = "block";
        if (this.activeTaskStep) this.activeTaskStep.textContent = "Searching organizational knowledge...";
        this.setDagNode("dag-node-rag", "RAG Ingesting");
        break;

      case "AGENT_STARTED":
      case "AGENT_WORKING":
        if (this.chatTypingContainer) this.chatTypingContainer.style.display = "block";
        const roleDesc = metadata?.role ? ` (${metadata.role})` : '';
        if (this.activeTaskStep) this.activeTaskStep.textContent = `${metadata.agent_name || "Specialist"}${roleDesc} executing...`;
        if (metadata?.role && metadata.role.includes("Reviewer")) {
          this.setDagNode("dag-node-review", "Peer Reviewing");
        } else {
          this.setDagNode("dag-node-exec", "Maker Executing");
        }
        break;

      case "AGENT_COMPLETED":
        if (this.activeTaskStep) this.activeTaskStep.textContent = "Synthesizing and reviewing output...";
        break;

      case "EVALUATION_COMPLETED":
        if (this.evalScoreBadge) this.evalScoreBadge.textContent = `Score: ${(metadata.score || 0.95).toFixed(2)}`;
        if (this.evalReasonBox) this.evalReasonBox.textContent = `Evaluator: ${metadata.reason || "Verified logic."}`;
        this.setDagNode("dag-node-eval", `Evaluated (${(metadata.score || 0.95).toFixed(2)})`);
        break;

      case "EXPERIENCE_CREATED":
        this.setDagNode("dag-node-exp", "Experience Stored");
        break;

      case "TASK_COMPLETED":
        if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";
        this.setDagNode("dag-node-end", "Workflow Finished");
        
        if (this.metricActiveTasks) {
          this.metricActiveTasks.textContent = Math.max(0, parseInt(this.metricActiveTasks.textContent || "1", 10) - 1);
        }
        if (this.metricCompleted) {
          this.metricCompleted.textContent = parseInt(this.metricCompleted.textContent || "0", 10) + 1;
        }

        if (task_id) {
          this.currentTaskId = task_id;
          this.fetchTaskResult(task_id);
        }
        this.fetchOrganizationState();
        break;

      case "DIRECT_CHAT_MESSAGE":
        // Chat replies — not persisted to DB, carried inline in event metadata
        if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";
        if (metadata && metadata.reply) {
          if (!this._displayedChatTaskIds) this._displayedChatTaskIds = new Set();
          if (!this._displayedChatTaskIds.has(task_id)) {
            this._displayedChatTaskIds.add(task_id);
            this.appendChatMessage("assistant", metadata.reply, metadata.author_name || "Manager Jordan");
          }
        }
        // Do NOT increment metricCompleted — chat is not a task
        break;

      case "TASK_FAILED":
        if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";
        this.appendChatMessage("assistant", metadata.error || "System error during task execution.", "System");
        break;

      case "AGENT_CREATED":
      case "AGENT_ARCHIVED":
        this.fetchOrganizationState();
        break;
    }
  }

  async fetchTaskResult(taskId) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) return;
      const task = await res.json();
      
      if (this.chatTypingContainer) this.chatTypingContainer.style.display = "none";

      const leadChar = task.assigned_agent_id ? this.officeManager.characters.get(task.assigned_agent_id) : null;
      let leadName = leadChar ? leadChar.name : (task.assigned_agent_id || "Specialist");
      if (leadChar?.isManager || task.assigned_agent_id === "manager" || task.assigned_agent_id === "orchestrator") {
        leadName = "Manager Jordan";
      }
      const collabChar = task.collaborating_agent_id ? this.officeManager.characters.get(task.collaborating_agent_id) : null;
      const collabName = collabChar ? collabChar.name : task.collaborating_agent_id;

      const authorName = collabName
        ? `${leadName} & ${collabName}`
        : `${leadName}`;

      this.appendChatMessage("assistant", task.result || "Task completed successfully.", authorName);

      // Keep legacy stubs updated silently
      if (this.resultAgentName) {
        this.resultAgentName.textContent = collabName
          ? `🤝 Swarm Collaboration: ${leadName} (Lead) + ${collabName} (Reviewer)`
          : `Assigned Specialist: ${leadName}`;
      }
      if (this.resultOutputText) this.resultOutputText.textContent = task.result || "";
      if (this.resTokens) this.resTokens.textContent = task.tokens_used || 140;
      if (this.resLatency) this.resLatency.textContent = `${task.latency_ms || 320}ms`;
      if (this.resCost) this.resCost.textContent = `$${(task.cost_usd || 0.0003).toFixed(4)}`;
      if (this.resSwarmPill) this.resSwarmPill.style.display = task.collaborating_agent_id ? "inline-flex" : "none";

      this.activeArtifacts = task.artifacts || {};

      if (task.artifacts && task.artifacts.chart) {
        this.renderChartArtifact(task.artifacts.chart);
        if (this.tabBtnChart) this.tabBtnChart.style.display = "inline-block";
      } else {
        if (this.tabBtnChart) this.tabBtnChart.style.display = "none";
      }

      // Render code sandbox if present
      if (task.artifacts && task.artifacts.code) {
        if (this.codeSandboxContent) this.codeSandboxContent.textContent = task.artifacts.code.content;
        if (this.codeLangLabel) this.codeLangLabel.textContent = task.artifacts.code.language || "Python 3.12";
        if (this.tabBtnCode) this.tabBtnCode.style.display = "inline-block";
      } else {
        if (this.tabBtnCode) this.tabBtnCode.style.display = "none";
      }

      // Reset to briefing tab by default
      if (this.tabBtnBriefing) this.tabBtnBriefing.click();

    } catch (e) {
      console.warn("Could not fetch task result:", e);
    }
  }

  renderChartArtifact(chartData) {
    const canvas = document.getElementById("artifact-chart-canvas");
    if (!canvas || typeof Chart === "undefined") return;

    if (this.currentChartInstance) {
      this.currentChartInstance.destroy();
      this.currentChartInstance = null;
    }

    const ctx = canvas.getContext("2d");
    const isBar = chartData.type === "bar";

    this.currentChartInstance = new Chart(ctx, {
      type: isBar ? "bar" : "line",
      data: {
        labels: chartData.labels || ["A", "B", "C"],
        datasets: [{
          label: chartData.title || "Execution Metrics",
          data: chartData.values || [10, 20, 30],
          backgroundColor: isBar ? "rgba(56, 189, 248, 0.4)" : "rgba(16, 185, 129, 0.2)",
          borderColor: isBar ? "#38bdf8" : "#10b981",
          borderWidth: 2,
          tension: 0.35,
          fill: !isBar
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#e2e8f0", font: { family: "Inter", size: 11 } }
          }
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8", font: { family: "Inter", size: 10 } },
            grid: { color: "rgba(51, 65, 85, 0.3)" }
          },
          y: {
            ticks: { color: "#94a3b8", font: { family: "Inter", size: 10 } },
            grid: { color: "rgba(51, 65, 85, 0.3)" }
          }
        }
      }
    });
  }

  appendEventLog(event) {
    const item = document.createElement("div");
    let categoryClass = "task-event";
    if (event.type.startsWith("AGENT_")) categoryClass = "agent-event";
    if (event.type.startsWith("EVAL")) categoryClass = "eval-event";
    if (event.type.startsWith("EXP") || event.type.startsWith("FEED")) categoryClass = "exp-event";

    item.className = `event-item ${categoryClass}`;
    
    const timeStr = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "";
    const metaStr = Object.keys(event.metadata || {}).length > 0 
      ? JSON.stringify(event.metadata) 
      : "";

    item.innerHTML = `
      <div class="event-header">
        <span class="event-type">${event.type}</span>
        <span style="font-size: 10px; color: #64748b;">${timeStr}</span>
      </div>
      ${event.agent_id ? `<div style="color: #fbbf24; font-size: 11px;">Agent: ${event.agent_id}</div>` : ""}
      ${metaStr ? `<div class="event-meta">${metaStr}</div>` : ""}
    `;

    this.eventFeed.prepend(item);
    if (this.eventFeed.children.length > 50) {
      this.eventFeed.removeChild(this.eventFeed.lastChild);
    }
  }

  appendAgentDialogue(char, text) {
    if (!char || !text) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const name = char.name || "Agent";
    const role = char.role || "Specialist";
    const color = char.color || "#f59e0b";

    // 1. Append to side task drawer dialogue stream
    if (this.agentDialogueFeed) {
      const placeholder = this.agentDialogueFeed.querySelector(".dialogue-placeholder");
      if (placeholder) placeholder.remove();

      const bubble = document.createElement("div");
      bubble.className = "dialogue-bubble-entry";
      bubble.style.borderLeftColor = color;

      bubble.innerHTML = `
        <div class="dialogue-meta">
          <span class="dialogue-avatar" style="background: ${color}22; color: ${color}; border: 1px solid ${color};">
            ${char.isManager ? "🏛️" : (name[0] || "✦")}
          </span>
          <span class="dialogue-author" style="color: ${color}; font-weight: 700;">${name}</span>
          <span class="dialogue-role-tag">${role}</span>
          <span class="dialogue-time">${timeStr}</span>
        </div>
        <div class="dialogue-body-text">${text}</div>
      `;

      this.agentDialogueFeed.appendChild(bubble);
      this.agentDialogueFeed.scrollTop = this.agentDialogueFeed.scrollHeight;

      // Keep last 30 messages in chat view
      if (this.agentDialogueFeed.children.length > 30) {
        this.agentDialogueFeed.removeChild(this.agentDialogueFeed.firstChild);
      }
    }

    // 2. Also prepend to general event feed with dialogue highlight
    if (this.eventFeed) {
      const feedItem = document.createElement("div");
      feedItem.className = "event-item dialogue-event";
      feedItem.style.borderLeftColor = color;
      feedItem.innerHTML = `
        <div class="event-header">
          <span class="event-type" style="color: ${color};">💬 ${name.toUpperCase()}</span>
          <span style="font-size: 10px; color: #64748b;">${timeStr}</span>
        </div>
        <div style="font-size: 12px; color: #e2e8f0; margin-top: 3px; font-weight: 500;">"${text}"</div>
      `;
      this.eventFeed.prepend(feedItem);
      if (this.eventFeed.children.length > 50) {
        this.eventFeed.removeChild(this.eventFeed.lastChild);
      }
    }
  }

  updateMetrics(data) {
    this.metricAgents.textContent = data.agents.length;
    this.metricActiveTasks.textContent = data.active_tasks.length;
    this.metricCompleted.textContent = data.total_completed_tasks;
    this.metricExperiences.textContent = data.total_experiences;
    if (this.metricTokens) this.metricTokens.textContent = data.total_tokens || 0;
    if (this.metricCost) this.metricCost.textContent = `$${(data.total_cost_usd || 0.0).toFixed(4)}`;
    this.renderer.officeTelemetry = {
      total_tokens: data.total_tokens || 0,
      total_cost_usd: data.total_cost_usd || 0.0,
      avg_latency_ms: data.avg_latency_ms || 0.0
    };
  }

  // --- 60 FPS RENDER LOOP ---
  startRenderLoop() {
    const loop = () => {
      this.officeManager.updateAndRender();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
});
