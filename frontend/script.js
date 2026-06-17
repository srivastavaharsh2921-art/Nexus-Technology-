const headingLetters = document.querySelectorAll(".animated-heading .letter");
headingLetters.forEach((letter, index) => {
  letter.style.setProperty("--i", index);
});

const revealTargets = document.querySelectorAll(
  ".service-card, .process-step, .review-card, .review-score, .review-stats div, .review-marquee, .contact-form, .section-heading, .intro-band p"
);

revealTargets.forEach((target) => {
  target.classList.add("reveal");
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("visible"));
}

const reviewCards = document.querySelectorAll(".review-card");
const canAnimateReviews = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

reviewCards.forEach((card, index) => {
  card.style.setProperty("--review-index", index);

  if (!canAnimateReviews) return;

  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    card.style.setProperty("--rx", `${y * -7}deg`);
    card.style.setProperty("--ry", `${x * 7}deg`);
  });

  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
});

const form = document.querySelector(".contact-form");
const formNote = document.querySelector(".form-note");
const submitButton = form?.querySelector('button[type="submit"]');

function getApiUrls() {
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if ((!isLocalhost && window.location.protocol !== "file:") || window.location.port === "5000") {
    return [""];
  }

  return ["http://localhost:5000", "http://127.0.0.1:5000"];
}

async function sendInquiry(payload) {
  let lastError;

  for (const apiBaseUrl of getApiUrls()) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not send inquiry.");
      }

      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Could not connect to the backend. Open http://localhost:5000.");
}

if (form && formNote && submitButton) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formNote.classList.remove("error");
    formNote.textContent = "Sending your inquiry...";
    submitButton.disabled = true;

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const result = await sendInquiry(payload);

      formNote.textContent = result.message || "Thanks. Your inquiry has been sent.";
      form.reset();
    } catch (error) {
      formNote.classList.add("error");
      formNote.textContent =
        error instanceof TypeError
          ? "Could not connect to the backend. Open http://localhost:5000 and try again."
          : error.message || "Something went wrong. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

const canvas = document.getElementById("signalCanvas");
const ctx = canvas?.getContext("2d");
let width = 0;
let height = 0;
let particles = [];
let pointer = { x: 0, y: 0, active: false };
const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const particleCount = Math.min(90, Math.max(42, Math.floor(width / 18)));
  particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.42,
    vy: (Math.random() - 0.5) * 0.42,
    size: Math.random() * 1.7 + 0.7,
  }));
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function animateNetwork() {
  ctx.clearRect(0, 0, width, height);
  drawGrid();

  particles.forEach((particle) => {
    if (!motionReduced) {
      particle.x += particle.vx;
      particle.y += particle.vy;
    }

    if (particle.x < 0 || particle.x > width) particle.vx *= -1;
    if (particle.y < 0 || particle.y > height) particle.vy *= -1;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(41, 207, 227, 0.72)";
    ctx.fill();
  });

  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const first = particles[i];
      const second = particles[j];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);

      if (distance < 130) {
        const alpha = 1 - distance / 130;
        ctx.strokeStyle = `rgba(41, 207, 227, ${alpha * 0.16})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        ctx.lineTo(second.x, second.y);
        ctx.stroke();
      }
    }
  }

  if (pointer.active) {
    ctx.strokeStyle = "rgba(241, 172, 63, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pointer.x - 34, pointer.y);
    ctx.lineTo(pointer.x + 34, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 34);
    ctx.lineTo(pointer.x, pointer.y + 34);
    ctx.stroke();
  }

  requestAnimationFrame(animateNetwork);
}

if (canvas && ctx) {
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY, active: true };
  });
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  resizeCanvas();
  animateNetwork();
}
