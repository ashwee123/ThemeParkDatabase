import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory DB
let employees = [];
let managers = [];
let activities = [];
let salaries = [];

/* ---------------- EMPLOYEES ---------------- */
app.get("/employees", (req, res) => res.json(employees));

app.post("/employees", (req, res) => {
  const emp = { id: Date.now(), ...req.body };
  employees.push(emp);
  res.json(emp);
});

/* ---------------- MANAGERS ---------------- */
app.get("/managers", (req, res) => res.json(managers));

app.post("/managers", (req, res) => {
  const manager = { id: Date.now(), ...req.body };
  managers.push(manager);
  res.json(manager);
});

/* ---------------- ACTIVITIES ---------------- */
app.get("/activities", (req, res) => res.json(activities));

app.post("/activities", (req, res) => {
  const act = { id: Date.now(), ...req.body };
  activities.push(act);
  res.json(act);
});

/* ---------------- SALARY ---------------- */
app.get("/salary", (req, res) => res.json(salaries));

app.post("/salary", (req, res) => {
  const sal = { id: Date.now(), ...req.body };
  salaries.push(sal);
  res.json(sal);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
