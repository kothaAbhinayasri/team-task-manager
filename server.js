const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DB_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const STATUS_VALUES = ["To Do", "In Progress", "Done"];
const PRIORITY_VALUES = ["Low", "Medium", "High"];

function ensureDatabase() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    writeDb({ users: [], projects: [], tasks: [] });
  }
}

function readDb() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = storedHash.split(":");
  const actual = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function getAuthUser(req, db) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) return null;
  return db.users.find((user) => user.id === payload.sub) || null;
}

function memberRole(project, userId) {
  return project.members.find((member) => member.userId === userId)?.role || null;
}

function requireProject(db, projectId) {
  return db.projects.find((project) => project.id === projectId);
}

function assertText(value, label, min = 1, max = 120) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new Error(`${label} must be ${min}-${max} characters`);
  }
  return value.trim();
}

function assertDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error("Due date is required");
  return new Date(value).toISOString().slice(0, 10);
}

function expandProject(project, db, currentUserId) {
  const tasks = db.tasks.filter((task) => task.projectId === project.id);
  const members = project.members
    .map((member) => ({ ...member, user: sanitizeUser(db.users.find((user) => user.id === member.userId)) }))
    .filter((member) => member.user);
  return {
    ...project,
    role: memberRole(project, currentUserId),
    members,
    tasks: tasks.map((task) => expandTask(task, db))
  };
}

function expandTask(task, db) {
  return {
    ...task,
    assignee: sanitizeUser(db.users.find((user) => user.id === task.assigneeId)),
    createdBy: sanitizeUser(db.users.find((user) => user.id === task.createdBy))
  };
}

function buildDashboard(projects, db) {
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = db.tasks.filter((task) => projectIds.has(task.projectId));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byStatus = Object.fromEntries(STATUS_VALUES.map((status) => [status, 0]));
  const perUser = {};
  for (const task of tasks) {
    byStatus[task.status] += 1;
    const assignee = db.users.find((user) => user.id === task.assigneeId);
    const key = assignee?.name || "Unassigned";
    perUser[key] = (perUser[key] || 0) + 1;
  }
  return {
    totalTasks: tasks.length,
    byStatus,
    perUser,
    overdue: tasks.filter((task) => task.status !== "Done" && new Date(task.dueDate) < today).length
  };
}

async function handleApi(req, res, pathname) {
  const db = readDb();
  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? await parseBody(req) : {};

  if (pathname === "/api/auth/signup" && req.method === "POST") {
    const name = assertText(body.name, "Name", 2, 80);
    const email = assertText(body.email, "Email", 5, 160).toLowerCase();
    const password = assertText(body.password, "Password", 8, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, "Email is invalid");
    if (db.users.some((user) => user.email === email)) return sendError(res, 409, "Email is already registered");
    const user = { id: id("usr"), name, email, passwordHash: hashPassword(password), createdAt: now() };
    db.users.push(user);
    writeDb(db);
    return sendJson(res, 201, { token: signToken({ sub: user.id }), user: sanitizeUser(user) });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const email = assertText(body.email, "Email", 5, 160).toLowerCase();
    const password = assertText(body.password, "Password", 1, 120);
    const user = db.users.find((candidate) => candidate.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) return sendError(res, 401, "Invalid email or password");
    return sendJson(res, 200, { token: signToken({ sub: user.id }), user: sanitizeUser(user) });
  }

  const user = getAuthUser(req, db);
  if (!user) return sendError(res, 401, "Authentication required");

  if (pathname === "/api/me" && req.method === "GET") {
    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (pathname === "/api/projects" && req.method === "GET") {
    const projects = db.projects.filter((project) => memberRole(project, user.id));
    return sendJson(res, 200, { projects: projects.map((project) => expandProject(project, db, user.id)) });
  }

  if (pathname === "/api/projects" && req.method === "POST") {
    const name = assertText(body.name, "Project name", 2, 100);
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
    const project = {
      id: id("prj"),
      name,
      description,
      createdBy: user.id,
      createdAt: now(),
      members: [{ userId: user.id, role: "Admin", addedAt: now() }]
    };
    db.projects.push(project);
    writeDb(db);
    return sendJson(res, 201, { project: expandProject(project, db, user.id) });
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)(?:\/(members|tasks|dashboard))?$/);
  if (projectMatch) {
    const [, projectId, child] = projectMatch;
    const project = requireProject(db, projectId);
    if (!project) return sendError(res, 404, "Project not found");
    const role = memberRole(project, user.id);
    if (!role) return sendError(res, 403, "You are not a member of this project");

    if (!child && req.method === "GET") {
      return sendJson(res, 200, { project: expandProject(project, db, user.id) });
    }

    if (child === "dashboard" && req.method === "GET") {
      return sendJson(res, 200, { dashboard: buildDashboard([project], db) });
    }

    if (child === "members" && req.method === "POST") {
      if (role !== "Admin") return sendError(res, 403, "Only admins can add members");
      const email = assertText(body.email, "Email", 5, 160).toLowerCase();
      const target = db.users.find((candidate) => candidate.email === email);
      if (!target) return sendError(res, 404, "User with that email was not found");
      if (memberRole(project, target.id)) return sendError(res, 409, "User is already a member");
      project.members.push({ userId: target.id, role: body.role === "Admin" ? "Admin" : "Member", addedAt: now() });
      writeDb(db);
      return sendJson(res, 201, { project: expandProject(project, db, user.id) });
    }

    if (child === "tasks" && req.method === "POST") {
      if (role !== "Admin") return sendError(res, 403, "Only admins can create tasks");
      const title = assertText(body.title, "Title", 2, 120);
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
      const dueDate = assertDate(body.dueDate);
      const priority = PRIORITY_VALUES.includes(body.priority) ? body.priority : "Medium";
      const assigneeId = assertText(body.assigneeId, "Assignee", 3, 80);
      if (!memberRole(project, assigneeId)) return sendError(res, 400, "Assignee must be a project member");
      const task = {
        id: id("tsk"),
        projectId,
        title,
        description,
        dueDate,
        priority,
        status: STATUS_VALUES.includes(body.status) ? body.status : "To Do",
        assigneeId,
        createdBy: user.id,
        createdAt: now(),
        updatedAt: now()
      };
      db.tasks.push(task);
      writeDb(db);
      return sendJson(res, 201, { task: expandTask(task, db) });
    }
  }

  const memberDeleteMatch = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
  if (memberDeleteMatch && req.method === "DELETE") {
    const [, projectId, memberId] = memberDeleteMatch;
    const project = requireProject(db, projectId);
    if (!project) return sendError(res, 404, "Project not found");
    if (memberRole(project, user.id) !== "Admin") return sendError(res, 403, "Only admins can remove members");
    if (memberId === project.createdBy) return sendError(res, 400, "Project creator cannot be removed");
    project.members = project.members.filter((member) => member.userId !== memberId);
    db.tasks = db.tasks.map((task) => (task.projectId === projectId && task.assigneeId === memberId ? { ...task, assigneeId: project.createdBy } : task));
    writeDb(db);
    return sendJson(res, 200, { project: expandProject(project, db, user.id) });
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && ["PATCH", "DELETE"].includes(req.method)) {
    const task = db.tasks.find((candidate) => candidate.id === taskMatch[1]);
    if (!task) return sendError(res, 404, "Task not found");
    const project = requireProject(db, task.projectId);
    const role = memberRole(project, user.id);
    if (!role) return sendError(res, 403, "You are not a member of this project");

    if (req.method === "DELETE") {
      if (role !== "Admin") return sendError(res, 403, "Only admins can delete tasks");
      db.tasks = db.tasks.filter((candidate) => candidate.id !== task.id);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (role !== "Admin" && task.assigneeId !== user.id) {
      return sendError(res, 403, "Members can update only their assigned tasks");
    }

    if (body.status !== undefined) {
      if (!STATUS_VALUES.includes(body.status)) return sendError(res, 400, "Invalid status");
      task.status = body.status;
    }

    if (role === "Admin") {
      if (body.title !== undefined) task.title = assertText(body.title, "Title", 2, 120);
      if (body.description !== undefined) task.description = String(body.description).trim().slice(0, 1000);
      if (body.dueDate !== undefined) task.dueDate = assertDate(body.dueDate);
      if (body.priority !== undefined) {
        if (!PRIORITY_VALUES.includes(body.priority)) return sendError(res, 400, "Invalid priority");
        task.priority = body.priority;
      }
      if (body.assigneeId !== undefined) {
        if (!memberRole(project, body.assigneeId)) return sendError(res, 400, "Assignee must be a project member");
        task.assigneeId = body.assigneeId;
      }
    }

    task.updatedAt = now();
    writeDb(db);
    return sendJson(res, 200, { task: expandTask(task, db) });
  }

  return sendError(res, 404, "API route not found");
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    sendError(res, error.message === "Invalid JSON" ? 400 : 500, error.message || "Server error");
  }
});

server.listen(PORT, () => {
  ensureDatabase();
  console.log(`Team Task Manager running on http://localhost:${PORT}`);
});
