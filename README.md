# 🏛️ The Apollo University — Intelligent Faculty Duty Allocation & Timetable System

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0%2B-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Neon Postgres](https://img.shields.io/badge/Neon_PostgreSQL-Serverless-00E599?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

<br/>

**A production-grade, constraint-aware, multi-tiered institutional scheduling, faculty duty substitution, and role governance platform engineered for higher education institutions.**

[Live Features](#-core-capabilities) • [System Architecture](#-system-architecture) • [Database Design](#-neon-postgresql-cloud-database) • [Getting Started](#-getting-started) • [Default Accounts](#-institutional-seed-credentials)

</div>

---

## 🌟 Overview

**The Apollo University Faculty Duty Allocation System** automates and optimizes university-wide academic scheduling. It eliminates manual timetable conflicts, chaotic leave coverage, and faculty burnout by enforcing strict institutional policies through a **deterministic 7-step constraint satisfaction engine** paired with **live operational intelligence**.

All operational data is persisted in **Neon Cloud PostgreSQL**, offering serverless database branching, real-time autoscaling, and relational integrity.

---

## 🚀 Core Capabilities

### ⚖️ 1. Deterministic 7-Rule Fairness Engine
The automated allocation engine solves substitution requirements using a strict 7-level constraint hierarchy:
1. **Rule 1 (Slot Conflict):** Verified that the candidate has zero regular classes or prior duties during the target lecture slot.
2. **Rule 2 (Daily Workload Cap):** Faculty with $\ge 2$ regular lectures on that day are protected from additional duties.
3. **Rule 3 (Weekly Substitution Cap):** Enforces a strict maximum of **4 substitution duties per week** per faculty member.
4. **Rule 4 (Role-Based Exemption):** Deans, HODs, Program Coordinators, and Committee Chairs are automatically exempted from routine class substitutions.
5. **Rule 5 (Department & Subject Affinity):** Prioritizes available professors from the same department (+50 pts) and subject domain (+30 pts).
6. **Rule 6 (Daily Duty Spacing):** Prioritizes faculty who currently have zero scheduled duties on the target day (+20 pts).
7. **Rule 7 (Fairness Equalizer):** Prioritizes candidates with the fewest cumulative weekly substitutions ($0 \text{ duties} > 1 \text{ duty} > 2 \text{ duties}$).

---

### 👥 2. User Registry & Role Governance
* **Multi-Role Assignment:** Assign and change user roles across **ADMIN**, **DEAN**, **HOD**, **PC** (Program Coordinator), **COMMITTEE_MEMBER**, and **FACULTY**.
* **Department Affiliation:** Inline re-assignment across academic departments (AIDS, AIML, CSE, CS, CC, AIHC).
* **Automatic Rule Synchronization:** Toggling role assignments instantly updates Rule 4 exemption and Rule 7 substitution eligibility flags across the live database.
* **Faculty Directory:** Detailed profile inspection including designation, official email, phone, weekly duty counters, and timetable schedules.

---

### 🗓️ 3. Absence Management & Instant Class Substitution
* **Single & Multi-Day Leave Filing:** Record Casual Leave (CL), Medical Leave (ML), On Duty (OD), or Emergency Leaves.
* **Automatic Class Identification:** The engine maps all timetable periods affected across the absent faculty's schedule.
* **1-Click Auto-Allocation:** Evaluates all eligible substitute professors and dispatches assignments with zero clashes in $<100\text{ms}$.
* **Manual Override Support:** Administrators and HODs can manually select candidates from a ranked eligibility leaderboard with full violation audit logs.

---

### 📝 4. Exam Invigilation Management
* **Exam Duty Scheduling:** Assign faculty to invigilation roles (*Room Invigilator*, *Hall Supervisor*, *Flying Squad*).
* **Venue & Timing Management:** Configure examination titles, course codes, halls (e.g. *Exam Hall B-204*), dates, reporting times, and exam durations.
* **Invigilator Alerts:** Dispatches notification cards directly to the assigned faculty member's portal.

---

### 📅 5. Academic Calendar & Holiday Controls
* **Holiday Governance:** Register national, state, and institutional holidays.
* **Timetable Freeze:** Automatically suspends routine class substitutions and exam scheduling during approved holidays.

---

### 🤖 6. AI Scheduling Advisor & Operational Assistant
* **Contextual User Guide:** Guides faculty, HODs, Deans, and Admins through portal operations with plain-language step-by-step instructions.
* **Live Database Grounding:** Queries real-time Neon PostgreSQL tables to report current absences, unallocated classes, active faculty counts, and weekly workload quotas.
* **Strict Zero-Code Policy:** Designed exclusively for human operational assistance without generating programming code or scripts.

---

### 📊 7. Interactive Timetable Grid & Workload Analytics
* **Weekly Matrix View:** Real-time timetable grid filterable by department, class section (e.g. *CSE-A Year 3*), and individual faculty.
* **Visual Clash Detection:** Color-coded period cards (blue = regular lecture, green = substituted duty, clear = free period).
* **Workload Distribution Charts:** Visual representation of weekly substitutions per faculty to guarantee equity.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A[React 19 + TypeScript Frontend] -->|REST API / JWT Auth| B[FastAPI Gateway :8081]
    B --> C[7-Rule Deterministic Allocation Engine]
    B --> D[AI Scheduling & Operational Advisor]
    B --> E[User & Role Governance Service]
    B --> F[Absence & Exam Duty Service]
    C --> G[SQLAlchemy 2.0 ORM]
    D --> G
    E --> G
    F --> G
    G --> H[(Neon Cloud PostgreSQL)]
```

---

## 🗄️ Neon PostgreSQL Cloud Database

The system is configured to persist all institutional records on **Neon Serverless PostgreSQL**:

```
postgresql://neondb_owner:npg_***@ep-orange-violet-az5k58bf-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

### Relational Schema (16 Tables)
1. **`roles`**: System permission tiers (ADMIN, DEAN, HOD, PC, COMMITTEE_MEMBER, FACULTY).
2. **`users`**: Institutional user accounts with bcrypt-hashed credentials and role links.
3. **`departments`**: Academic divisions (AIDS, AIML, CSE, CS, CC, AIHC).
4. **`subjects`**: Course catalog with credits and department associations.
5. **`class_sections`**: Student cohorts and batches across academic years.
6. **`faculty`**: Faculty profiles, designations, subject expertise, weekly duty counters, and exemption flags.
7. **`timetable_versions`**: Active semester timetable versions with freeze status.
8. **`timetable_entries`**: Scheduled weekly lecture slots (day, start time, end time, room, faculty).
9. **`absences`**: Leave records with dates, reasons, and status tracking.
10. **`substitution_requirements`**: Uncovered class requirements generated from absences.
11. **`substitution_duties`**: Assigned substitute duties with candidate ranking score and allocation method.
12. **`academic_holidays`**: Institutional holidays and calendar pauses.
13. **`exam_duties`**: Invigilation duty assignments with hall, role, and reporting times.
14. **`system_rules`**: Configurable institutional constraints (weekly cap, daily regular class cap).
15. **`audit_logs`**: Immutable audit logs of all duty assignments, overrides, and role changes.
16. **`notifications`**: In-app notifications dispatched to faculty and administrators.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4 | Responsive UI with real-time state management |
| **Icons & UI** | Lucide React | Clean, modern iconography |
| **Backend API** | FastAPI (Python 3.10+ / 3.13), Pydantic v2 | High-performance asynchronous REST API |
| **Database** | Neon Cloud PostgreSQL, SQLAlchemy 2.0 | Serverless PostgreSQL with connection pooling |
| **Security** | OAuth2 Password Bearer, JWT, Passlib (Bcrypt) | Token-based authentication and role authorization |
| **Testing** | Pytest, AnyIO | Complete automated test coverage |

---

## 💻 Getting Started

### Prerequisites
* **Python 3.10+** (Tested on Python 3.13)
* **Node.js 18+** & **npm**
* **Git**

---

### 1. Clone the Repository
```bash
git clone https://github.com/fareedahamed0425-code/faculty-duty-allocation-system.git
cd faculty-duty-allocation-system
```

---

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains your Neon PostgreSQL connection string:
```env
DATABASE_URL=postgresql://neondb_owner:npg_3DRLr7fgoInb@ep-orange-violet-az5k58bf-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
SECRET_KEY=institution_scheduling_secret_jwt_key_2026_production_grade
PORT=8081
VITE_API_URL=http://localhost:8081/api/v1
```

---

### 3. Run Locally

#### Option A: 1-Command Unified Launcher
```bash
python run_app.py
```

#### Option B: Standalone Servers

**Start Backend (Terminal 1):**
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --port 8081 --reload
```

**Start Frontend (Terminal 2):**
```bash
cd frontend
npm install
npm run dev
```

* **Frontend Application:** `http://localhost:5173`
* **FastAPI Interactive Swagger Docs:** `http://localhost:8081/docs`
* **API Health Check:** `http://localhost:8081/api/v1/health`

---

## 🔑 Institutional Seed Credentials

All seeded test accounts use the default password: **`Apollo@2026`**

| Role | Email | Designation | Department |
| :--- | :--- | :--- | :--- |
| **⚙️ Admin** | `admin@apollouniversity.edu.in` | System Administrator | CSE |
| **👑 Dean** | `dean.academics@apollouniversity.edu.in` | Dean of Academic Affairs | CSE |
| **👔 HOD (CSE)** | `hod.cse@apollouniversity.edu.in` | Professor & Head of Dept | CSE |
| **👔 HOD (ECE)** | `hod.ece@apollouniversity.edu.in` | Professor & Head of Dept | ECE |
| **👔 HOD (MECH)** | `hod.mech@apollouniversity.edu.in` | Professor & Head of Dept | MECH |
| **👔 HOD (MATH)** | `hod.math@apollouniversity.edu.in` | Professor & Head of Dept | MATH |
| **📋 Coordinator (PC)** | `pc.cse@apollouniversity.edu.in` | Program Coordinator (B.Tech) | CSE |
| **🛡️ Committee** | `kv.prasad@apollouniversity.edu.in` | Exam Committee Convener | ECE |
| **👨‍🏫 Faculty** | `arun.kumar@apollouniversity.edu.in` | Assistant Professor | CSE |
| **👨‍🏫 Faculty** | `priya.nair@apollouniversity.edu.in` | Associate Professor | CSE |
| **👨‍🏫 Faculty** | `m.ahmed@apollouniversity.edu.in` | Assistant Professor | CSE |
| **👨‍🏫 Faculty** | `manoj.verma@apollouniversity.edu.in` | Assistant Professor | ECE |
| **👨‍🏫 Faculty** | `k.suresh@apollouniversity.edu.in` | Assistant Professor | MECH |
| **👨‍🏫 Faculty** | `deepa.n@apollouniversity.edu.in` | Assistant Professor | MATH |

---

## 🧪 Testing & Verification

Run the comprehensive test suite (13 test suites covering constraints, ranking, absences, and role governance):
```bash
cd backend
python -m pytest
```

Verify frontend TypeScript compilation and production bundle:
```bash
cd frontend
npm run build
```

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

<div align="center">
  <sub>The Apollo University — Advancing Excellence in Academic Governance.</sub>
</div>
