# 🏤 JHCIS Database Schema Guide (รพสต.)
**คู่มือและ Data Dictionary ฉบับนักพัฒนา (Developer Guide) - Deep Research Edition**
คู่มือเจาะลึกโครงสร้างตารางและคอลัมน์สำคัญสำหรับระบบ JHCIS (Java Health Center Information System) ในระดับ รพสต.

## 👥 1. โครงสร้างข้อมูลพื้นฐาน (Demographics & Public Health)
การเชื่อมโยงบุคคล บ้าน และสิทธิ

### 1.1 ทะเบียนประชากรและบ้าน
*   **ตาราง `person` (ประชากรในพื้นที่)**:
    *   **`pid`**: รหัสประจำตัวบุคคลภายในระบบ (คีย์หลักใช้ Join)
    *   `idcard`: เลขประจำตัวประชาชน 13 หลัก
    *   `prename`, `fname`, `lname`: คำนำหน้า, ชื่อ, นามสกุล
    *   `birthdate`: วันเกิด (Format: YYYY-MM-DD)
    *   `sex`: เพศ (1=ชาย, 2=หญิง)
    *   `rightcode`: รหัสสิทธิการรักษา (เชื่อม `ctitleright.rightcode`)
    *   `hcode`: รหัสบ้าน (เชื่อม `house.hcode`)
*   **ตาราง `house` (ข้อมูลบ้านและพิกัด)**:
    *   **`hcode`**: รหัสที่อยู่ภายในระบบ
    *   `hno`: บ้านเลขที่
    *   `villcode`: รหัสหมู่บ้าน (เชื่อมโยงฐานข้อมูลตำบล)
    *   `xgis`, `ygis`: พิกัดบ้าน (Latitude/Longitude) สำหรับแผนที่สุขภาพ

---

## 🕒 2. เส้นทางข้อมูลคนไข้และงานส่งเสริม (Journey & Prevention)

### 2.1 งานคัดกรองและตรวจรักษา (OPD)
*   **ตาราง `visit` (Main Transaction)**:
    *   **`visitno`**: รหัสรับบริการ (คีย์หลักแบบ Transaction)
    *   **`pid`**: เชื่อมโยงตัวบุคคล
    *   `visitdate`: วันเริ่มรับบริการ
    *   `symptoms`: อาการสำคัญ (CC)
    *   `weight`, `height`: น้ำหนัก (kg), ส่วนสูง (cm)
    *   `pressure`: ความดัน (เช่น '120/80')
    *   `temperature`: อุณหภูมิร่างกาย
*   **ตาราง `visitdiag` (ผลวินิจฉัย)**:
    *   `visitno`, `pid`
    *   **`diagcode`**: รหัส ICD-10 (เชื่อม `cicd10`) หรือ ICD-9
    *   `dxtype`: ประเภทวินิจฉัย (10, 20, 30, 40)
*   **ตาราง `visitdrug` (การคลังยาและจ่ายยา)**:
    *   `visitno`, `pid`
    *   **`drugcode`**: รหัสยาภายใน (เชื่อม `cdrug`)
    *   `unit`: จำนวนที่จ่าย
    *   `costprice`, `realprice`: ราคาทุน, ราคาขายจริง

### 2.2 งานสร้างเสริมภูมิคุ้มกัน (EPI)
*   **ตาราง `visitepi`**:
    *   `pid`, `visitno`
    *   **`vaccinecode`**: รหัสวัคซีน (เช่น 'DTP-HB')
    *   `lotno`: เลขที่ล็อตวัคซีน
    *   `dateepi`: วันที่ได้รับวัคซีนจริง

### 2.3 งานควบคุมโรคเรื้อรัง (NCD)
*   **ตาราง `personchronic` (ทะเบียนโรคเรื้อรัง)**:
    *   **`pid`**: คีย์ประจำตัวบุคคล
    *   **`chroniccode`**: รหัสกลุ่มโรคเรื้อรัง (เชื่อม `cchronic`)
    *   `datefirstdiag`: วันที่ตรวจพบโรคครั้งแรก

---

## 💻 3. ตัวอย่าง SQL Query ขั้นสูงสำหรับ Developer (JHCIS)

### 📌 ดึงรายชื่อเด็กในหมู่บ้านที่ยังไม่ได้รับวัคซีนตามวันนัด (Case Management)
```sql
SELECT 
    p.pid, p.fname, p.lname,
    h.hno, h.villcode,
    e.vaccinecode, e.dateepi
FROM person p
JOIN house h ON h.hcode = p.hcode
LEFT JOIN visitepi e ON e.pid = p.pid
WHERE p.birthdate > '2023-01-01' -- เด็กเกิดใหม่
  AND h.villcode = '1' -- เฉพาะหมู่ 1
ORDER BY p.birthdate DESC;
```

---
*เอกสาร Deep Research โดย Antigravity AI - JHCIS Version 2026-03-30*
