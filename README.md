# Team Task Manager

A full-stack team task management web application where users can create projects, manage members, assign tasks, update task status, and track project progress from a dashboard.

## Features

- Signup and login with password hashing
- Token-based authentication
- Project creation with creator as `Admin`
- Admin member management by email
- Admin task creation and editing
- Member access limited to assigned task status updates
- Dashboard metrics for total tasks, status counts, tasks per user, and overdue tasks
- REST API and frontend served from one deployable Node app

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js HTTP server
- Database: JSON document store persisted on disk
- Authentication: signed JWT-style bearer tokens with PBKDF2 password hashing
- Deployment: Railway

## Local Setup

```bash
npm install
npm start
```

Open `http://localhost:3000`.

No third-party runtime packages are required. `npm install` is still safe to run if your deployment workflow expects it.

## Environment Variables

Create a `.env` file locally if desired, or configure these in Railway:

```bash
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
DATA_FILE=./data/db.json
```

Railway automatically provides `PORT`, so only `JWT_SECRET` is required for production. `DATA_FILE` can be changed if you attach a persistent volume.

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project.
3. Choose **Deploy from GitHub repo** and select this repository.
4. Set the environment variable:

```bash
JWT_SECRET=your-production-secret
```

5. Railway will run:

```bash
npm start
```

6. Open the generated Railway domain and test signup/login.

## API Overview

All protected routes require:

```http
Authorization: Bearer <token>
```

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `GET /api/projects/:projectId/dashboard`

### Members

- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`

### Tasks

- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`

## Role Rules

`Admin`

- Add and remove members
- Create tasks
- Edit task details
- Assign tasks
- Delete tasks
- Update any task status

`Member`

- View projects where they are a member
- View project tasks
- Update status only for tasks assigned to them


## Submission

- Live application URL: https://team-task-manager-production-c6eb.up.railway.app
- GitHub repository: https://github.com/kothaAbhinayasri/team-task-manager
- Demo video: 
