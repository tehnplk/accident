-- รายงานอุบัติเหตุทางการจราจร (คิวรี่ล่าสุดแบบ JSON)
-- ปีปฏิทิน 2026 (2026-01-01 ถึง 2026-12-31)
-- ฐานข้อมูล: HOSxP (MySQL)
-- ============================================================

SELECT
    (SELECT hospitalcode FROM opdconfig LIMIT 1)    AS hoscode,
    (SELECT hospitalname FROM opdconfig LIMIT 1)    AS hosname,
    p.hn                                            AS hn,
    p.cid                                           AS cid,
    CONCAT(p.pname, p.fname, ' ', p.lname)          AS patient_name,
    v.vn                                            AS vn,
    DATE_FORMAT(v.vstdate, '%Y-%m-%d')              AS visit_date,
    TIME_FORMAT(v.vsttime, '%H:%i:%s')              AS visit_time,
    CASE p.sex
        WHEN '1' THEN 'ชาย'
        WHEN '2' THEN 'หญิง'
        ELSE '-'
    END                                             AS sex,
    TIMESTAMPDIFF(YEAR, p.birthday, v.vstdate)      AS age,
    -- ที่อยู่ตามบัตรประชาชน
    p.addrpart                                      AS house_no,
    p.moopart                                       AS moo,
    p.road                                          AS road,
    t.name                                          AS tumbon,
    a.name                                          AS amphoe,
    c.name                                          AS changwat,
    REPLACE(REPLACE(REPLACE(COALESCE(os.cc, er.er_list, '-'), '\r', ' '), '\n', ' '), '|', '/') AS cc,
    -- Principal DX (diagtype = '1')
    (
        SELECT JSON_OBJECT('code', d1.icd10, 'name', i1.name)
        FROM ovstdiag d1
        JOIN icd101 i1 ON i1.code = d1.icd10
        WHERE d1.vn = v.vn
            AND d1.diagtype = '1'
        ORDER BY d1.icd10
        LIMIT 1
    )                                               AS pdx,
    -- External Cause DX (diagtype = '5')
    (
        SELECT JSON_OBJECT('code', d2.icd10, 'name', i2.name)
        FROM ovstdiag d2
        JOIN icd101 i2 ON i2.code = d2.icd10
        WHERE d2.vn = v.vn
            AND d2.diagtype = '5'
        ORDER BY d2.icd10
        LIMIT 1
    )                                               AS ext_dx,
    (
        SELECT CONCAT('[', GROUP_CONCAT(DISTINCT JSON_OBJECT('code', d3.icd10, 'name', i3.name) ORDER BY d3.icd10 SEPARATOR ','), ']')
        FROM ovstdiag d3
        JOIN icd101 i3 ON i3.code = d3.icd10
        WHERE d3.vn = v.vn
    )                                               AS dx_list,
    IFNULL(el.er_emergency_level_name, '-')        AS triage,
    CASE ost.export_code
        WHEN '1' THEN 'กลับบ้าน'
        WHEN '2' THEN 'นอน รพ.'
        WHEN '3' THEN 'ส่งต่อ'
        WHEN '4' THEN 'เสียชีวิต'
        ELSE '-'
    END                                             AS status,
    'auto'                                          AS source
FROM ovst v
    JOIN patient p          ON p.hn   = v.hn
    LEFT JOIN opdscreen os  ON os.vn  = v.vn
    LEFT JOIN er_regist er  ON er.vn  = v.vn
    LEFT JOIN er_emergency_level el
        ON el.er_emergency_level_id = er.er_emergency_level_id
    LEFT JOIN ovstost ost   ON ost.ovstost = v.ovstost
    -- Join ที่อยู่
    LEFT JOIN thaiaddress t ON t.chwpart = p.chwpart AND t.amppart = p.amppart AND t.tmbpart = p.tmbpart AND t.codetype = '3'
    LEFT JOIN thaiaddress a ON a.chwpart = p.chwpart AND a.amppart = p.amppart AND a.tmbpart = '00' AND a.codetype = '2'
    LEFT JOIN thaiaddress c ON c.chwpart = p.chwpart AND c.amppart = '00' AND c.tmbpart = '00' AND c.codetype = '1'
WHERE EXISTS (
        SELECT 1
        FROM ovstdiag d0
        WHERE d0.vn = v.vn AND d0.icd10 LIKE 'V%'
    )
    AND v.vstdate BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY v.vstdate
LIMIT 10
