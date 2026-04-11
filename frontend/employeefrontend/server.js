/**
 * Nighttime Nexus — Employee Portal Backend
 * Stack: Node.js + Express + mysql2
 * DB:    Azure MySQL (newthemepark)
 */

const express  = require('express');
const mysql    = require('mysql2/promise');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── DB Pool ── */
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'themepark6.mysql.database.azure.com',
  user:     process.env.DB_USER     || 'admin1',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'newthemepark',
  ssl:      { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit:    10,
});

const JWT_SECRET = process.env.JWT_SECRET || 'nighttime-nexus-secret-change-me';

/* ── Auth Middleware ── */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.employee = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/* ══════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════ */

/* POST /api/auth/login */
app.post('/api/auth/login', async (req, res) => {
  const { employeeId, password } = req.body;
  if (!employeeId || !password)
    return res.status(400).json({ error: 'employeeId and password required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM employee WHERE EmployeeID = ?', [employeeId]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const emp = rows[0];

    /* 
      NOTE: The current schema stores no password field on employee.
      For production, add a PasswordHash column and use bcrypt.compare().
      Demo fallback: accept "password" for all employees.
    */
    const valid = emp.PasswordHash
      ? await bcrypt.compare(password, emp.PasswordHash)
      : password === 'password';

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: emp.EmployeeID, name: emp.Name, position: emp.Position, areaId: emp.AreaID },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, employee: { id: emp.EmployeeID, name: emp.Name, position: emp.Position, areaId: emp.AreaID, hireDate: emp.HireDate, salary: emp.Salary, managerId: emp.ManagerID } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══════════════════════════════════════════════
   EMPLOYEE ROUTES
══════════════════════════════════════════════ */

/* GET /api/employee/me */
app.get('/api/employee/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, a.AreaName
       FROM employee e
       LEFT JOIN area a ON e.AreaID = a.AreaID
       WHERE e.EmployeeID = ?`, [req.employee.id]
    );
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* PATCH /api/employee/password */
app.patch('/api/employee/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords required' });

  try {
    const [rows] = await pool.query('SELECT PasswordHash FROM employee WHERE EmployeeID = ?', [req.employee.id]);
    const emp = rows[0];
    const valid = emp?.PasswordHash
      ? await bcrypt.compare(currentPassword, emp.PasswordHash)
      : currentPassword === 'password';

    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE employee SET PasswordHash = ? WHERE EmployeeID = ?', [hash, req.employee.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   SHIFTS
══════════════════════════════════════════════ */

/* GET /api/shifts */
app.get('/api/shifts', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM shift WHERE EmployeeID = ? ORDER BY ShiftDate ASC', [req.employee.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   TIME LOG
══════════════════════════════════════════════ */

/* GET /api/timelog */
app.get('/api/timelog', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM timelog WHERE EmployeeID = ? ORDER BY LogID DESC', [req.employee.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* POST /api/timelog/clockin */
app.post('/api/timelog/clockin', auth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO timelog (EmployeeID, ClockIn) VALUES (?, NOW())', [req.employee.id]
    );
    res.json({ logId: result.insertId, message: 'Clocked in' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* PATCH /api/timelog/clockout/:logId */
app.patch('/api/timelog/clockout/:logId', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE timelog
       SET ClockOut = NOW(),
           HoursWorked = ROUND(TIMESTAMPDIFF(SECOND, ClockIn, NOW())/3600, 2)
       WHERE LogID = ? AND EmployeeID = ?`,
      [req.params.logId, req.employee.id]
    );
    res.json({ message: 'Clocked out' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* POST /api/timelog  — manual entry */
app.post('/api/timelog', auth, async (req, res) => {
  const { clockIn, clockOut } = req.body;
  if (!clockIn) return res.status(400).json({ error: 'clockIn required' });
  try {
    const hours = clockOut
      ? `ROUND(TIMESTAMPDIFF(SECOND, '${clockIn}', '${clockOut}')/3600, 2)`
      : 'NULL';
    const [result] = await pool.query(
      `INSERT INTO timelog (EmployeeID, ClockIn, ClockOut, HoursWorked)
       VALUES (?, ?, ?, ${hours})`,
      [req.employee.id, clockIn, clockOut || null]
    );
    res.json({ logId: result.insertId, message: 'Entry saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* DELETE /api/timelog/:logId */
app.delete('/api/timelog/:logId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM timelog WHERE LogID = ? AND EmployeeID = ?', [req.params.logId, req.employee.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   INCIDENTS
══════════════════════════════════════════════ */

/* GET /api/incidents */
app.get('/api/incidents', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM incidentreport WHERE EmployeeID = ? ORDER BY ReportDate DESC', [req.employee.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* POST /api/incidents */
app.post('/api/incidents', auth, async (req, res) => {
  const { reportType, description, attractionId, itemId } = req.body;
  if (!reportType || !description)
    return res.status(400).json({ error: 'reportType and description required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO incidentreport (EmployeeID, ReportType, Description, AttractionID, ItemID) VALUES (?,?,?,?,?)',
      [req.employee.id, reportType, description, attractionId || null, itemId || null]
    );
    res.json({ reportId: result.insertId, message: 'Report filed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   ATTRACTIONS
══════════════════════════════════════════════ */

/* GET /api/attractions */
app.get('/api/attractions', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, ar.AreaName
       FROM attraction a
       LEFT JOIN area ar ON a.AreaID = ar.AreaID
       ORDER BY a.AttractionName`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   PERFORMANCE
══════════════════════════════════════════════ */

/* GET /api/performance */
app.get('/api/performance', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM employeeperformance WHERE EmployeeID = ? ORDER BY ReviewDate ASC', [req.employee.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   MAINTENANCE ALERTS (read-only for employees)
══════════════════════════════════════════════ */

/* GET /api/alerts */
app.get('/api/alerts', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM activemaintenancealerts ORDER BY CreatedAt DESC LIMIT 20');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   DASHBOARD SUMMARY
══════════════════════════════════════════════ */

/* GET /api/dashboard */
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const id = req.employee.id;

    const [[hoursRow]]  = await pool.query(
      `SELECT COALESCE(SUM(HoursWorked),0) AS weekHours
       FROM timelog
       WHERE EmployeeID = ? AND ClockIn >= DATE_SUB(NOW(), INTERVAL 7 DAY)`, [id]);

    const [[shiftRow]]  = await pool.query(
      `SELECT COUNT(*) AS upcoming FROM shift WHERE EmployeeID = ? AND ShiftDate >= CURDATE()`, [id]);

    const [[incRow]]    = await pool.query(
      `SELECT COUNT(*) AS total FROM incidentreport WHERE EmployeeID = ?`, [id]);

    const [[perfRow]]   = await pool.query(
      `SELECT PerformanceScore FROM employeeperformance WHERE EmployeeID = ? ORDER BY ReviewDate DESC LIMIT 1`, [id]);

    res.json({
      weekHours:     parseFloat(hoursRow.weekHours).toFixed(1),
      upcomingShifts: shiftRow.upcoming,
      incidentsFiled: incRow.total,
      latestScore:    perfRow ? perfRow.PerformanceScore : null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Catch-all → SPA ── */
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌙 Nighttime Nexus running on http://localhost:${PORT}`));
