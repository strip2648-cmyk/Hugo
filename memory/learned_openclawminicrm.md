# openclawminicrm

**Source:** https://github.com/smlsoft/openclawminicrm.git
**Category:** business

<div align="center">

# OpenClaw Mini CRM

### น้องกุ้ง 13 ตัว + CEO รวม 14 ตัว --- Multi AI Agent คุมทั้งระบบ 24/7

**ระบบ CRM อัจฉริยะ Open Source --- ฟรี 100%**
**LINE . Facebook . Instagram รวมจอเดียว | 30+ หน้าจอ | 65+ API | 14 AI Agents**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.caddy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](#tech-stack)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](#tech-stack)
[![LINE](https://img.shields.io/badge/LINE-Messaging_API-00C300?logo=line&logoColor=white)](#multi-platform)
[![Facebook](https://img.shields.io/badge/Facebook-Graph_API-1877F2?logo=facebook&logoColor=white)](#multi-platform)
[![Instagram](https://img.shields.io/badge/Instagram-Graph_API-E4405F?logo=instagram&logoColor=white)](#multi-platform)

[Demo](https://crm.satistang.com/dashboard) · [คู่มือ](https://crm.satistang.com/dashboard/guide) · [ห้องน้องกุ้ง 3D](https://crm.satistang.com/dashboard/kung-room) · [แจ้งปัญหา](https://github.com/smlsoft/openclawminicrm/issues)

</div>

---

> **English:** OpenClaw Mini CRM is a free, open-source AI-powered CRM for Thai SMEs. It unifies LINE, Facebook, and Instagram in a single dashboard with 30+ screens, 65+ APIs, and 14 autonomous AI agents ("น้องกุ้ง" — shrimps) including a CEO that patrols the 3D virtual office. Features include real-time activity log, AI chat analysis, RAG knowledge base, customer memory, churn prediction, payment slip detection, document classification, auto-discover free AI models, cost tracking in Thai Baht, and more. Self-hosted on Docker Compose + Caddy + DigitalOcean. Zero monthly AI cost.

---

## น้องกุ้ง 14 ตัว --- ทีม AI ที่ทำงานให้คุณ 24/7

น้องกุ้งเป็น **สมองกลางคุมทั้งระบบ** --- Admin แค่ตอบลูกค้า น้องกุ้งจัดการที่เหลือทั้งหมด

| # | ชื่อ | บทบาท | ทำงาน |
|---|------|--------|--------|
| | **น้องกุ้ง CEO** | ผู้บริหาร เดินตรวจงาน | ตลอดเวลา --- มงกุฎทอง เดินวนทั้งออฟฟิศ ดูแลน้องกุ้งทุกตัว |
| 1 | **น้องกุ้งแก้ว** | แก้ปัญหาลูกค้า | ทุก 1 ชม. --- วิเคราะห์ปัญหา หาต้นเหตุ 5 ทางออก |
| 2 | **น้องกุ้งทองคำ** | หาโอกาสขาย | ทุก 1 ชม. --- หาลูกค้าพร้อมซื้อ กลยุทธ์ปิดการขาย |
| 3 | **น้องกุ้งครูโค้ช** | โค้ชทีมงาน | ทุก 6 ชม. --- วิเคราะห์ทีม แผนพัฒนารายบุคคล |
| 4 | **น้องกุ้งอาร์ม** | วางกลยุทธ์สัปดาห์ | จันทร์ 08:00 --- สรุปสัปดาห์ วางแผนสัปดาห์หน้า |
| 5 | **น้องกุ้งหมอใจ** | ตรวจสุขภาพลูกค้า | ทุก 3 ชม. --- Health Score 0-100 ตรวจจับลูกค้าเสี่ยง |
| 6 | **น้องกุ้งแบงค์** | ตรวจสลิป/เงินเข้า | ทุก 1 ชม. --- สลิปค้าง pending แจ้ง Admin |
| 7 | **น้องกุ้งเมฆ** | ติดตามจัดส่ง | ทุก 2 ชม. --- ลูกค้ารอนาน ร้องเรียนจัดส่งช้า |
| 8 | **น้องกุ้งขนุน** | ดึงลูกค้ากลับ | ทุก 4 ชม. --- ลูกค้าหาย 3/7/30 วัน ข้อความ re-engage |
| 9 | **น้องกุ้งแนน** | แนะนำสินค้าเพิ่ม | ทุก 2 ชม. --- upsell/cross-sell จาก purchase history |
| 10 | **น้องกุ้งบุ๋ม** | สรุปรายวัน | ทุกวัน 20:00 --- ข้อความ ลูกค้าใหม่ ยอดขาย คะแนน |
| 11 | **น้องกุ้งแต้ม** | ให้คะแนนลูกค้า | ทุก 3 ชม. --- คะแนน 0-100 จัดอันดับ Hot/Warm/Cold |
| 12 | **น้องกุ้งนาฬิกา** | เตือนนัดหมาย | ทุก 1 ชม. --- เยี่ยมงาน ส่งของ ติดตั้ง แจ้งล่วงหน้า |
| 13 | **น้องกุ้งเปรียบ** | วิเคราะห์ราคา | ทุกวัน 06:00 --- สินค้ายอดนิยม ลูกค้าบอกแพง กลยุทธ์ราคา |

พบ CRITICAL --> **ส่ง Telegram แจ้งเตือนทันที!**

---

## ห้องทำงานน้องกุ้ง 3D (kung-room)

<div align="center">

**`/kung-room`** --- ห้องทำงาน 3D ของน้องกุ้ง 14 ตัว

</div>

- **3D Virtual Office** --- Three.js + React Three Fiber แสดงน้องกุ้ง 13 ตัวนั่งทำงานที่โต๊ะ
- **น้องกุ้ง CEO เดินตรวจงาน** --- สวมมงกุฎทอง ตัวใหญ่ 1.3x สีทอง เดินเฉพาะตัวที่มีงาน (physics-based)
- **CEO ถือธงโบกสบัด** 🚩 --- ธง CEO ผืนใหญ่สีแดง เสาทอง โบกสบัดตลอดเวลา หยุดหันหน้าหาพนักงาน + เรียกชื่อ
- **วางแผนบทสนทนาล่วงหน้า** 📋 --- batch สร้างทุก 1 นาที AI ดึงผลงานจริงจาก MongoDB สร้างบทสนทนาทุกตัวทีเดียว CEO เดินถึงพูดได้ทันที ไม่ delay ไม่มีงาน = ข้าม
- **TTS เสียงไทย Neural** --- CEO เสียง Niwat (ชาย) พนักงานเสียง Premwadee (หญิง) คนละโทนชัดเจน + auto-reset 30 วิ ไม่ค้าง
- **Holographic Alert Board** 🚨 --- หน้าจอ Sci-Fi ลอยกลางออฟฟิศ แจ้งเตือนเจ้าของกิจการ (critical/warning/opportunity) วนอัตโนมัติ scan line + glow effect
- **ใบแดง** 🟥 --- ตัวที่ไม่ทำงาน โดนใบแดง "ระวังไล่ออก!" ลอยเหนือหัว
- **ของสนุกในออฟฟิศ** --- แมวส้ม 🐱 ตู้กดน้ำ 🚰 พัดลมหมุน 🌀 โดนัท 🍩 กระดิ่งทอง 🔔 ป้ายดีเด่น ⭐ LED ยอดขาย 📊
- **Speech Balloons** --- ลูกโป่งคำพูดลอยขึ้นจากหัวน้องกุ้ง แล้วแตกหายไป
- **กุ้งกระโดด** เฉพาะตอนที่กำลังทำงาน (working/excited/running/alert) ไม่ทำงาน = นั่งนิ่ง
- **Activity Log realtime** --- ดึงจาก MongoDB แสดงวันเวลา tokens ค่าใช้จ่ายเป็นบาท (ฟรี/฿x.xx)
- **สถานะ 8 แบบ:** กำลังทำงาน / นอนหลับ / กำลังคิด / ตื่นเต้น / ห่วงใย / คิดถึง / วิ่งตาม / แจ้งเตือน
- **เฟอร์นิเจอร์ครบ** --- โต๊ะ เก้าอี้ ต้นไม้ โต๊ะกาแฟ ตู้หนังสือ ไวท์บอร์ด โคมไฟ
- **Login แล้วมาที่นี่เลย** --- Google OAuth login --> redirect ตรงเข้า kung-room

---

## ระบบ AI อัจฉริยะ

### Auto-Discover Free Models
- ค้นหา AI models ฟรีจาก **OpenRouter API ทุก 1 ชม.** อัตโนมัติ
- ไม่ต้องตั้งค่าเอง --- ระบบหา model ฟรีให้เอง

### AI Providers

| ประเภท | Provider | หมายเหตุ |
|--------|----------|----------|
| **ฟรี** | OpenRouter (auto-discover 10+ free models) | AI หลัก --- Qwen3, Llama, DeepSeek, Nemotron, StepFlash ฯลฯ |
| **ฟรี** | SambaNova | dedicated fallback |
| **ฟรี** | Gemini | embedding + vision + fallback |
| **เสียเงิน (optional)** | Groq | ต้องเปิด `PAID_AI_ENABLED=true` |
| **เสียเงิน (optional)** | Cerebras | ต้องเปิด `PAID_AI_ENABLED=true` |

> **`PAID_AI_ENABLED`** --- ปิดตัวเสียเงินโดย default ตั้ง `true` ใน .env ถ้าต้องการใช้ Groq/Cerebras

### Cooldown อัตโนมัติ

ระบบจัดการ rate limit เอง ไม่ต้องทำอะไร:

| สถานการณ์ | Cooldown |
|-----------|----------|
| Rate limit (429) | 30 นาที |
| Model ไม่มี (404) | 1 ชม. |
| Error ทั่วไป | 5 นาที |
| ตัวเสียเงินใช้ได้ | 5 นาที (ให้ตัวฟรีลองก่อน) |
| Timeout | 10 นาที |

### AI Cost Tracking + AI Score
- Sidebar แสดงค่า AI **1 บรรทัด** (เดือนนี้ + จำนวน AI ฟรี) กดไปหน้า `/costs` ดูรายละเอียด
- หน้า `/costs` แสดงครบ: **วันนี้ / เมื่อวาน / 7 วัน / เดือนนี้** + provider + model + cooldown
- **AI Score Board** 🏆 --- เก็บคะแนน AI ว่าตัวไหนเก่งงานอะไร (JSON/แชท/ภาพ) เลือก AI เหมาะกับงานอัตโนมัติ
- Sidebar: **Collapsible menu groups** --- auto-collapse ที่ไม่ active ลดเมนูล้นจอ

---

## คุณสมบัติหลัก

### Multi-Platform Chat
- **LINE + Facebook + Instagram** รวมจอเดียว เปิดได้ 4 แชทพร้อมกัน
- แยกสีตาม platform --- เห็นปุ๊บรู้ทันที
- Reply-first (LINE Reply API ฟรี!) + Push fallback
- สติกเกอร์ LINE ฟรี 6 ชุด + อัพโหลดรูป + แชร์ GPS

### AI วิเคราะห์อัตโนมัติ
- ความพอใจลูกค้า / โอกาสซื้อ / แท็กอัตโนมัติ / Sales Pipeline
- AI แนะนำคำตอบ (ปุ่ม AI) + ตอบแทนอัตโนมัติ 5 นาที
- 4 โหมด bot: ปิด / อัตโนมัติ / เรียกชื่อ / Keyword

### Knowledge Base + AI Learning
- ใส่ข้อมูลร้าน (ราคา โปร นโยบาย) --> AI ดึงไปตอบลูกค้าแม่นยำ
- AI จำลูกค้ารายคน + เรียนรู้จากผลลัพธ์ ยิ่งใช้ยิ่งฉลาด
- Vector search ด้วย Qdrant + Gemini Embedding

### CRM + Pipeline
- สร้างข้อมูลลูกค้าอัตโนมัติ + ดึงรูป/ชื่อจาก LINE/FB/IG
- Pipeline: ใหม่ --> สนใจ --> เสนอราคา --> ต่อรอง --> ปิดการขาย
- Lead Scoring คะแนน 0-100 จัดอันดับ Hot/Warm/Cold
- รวมลูกค้าข้าม platform (scan อัตโนมัติ + manual merge)

### PDPA + Security
- PII Masking + Prompt Injection Protection (8 patterns)
- Audit Log + Privacy Notice + Opt-out + Right to Delete
- Rate Limit + File Validation + Webhook Signature
- Human Handoff --- ลูกค้าบอก "ขอคุยกับพนักงาน" AI หยุดทันที

### Landing Page + Visitor Counter
- Visitor counter ด้วย **fingerprint dedup** --- นับคนไม่ซ้ำ
- **Flag Counter** --- แสดงธงประเทศผู้เยี่ยมชม
- Google OAuth login --> redirect ตรงเข้าห้องน้องกุ้ง 3D

### อื่นๆ
- **Analytics Dashboard** --- 6 tabs กราฟ Recharts (ภาพรวม/ขาย/ทีม/เงิน/ลูกค้า/เอกสาร)
- **นัดหมาย** --- ปฏิทิน 7 ประเภท 6 สถานะ แจ้งเตือนล่วงหน้า
- **เงินเข้า** --- ตรวจสลิปอัตโนมัติ ยืนยัน/ปฏิเสธ สถิติยอดเงิน
- **เอกสาร** --- AI จำแนกอัตโนมัติ (บัญชี/เอกสาร/ภาพ) + confi