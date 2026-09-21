/* ============================================================================
   PORTFOLIO CONTENT  —  ✏️  EDIT THIS FILE to make the world yours.
   Everything the visitor reads lives here. Nothing else needs changing.
   ========================================================================== */
window.CONFIG = {
  profile: {
    name: "Ritam Koley",
    role: "CS Undergrad · Competitive Programmer · AI/ML Enthusiast · Web Developer · Security",
    tagline: "Pick a hero and explore my world, block by block.",
  },

  /* Each section becomes a build you can walk up to and open with E.
     `color` is the accent (also the floating gem color). */
  sections: {
    about: {
      title: "About Me",
      color: "#f0a441",
      body: [
        "Hey! I'm Ritam Koley — a Computer Science undergrad at NIT Durgapur with a deep love for competitive programming, algorithms, and cybersecurity. I've solved 1000+ DSA problems and I chase clean, fast, correct code.",
        "My core focus is advancing in Artificial Intelligence and Machine Learning. Alongside engineering, I'm into graphic design and video editing, and off-screen you'll find me playing football, reading, or in the gym.",
      ],
      facts: [
        ["Location", "Durgapur, India"],
        ["Education", "B.Tech CS, NIT Durgapur"],
        ["CGPA", "9.1 / 10"],
        ["Role", "Open to internships & roles"],
      ],
      stats: [
        ["1000+", "DSA problems solved"],
        ["2141", "LeetCode peak rating"],
        ["4★", "CodeChef coder"],
      ],
    },

    experience: {
      title: "Experience",
      color: "#4aa3ff",
      jobs: [
        {
          role: "Engineer Analyst, Investment Banking",
          company: "Goldman Sachs",
          period: "May 2026 — Jul 2026",
          points: [
            "Engineered automated migration pipelines to move operational dashboards and system metrics from Datadog to AWS CloudWatch.",
            "Designed observability infrastructure for the Global Banking & Markets and Global Investment Research divisions.",
            "Collaborated with the AWS team to execute the automation strategy and ensure high-availability monitoring.",
          ],
        },
        {
          role: "Research Intern",
          company: "IIT Delhi",
          period: "Oct 2025 — Jan 2026",
          points: [
            "Built an automated security-testing tool in Python to flag malicious VPNs and browser extensions leaking user data.",
            "Wrote network-sniffing and traffic-analysis scripts to detect IP leaks, DNS leaks, and unauthorized routing.",
            "Evaluated extensions for systemic vulnerabilities exposing sensitive search and browsing history.",
          ],
        },
        {
          role: "Research Intern",
          company: "IIT Kanpur",
          period: "May 2025 — Jul 2025",
          points: [
            "Researched and implemented Secure & Fluid Multiparty Computation protocols.",
            "Created a custom cryptographic library in Rust to execute Secure Multiparty Computation.",
            "Gained hands-on experience with Secret Sharing and Post-Quantum Cryptography.",
          ],
        },
        {
          role: "Mentor",
          company: "Physics Wallah",
          period: "Aug 2024 — Oct 2024",
          points: [
            "Mentored JEE aspirants with strategic preparation insights and conceptual clarity.",
            "Ran regular doubt-solving sessions to sharpen students' problem-solving speed.",
          ],
        },
      ],
    },

    projects: {
      title: "Projects",
      color: "#b06bff",
      items: [
        {
          name: "FlipGears — Flipkart Grid 6.0",
          desc: "Vision-based system that detects produce freshness, reads expiry via OCR, and recognizes brands from packaging.",
          tech: ["FastAPI", "ReactJS", "TailwindCSS", "ML"],
          link: "https://github.com/Ritam-23",
        },
        {
          name: "AQI-Level Predictor",
          desc: "Regression model forecasting a city's Air Quality Index 50 years out, with alerts when values cross hazardous thresholds.",
          tech: ["Python", "Pandas", "Scikit-learn", "Matplotlib"],
          link: "https://github.com/Ritam-23",
        },
        {
          name: "KeyLogger",
          desc: "Real-time keystroke capture built for ethical hacking and penetration-testing coursework, exploring low-level input monitoring.",
          tech: ["Python", "Pynput"],
          link: "https://github.com/Ritam-23",
        },
      ],
    },

    technologies: {
      title: "Technologies",
      color: "#ff5d5d",
      groups: [
        { label: "Languages", items: ["C", "C++", "Python", "Rust", "JavaScript", "TypeScript", "Shell"] },
        { label: "Web & Frontend", items: ["ReactJS", "NodeJS", "ExpressJS", "TailwindCSS", "ThreeJS", "HTML", "CSS"] },
        { label: "Data", items: ["PostgreSQL", "MySQL", "MongoDB", "Redis"] },
        { label: "Cloud & DevOps", items: ["AWS", "GCP", "Datadog", "Docker", "Kubernetes", "Jenkins", "Terraform"] },
        { label: "Security", items: ["Burp Suite", "Wireshark", "Metasploit", "NMAP", "John the Ripper"] },
        { label: "Design", items: ["Figma", "Spline"] },
      ],
    },

    interests: {
      title: "Interests",
      color: "#2ec77e",
      items: [
        ["🧠", "Competitive programming", "1000+ problems across LeetCode, CodeChef & GeeksforGeeks."],
        ["🔐", "Cybersecurity", "Security testing, cryptography, and ethical hacking."],
        ["🎨", "Design & video", "Graphic design and video editing on the side."],
        ["⚽", "Football & gym", "Staying disciplined off the keyboard."],
      ],
    },

    contact: {
      title: "Contact",
      color: "#ff7a2f",
      message: "Thanks for exploring! Let's build something together.",
      greeter: "💬 Wanna contact me?",
      email: "ritamkoleynitdgp@gmail.com",     // ← used as the mailto fallback
      phone: "7364872040",
      availability: "Open to internships & new opportunities",
      topics: ["Job opportunity", "Internship", "Collaboration", "Just saying hi"],
      socials: [
        ["GitHub", "https://github.com/Ritam-23"],
        ["LinkedIn", "https://www.linkedin.com/in/ritam-koley-2005rk3004/"],
        ["LeetCode", "https://leetcode.com/u/RitamKoley/"],
        ["CodeChef", "https://www.codechef.com/users/vengeance_2005"],
        ["GeeksforGeeks", "https://www.geeksforgeeks.org/profile/koleyriti9g1"],
      ],
    },

    // Shown at the RESUME lectern 📄  — the PDF lives at assets/resume.pdf
    resume: {
      title: "Resume",
      color: "#17b3a3",
      file: "assets/resume.pdf",           // ← replace this file to update your CV
      message: "Grab a copy of my full CV.",
      highlights: [
        "B.Tech CS @ NIT Durgapur — CGPA 9.1/10",
        "Goldman Sachs · IIT Delhi · IIT Kanpur experience",
        "LeetCode Guardian (2141) · CodeChef 4★ · 1000+ DSA",
      ],
    },
  },

  /* EmailJS — powers the Contact form. These are PUBLIC client keys (safe to ship).
     Create a free account at https://emailjs.com, then paste your IDs here.
     Leave any as "REPLACE_ME" to fall back to a plain mailto: link. */
  contact: {
    EMAILJS_SERVICE_ID:  "service_xwrhipq",
    EMAILJS_TEMPLATE_ID: "template_26klvxh",
    EMAILJS_PUBLIC_KEY:  "jkfvHCW56-rp2Rx8Y",
  },
};
