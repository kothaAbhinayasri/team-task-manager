const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  projects: [],
  activeProjectId: localStorage.getItem("ttm_project")
};

const $ = (selector) => document.querySelector(selector);
const statuses = ["To Do", "In Progress", "Done"];

function toast(message, isError = true) {
  const node = $("#toast");
  node.textContent = message;
  node.style.color = isError ? "var(--danger)" : "var(--accent)";
  node.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("ttm_token", state.token);
  localStorage.setItem("ttm_user", JSON.stringify(state.user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.projects = [];
  state.activeProjectId = null;
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
  localStorage.removeItem("ttm_project");
}

function showAuth(mode = "login") {
  $("#authView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
  $("#loginForm").classList.toggle("hidden", mode !== "login");
  $("#signupForm").classList.toggle("hidden", mode !== "signup");
  $("#showLogin").classList.toggle("active", mode === "login");
  $("#showSignup").classList.toggle("active", mode === "signup");
}

function showApp() {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#currentUser").textContent = `${state.user.name} (${state.user.email})`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function activeProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0] || null;
}

async function loadProjects() {
  const { projects } = await api("/api/projects");
  state.projects = projects;
  if (!state.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.projects[0]?.id || null;
  }
  if (state.activeProjectId) localStorage.setItem("ttm_project", state.activeProjectId);
  render();
}

function renderProjects(project) {
  $("#projectList").innerHTML = state.projects
    .map(
      (item) => `
        <button class="project-button ${item.id === project?.id ? "active" : ""}" type="button" data-project="${item.id}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.members.length} member${item.members.length === 1 ? "" : "s"} · ${item.role}</span>
        </button>
      `
    )
    .join("");
}

function renderStats(project) {
  const tasks = project?.tasks || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  $("#statTotal").textContent = tasks.length;
  $("#statTodo").textContent = tasks.filter((task) => task.status === "To Do").length;
  $("#statProgress").textContent = tasks.filter((task) => task.status === "In Progress").length;
  $("#statOverdue").textContent = tasks.filter((task) => task.status !== "Done" && new Date(task.dueDate) < today).length;
}

function renderBoard(project) {
  if (!project) {
    $("#taskBoard").innerHTML = `<p class="muted">Create a project to start tracking work.</p>`;
    return;
  }

  $("#taskBoard").innerHTML = statuses
    .map((status) => {
      const cards = project.tasks
        .filter((task) => task.status === status)
        .map((task) => taskCard(task, project))
        .join("");
      return `<section class="column"><h3>${status}</h3>${cards || `<p class="muted">No tasks</p>`}</section>`;
    })
    .join("");
}

function taskCard(task, project) {
  const canEdit = project.role === "Admin";
  const canUpdate = canEdit || task.assignee?.id === state.user.id;
  const priorityClass = task.priority === "High" ? "high" : "";
  return `
    <article class="task-card">
      <header>
        <strong>${escapeHtml(task.title)}</strong>
        <span class="pill ${priorityClass}">${task.priority}</span>
      </header>
      <p class="muted">${escapeHtml(task.description || "No description")}</p>
      <div class="task-meta">
        <span>Due ${task.dueDate}</span>
        <span>Assigned to ${escapeHtml(task.assignee?.name || "Unknown")}</span>
      </div>
      <div class="task-actions">
        <select data-status="${task.id}" ${canUpdate ? "" : "disabled"}>
          ${statuses.map((status) => `<option ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        ${canEdit ? `<button class="ghost small" type="button" data-edit="${task.id}">Edit</button>` : ""}
      </div>
    </article>
  `;
}

function renderMembers(project) {
  if (!project) {
    $("#memberList").innerHTML = `<p class="muted">No project selected.</p>`;
    $("#tasksPerUser").innerHTML = "";
    return;
  }

  $("#memberList").innerHTML = project.members
    .map((member) => {
      const canRemove = project.role === "Admin" && member.user.id !== project.createdBy && member.user.id !== state.user.id;
      return `
        <div class="member">
          <div><strong>${escapeHtml(member.user.name)}</strong><br><span>${escapeHtml(member.user.email)} · ${member.role}</span></div>
          ${canRemove ? `<button class="ghost small" type="button" data-remove-member="${member.user.id}">Remove</button>` : ""}
        </div>
      `;
    })
    .join("");

  const counts = {};
  for (const task of project.tasks) counts[task.assignee?.name || "Unassigned"] = (counts[task.assignee?.name || "Unassigned"] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  $("#tasksPerUser").innerHTML =
    Object.entries(counts)
      .map(
        ([name, count]) => `
          <div class="bar">
            <strong>${escapeHtml(name)} <span>${count}</span></strong>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
          </div>
        `
      )
      .join("") || `<p class="muted">No assigned tasks yet.</p>`;
}

function render() {
  const project = activeProject();
  renderProjects(project);
  $("#projectTitle").textContent = project?.name || "Team dashboard";
  $("#projectRole").textContent = project ? `${project.role} access` : "Select a project";
  $("#projectDescription").textContent = project?.description || "Your task metrics and assignments appear here.";
  $("#newTaskButton").disabled = !project || project.role !== "Admin";
  $("#addMemberButton").disabled = !project || project.role !== "Admin";
  renderStats(project);
  renderBoard(project);
  renderMembers(project);
}

function fillTaskForm(task = null) {
  const project = activeProject();
  const form = $("#taskForm");
  form.reset();
  form.taskId.value = task?.id || "";
  form.title.value = task?.title || "";
  form.description.value = task?.description || "";
  form.dueDate.value = task?.dueDate || new Date().toISOString().slice(0, 10);
  form.priority.value = task?.priority || "Medium";
  form.status.value = task?.status || "To Do";
  form.assigneeId.innerHTML = project.members
    .map((member) => `<option value="${member.user.id}" ${member.user.id === task?.assignee?.id ? "selected" : ""}>${escapeHtml(member.user.name)}</option>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#showLogin").addEventListener("click", () => showAuth("login"));
$("#showSignup").addEventListener("click", () => showAuth("signup"));

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setSession(await api("/api/auth/login", { method: "POST", body: JSON.stringify(formData(event.target)) }));
    showApp();
    await loadProjects();
  } catch (error) {
    $("#authMessage").textContent = error.message;
  }
});

$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setSession(await api("/api/auth/signup", { method: "POST", body: JSON.stringify(formData(event.target)) }));
    showApp();
    await loadProjects();
  } catch (error) {
    $("#authMessage").textContent = error.message;
  }
});

$("#logoutButton").addEventListener("click", () => {
  clearSession();
  showAuth("login");
});

$("#refreshButton").addEventListener("click", () => loadProjects().catch((error) => toast(error.message)));
$("#newProjectButton").addEventListener("click", () => $("#projectDialog").showModal());
$("#newTaskButton").addEventListener("click", () => {
  fillTaskForm();
  $("#taskDialog").showModal();
});
$("#addMemberButton").addEventListener("click", () => $("#memberDialog").showModal());

document.addEventListener("click", async (event) => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) closeButton.closest("dialog").close();

  const projectButton = event.target.closest("[data-project]");
  if (projectButton) {
    state.activeProjectId = projectButton.dataset.project;
    localStorage.setItem("ttm_project", state.activeProjectId);
    render();
  }

  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const project = activeProject();
    const task = project.tasks.find((item) => item.id === editButton.dataset.edit);
    fillTaskForm(task);
    $("#taskDialog").showModal();
  }

  const removeButton = event.target.closest("[data-remove-member]");
  if (removeButton && confirm("Remove this member from the project?")) {
    try {
      await api(`/api/projects/${activeProject().id}/members/${removeButton.dataset.removeMember}`, { method: "DELETE" });
      await loadProjects();
      toast("Member removed", false);
    } catch (error) {
      toast(error.message);
    }
  }
});

document.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-status]")) return;
  try {
    await api(`/api/tasks/${event.target.dataset.status}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) });
    await loadProjects();
  } catch (error) {
    toast(error.message);
  }
});

$("#projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { project } = await api("/api/projects", { method: "POST", body: JSON.stringify(formData(event.target)) });
    state.activeProjectId = project.id;
    $("#projectDialog").close();
    event.target.reset();
    await loadProjects();
    toast("Project created", false);
  } catch (error) {
    toast(error.message);
  }
});

$("#memberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api(`/api/projects/${activeProject().id}/members`, { method: "POST", body: JSON.stringify(formData(event.target)) });
    $("#memberDialog").close();
    event.target.reset();
    await loadProjects();
    toast("Member added", false);
  } catch (error) {
    toast(error.message);
  }
});

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formData(event.target);
  const taskId = payload.taskId;
  delete payload.taskId;
  try {
    if (taskId) {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await api(`/api/projects/${activeProject().id}/tasks`, { method: "POST", body: JSON.stringify(payload) });
    }
    $("#taskDialog").close();
    await loadProjects();
    toast("Task saved", false);
  } catch (error) {
    toast(error.message);
  }
});

(async function init() {
  if (!state.token) {
    showAuth("login");
    return;
  }
  try {
    const { user } = await api("/api/me");
    state.user = user;
    showApp();
    await loadProjects();
  } catch {
    clearSession();
    showAuth("login");
  }
})();
