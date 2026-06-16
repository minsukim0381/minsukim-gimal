/**
 * PHYSICAL AI - Interactive Web Application Core Script
 */

// ==========================================
// [Firebase Configuration]
// ==========================================
// TODO: Firebase Console에서 프로젝트 생성 후 아래 객체에 실제 발급받은 구성 정보를 복사하세요.
// 구성 정보를 채워넣으면 자동으로 실시간 Firebase DB로 연결되고, 비워두면 LocalStorage 기반 데모 모드로 작동합니다.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

// Check if config has been modified from the default placeholders
const isFirebaseConfigured = () => {
  return firebaseConfig && 
         firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
         firebaseConfig.apiKey.trim() !== "" &&
         !firebaseConfig.apiKey.includes("YOUR_API_KEY");
};

// ==========================================
// [Realtime Database & Fallback Layer]
// ==========================================
class DatabaseService {
  constructor() {
    this.db = null;
    this.firestore = null;
    this.isFirebase = false;
  }

  async initialize() {
    const statusBadge = document.getElementById("db-status");

    if (isFirebaseConfigured()) {
      try {
        // Dynamically import Firebase libraries for modularity and performance
        const firebaseApp = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const firebaseFirestore = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        const app = firebaseApp.initializeApp(firebaseConfig);
        this.db = firebaseFirestore.getFirestore(app);
        this.firestore = firebaseFirestore;
        this.isFirebase = true;
        
        console.log("🚀 Firebase Connected successfully!");
        statusBadge.textContent = "Firebase Connected";
        statusBadge.className = "db-status-badge connected";
      } catch (error) {
        console.error("❌ Firebase initialization failed. Falling back to LocalStorage:", error);
        this.setupFallback(statusBadge);
      }
    } else {
      console.log("ℹ️ Firebase Config not provided. Running in LocalStorage Demo Mode.");
      this.setupFallback(statusBadge);
    }
  }

  setupFallback(statusBadge) {
    this.isFirebase = false;
    statusBadge.textContent = "Demo Mode (Local)";
    statusBadge.className = "db-status-badge demo";

    // Setup mock data for votes
    if (!localStorage.getItem("physical_ai_votes")) {
      localStorage.setItem("physical_ai_votes", JSON.stringify({
        "제조": 28,
        "물류": 14,
        "의료": 35,
        "일상": 42
      }));
    }

    // Setup mock data for ideas
    if (!localStorage.getItem("physical_ai_ideas")) {
      const defaultIdeas = [
        {
          id: "demo-1",
          nickname: "AI혁신가",
          idea: "산불 등 대형 재난 현장에 투입하여 정밀 진화 및 구조 활동을 진행하는 자율 소방 비행 로봇 솔루션",
          createdAt: Date.now() - 3600000 * 3
        },
        {
          id: "demo-2",
          nickname: "건강우선",
          idea: "고령화 가정을 타겟으로 하여 약 복용 일정 관리 및 거동 보조를 도맡아주는 안전 친화적 휴머노이드 집사",
          createdAt: Date.now() - 3600000 * 1
        },
        {
          id: "demo-3",
          nickname: "물류마스터",
          idea: "도심 빌딩 내부 엘리베이터와 연동하여 사무실 문 앞까지 무인 배송을 완료해주는 초정밀 실내 배송 로봇",
          createdAt: Date.now() - 1800000
        }
      ];
      localStorage.setItem("physical_ai_ideas", JSON.stringify(defaultIdeas));
    }
  }

  // --- Real-time Votes ---
  onVotesUpdated(callback) {
    if (this.isFirebase) {
      const docRef = this.firestore.doc(this.db, "votes", "stats");
      return this.firestore.onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data());
        } else {
          // Initialize document in Firestore
          const initialVotes = { "제조": 0, "물류": 0, "의료": 0, "일상": 0 };
          this.firestore.setDoc(docRef, initialVotes);
          callback(initialVotes);
        }
      }, (error) => {
        console.error("Firestore votes subscription error:", error);
      });
    } else {
      const updateCallback = () => {
        const votes = JSON.parse(localStorage.getItem("physical_ai_votes"));
        callback(votes);
      };
      updateCallback();
      window.addEventListener("local-votes-changed", updateCallback);
      return () => window.removeEventListener("local-votes-changed", updateCallback);
    }
  }

  async vote(category) {
    if (this.isFirebase) {
      const docRef = this.firestore.doc(this.db, "votes", "stats");
      await this.firestore.updateDoc(docRef, {
        [category]: this.firestore.increment(1)
      });
    } else {
      const votes = JSON.parse(localStorage.getItem("physical_ai_votes"));
      votes[category] = (votes[category] || 0) + 1;
      localStorage.setItem("physical_ai_votes", JSON.stringify(votes));
      window.dispatchEvent(new Event("local-votes-changed"));
    }
  }

  // --- Real-time Ideas ---
  onIdeasUpdated(callback) {
    if (this.isFirebase) {
      const q = this.firestore.query(
        this.firestore.collection(this.db, "ideas"),
        this.firestore.orderBy("createdAt", "desc")
      );
      return this.firestore.onSnapshot(q, (snapshot) => {
        const ideas = [];
        snapshot.forEach((doc) => {
          ideas.push({ id: doc.id, ...doc.data() });
        });
        callback(ideas);
      }, (error) => {
        console.error("Firestore ideas subscription error:", error);
      });
    } else {
      const updateCallback = () => {
        const ideas = JSON.parse(localStorage.getItem("physical_ai_ideas"));
        // Sort descending
        ideas.sort((a, b) => b.createdAt - a.createdAt);
        callback(ideas);
      };
      updateCallback();
      window.addEventListener("local-ideas-changed", updateCallback);
      return () => window.removeEventListener("local-ideas-changed", updateCallback);
    }
  }

  async addIdea(nickname, ideaText) {
    const newIdea = {
      nickname: nickname,
      idea: ideaText,
      createdAt: Date.now()
    };

    if (this.isFirebase) {
      const collectionRef = this.firestore.collection(this.db, "ideas");
      await this.firestore.addDoc(collectionRef, newIdea);
    } else {
      const ideas = JSON.parse(localStorage.getItem("physical_ai_ideas"));
      newIdea.id = "local-" + Date.now();
      ideas.push(newIdea);
      localStorage.setItem("physical_ai_ideas", JSON.stringify(ideas));
      window.dispatchEvent(new Event("local-ideas-changed"));
    }
  }
}

// ==========================================
// [Interactive Neural Network Canvas Background]
// ==========================================
class NeuralNetworkBackground {
  constructor() {
    this.canvas = document.getElementById("hero-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.particles = [];
    this.particleCount = 50;
    this.connectionDistance = 120;
    this.mouse = { x: null, y: null, radius: 150 };

    this.init();
    this.animate();
    this.registerEvents();
  }

  init() {
    this.resizeCanvas();
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1.5
      });
    }
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  registerEvents() {
    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.init();
    });

    window.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener("mouseout", () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background nebula glow
    this.ctx.fillStyle = "radial-gradient(circle at 50% 50%, #0d1330 0%, #05070f 80%)";

    // Update and draw particles
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      // Wall bounce
      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

      // Mouse interactive push/pull
      if (this.mouse.x !== null && this.mouse.y !== null) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.mouse.radius) {
          const force = (this.mouse.radius - dist) / this.mouse.radius;
          p.x -= dx * force * 0.02;
          p.y -= dy * force * 0.02;
        }
      }

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgba(0, 240, 255, 0.45)";
      this.ctx.fill();
    });

    // Draw connecting lines
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.connectionDistance) {
          const alpha = (1 - dist / this.connectionDistance) * 0.12;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.stroke();
        }
      }
    }

    requestAnimationFrame(() => this.animate());
  }
}

// ==========================================
// [Main App Logic & UI Initialization]
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Initialize Dynamic Background
  new NeuralNetworkBackground();

  // Initialize DB Service
  const dbService = new DatabaseService();
  await dbService.initialize();

  // Mobile menu toggle
  const mobileToggle = document.querySelector(".mobile-toggle");
  const navMenu = document.querySelector(".nav-menu");
  mobileToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    const icon = mobileToggle.querySelector("i");
    if (navMenu.classList.contains("active")) {
      icon.setAttribute("data-lucide", "x");
    } else {
      icon.setAttribute("data-lucide", "menu");
    }
    lucide.createIcons();
  });

  // Close mobile menu when clicking links
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("active");
      const icon = mobileToggle.querySelector("i");
      icon.setAttribute("data-lucide", "menu");
      lucide.createIcons();
    });
  });

  // Scroll header styling
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.style.padding = "0.5rem 0";
      navbar.style.background = "rgba(5, 7, 15, 0.9)";
    } else {
      navbar.style.padding = "0";
      navbar.style.background = "rgba(5, 7, 15, 0.75)";
    }
  });

  // Smooth scroll logic
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        const headerOffset = 80;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    });
  });

  // --- Real-time Votes Subscription ---
  dbService.onVotesUpdated((votesData) => {
    if (!votesData) return;

    // Calculate total votes
    const totalVotes = Object.values(votesData).reduce((sum, val) => sum + val, 0);
    document.getElementById("total-votes-count").textContent = totalVotes;

    // Update progress bars for each category
    const categories = ["제조", "물류", "의료", "일상"];
    categories.forEach((cat) => {
      const count = votesData[cat] || 0;
      const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

      const progressItem = document.getElementById(`result-${cat}`);
      if (progressItem) {
        progressItem.querySelector(".percent-val").textContent = `${percent}% (${count}표)`;
        progressItem.querySelector(".progress-bar-fill").style.width = `${percent}%`;
      }
    });
  });

  // Vote button click events
  const voteButtons = document.querySelectorAll(".vote-btn");
  voteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const category = btn.getAttribute("data-category");
      
      // Button disable prevention / visual loading
      btn.disabled = true;
      btn.style.opacity = "0.5";
      
      try {
        await dbService.vote(category);
        
        // Show floating feedback or temporary color
        btn.style.borderColor = "var(--accent-green)";
        setTimeout(() => {
          btn.style.borderColor = "var(--accent-cyan)";
        }, 1000);
      } catch (err) {
        console.error("Failed to register vote:", err);
      } finally {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    });
  });

  // --- Real-time Ideas Subscription ---
  const ideasList = document.getElementById("ideas-list");
  dbService.onIdeasUpdated((ideasArray) => {
    if (!ideasArray || ideasArray.length === 0) {
      ideasList.innerHTML = '<div class="loading-spinner">첫 번째 아이디어를 제안해 보세요!</div>';
      return;
    }

    ideasList.innerHTML = "";
    ideasArray.forEach((idea) => {
      const card = document.createElement("div");
      card.className = "idea-card";

      // Formatted date string
      const dateStr = new Date(idea.createdAt).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      card.innerHTML = `
        <div class="idea-header">
          <span class="idea-author">@ ${escapeHtml(idea.nickname)}</span>
          <span class="idea-date">${dateStr}</span>
        </div>
        <div class="idea-body">${escapeHtml(idea.idea)}</div>
      `;

      ideasList.appendChild(card);
    });
  });

  // Idea Form submission
  const ideaForm = document.getElementById("idea-form");
  ideaForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nicknameEl = document.getElementById("nickname");
    const ideaTextEl = document.getElementById("idea-text");
    const submitBtn = ideaForm.querySelector(".form-submit-btn");

    const nickname = nicknameEl.value.trim();
    const ideaText = ideaTextEl.value.trim();

    if (!nickname || !ideaText) return;

    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "제출 중...";

    try {
      await dbService.addIdea(nickname, ideaText);
      
      // Reset form
      ideaTextEl.value = "";
      
      // Flash success visual state
      submitBtn.querySelector("span").textContent = "제출 완료!";
      submitBtn.style.background = "linear-gradient(135deg, var(--accent-green) 0%, #03d611 100%)";
      
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.querySelector("span").textContent = "아이디어 제출";
        submitBtn.style.background = "";
      }, 1500);

    } catch (err) {
      console.error("Failed to add idea:", err);
      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = "아이디어 제출";
      alert("아이디어 전송에 실패했습니다. 다시 시도해 주세요.");
    }
  });

  });

  // ==========================================
  // [Section 6: Robot's Eye View Hotspots]
  // ==========================================
  const hotspots = document.querySelectorAll(".hotspot");
  hotspots.forEach((hotspot) => {
    let typeTimer = null;
    const tooltipBody = hotspot.querySelector(".tooltip-body");
    
    // Assemble structured text
    const textLines = [
      `CLASS    : ${hotspot.getAttribute("data-class")}`,
      `MATERIAL : ${hotspot.getAttribute("data-material")}`,
      `MASS     : ${hotspot.getAttribute("data-mass")}`,
      `OPTIMAL  : ${hotspot.getAttribute("data-force")}`,
      `WARNING  : ${hotspot.getAttribute("data-warning")}`
    ];
    const fullText = textLines.join("\n");

    hotspot.addEventListener("mouseenter", () => {
      clearInterval(typeTimer);
      tooltipBody.innerHTML = "";
      let index = 0;
      
      typeTimer = setInterval(() => {
        if (index < fullText.length) {
          // Add character by character to simulate command-line/typewriter readout
          tooltipBody.innerHTML += fullText.charAt(index);
          index++;
        } else {
          clearInterval(typeTimer);
        }
      }, 10); // Ultra-fast terminal type effect
    });

    hotspot.addEventListener("mouseleave", () => {
      clearInterval(typeTimer);
      tooltipBody.innerHTML = "";
    });
  });

  // ==========================================
  // [Section 7: Digital Twin Simulator]
  // ==========================================
  const sliderGrip = document.getElementById("slider-grip");
  const sliderWeight = document.getElementById("slider-weight");
  const sliderFriction = document.getElementById("slider-friction");

  const valGrip = document.getElementById("val-grip");
  const valWeight = document.getElementById("val-weight");
  const valFriction = document.getElementById("val-friction");

  const runSimBtn = document.getElementById("run-sim-btn");
  const resetSimBtn = document.getElementById("reset-sim-btn");

  const simStatus = document.getElementById("sim-status");
  const simConsole = document.getElementById("sim-console-output");
  const visualizerScreen = document.querySelector(".visualizer-screen");

  // Trackbar event listeners to update value tags in real-time
  sliderGrip.addEventListener("input", (e) => {
    valGrip.textContent = `${e.target.value} N`;
  });

  sliderWeight.addEventListener("input", (e) => {
    valWeight.textContent = `${e.target.value} kg`;
  });

  sliderFriction.addEventListener("input", (e) => {
    valFriction.textContent = `${parseFloat(e.target.value).toFixed(2)} μ`;
  });

  // Simulation execution flow
  runSimBtn.addEventListener("click", () => {
    // 1. Read parameter states
    const grip = parseInt(sliderGrip.value);
    const weight = parseInt(sliderWeight.value);
    const friction = parseFloat(sliderFriction.value);

    // 2. Clean previous execution classes
    visualizerScreen.classList.remove("sim-running-success", "sim-running-slip", "sim-running-crush");
    
    // Force CSS reflow to make animation re-triggerable immediately
    void visualizerScreen.offsetWidth;

    // 3. Disable control sliders during live animation run
    toggleSimControls(true);
    
    simStatus.className = "status-indicator ready";
    simStatus.textContent = "CALCULATING...";
    simConsole.className = "console-line line-2";
    simConsole.textContent = "> Analyzing physics matrix in Digital Twin...";

    // 4. Calculate results based on mechanical balance
    // CRUSH condition: too much force for cargo limit (80N limit or 3x the weight)
    const isCrushed = grip > 80 || grip > weight * 3.2;
    // SLIP condition: not enough force to lift weight, or friction coefficient is too slick
    const isSlipped = grip < weight * 1.5 || friction < 0.25;

    // 5. Execute states with animations
    setTimeout(() => {
      if (isCrushed) {
        visualizerScreen.classList.add("sim-running-crush");
        simStatus.className = "status-indicator error";
        simStatus.textContent = "CRITICAL ERROR";
        simConsole.className = "console-line line-2 error";
        simConsole.innerHTML = `&gt; Error: 물체 파손됨 (Excessive Force)<br>&gt; 파지력(${grip}N)이 중량(${weight}kg) 대비 과압축 임계값(3.2x)을 초과하여 카고 쉘이 파괴되었습니다.`;
      } else if (isSlipped) {
        visualizerScreen.classList.add("sim-running-slip");
        simStatus.className = "status-indicator error";
        simStatus.textContent = "SYSTEM FAILURE";
        simConsole.className = "console-line line-2 error";
        if (friction < 0.25) {
          simConsole.innerHTML = `&gt; Error: 물체 미끄러짐 (Grip Failure)<br>&gt; 접촉 마찰계수(${friction}μ)가 임계 규격(0.25μ)보다 낮아 집게 구동 중 하중이 슬립 아웃되었습니다.`;
        } else {
          simConsole.innerHTML = `&gt; Error: 물체 미끄러짐 (Grip Failure)<br>&gt; 파지력(${grip}N)이 물량 리프팅을 위한 최소 토크(${weight * 1.5}N) 미달로 중력에 의해 낙하했습니다.`;
        }
      } else {
        visualizerScreen.classList.add("sim-running-success");
        simStatus.className = "status-indicator success";
        simStatus.textContent = "SUCCESS";
        simConsole.className = "console-line line-2 success";
        simConsole.innerHTML = `&gt; Success: 작업 완료 (Optimal Calculation)<br>&gt; 최적의 기계적 합치율 달성! 파지력(${grip}N) 및 마찰력(${friction}μ) 설계로 화물 안전 수송 완료.`;
      }
    }, 1200); // 1.2s delay for "calculating" suspense feel
  });

  // Reset simulator back to default configs
  resetSimBtn.addEventListener("click", () => {
    visualizerScreen.classList.remove("sim-running-success", "sim-running-slip", "sim-running-crush");
    
    // Default values
    sliderGrip.value = 50;
    sliderWeight.value = 20;
    sliderFriction.value = 0.50;

    valGrip.textContent = "50 N";
    valWeight.textContent = "20 kg";
    valFriction.textContent = "0.50 μ";

    toggleSimControls(false);

    simStatus.className = "status-indicator";
    simStatus.textContent = "STANDBY";
    simConsole.className = "console-line line-2";
    simConsole.textContent = "> Simulator state restored. Awaiting configurations.";
  });

  function toggleSimControls(disable) {
    sliderGrip.disabled = disable;
    sliderWeight.disabled = disable;
    sliderFriction.disabled = disable;
    runSimBtn.disabled = disable;
    
    if (disable) {
      runSimBtn.style.opacity = "0.4";
    } else {
      runSimBtn.style.opacity = "";
    }
  }

  // Simple HTML Escaping to prevent XSS in idea board
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
