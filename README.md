# Team Task Manager

## Full-Stack Team Task Management Web Application

Team Task Manager is a collaborative project and task management application built for teams that need a simple way to organize work, assign responsibilities, and track progress. It supports secure authentication, project-based collaboration, role-based access control, task assignment, status tracking, and dashboard analytics.

This project was developed as part of a full-stack coding assignment and is inspired by lightweight versions of tools like Trello and Asana.

## Live Links

- Live Application: https://team-task-manager-production-c6eb.up.railway.app
- GitHub Repository: https://github.com/kothaAbhinayasri/team-task-manager
- Demo Video: Add your demo video link here

## Project Highlights

- Complete full-stack application
- Secure signup and login flow
- Role-based access for Admin and Member users
- Project creation and member management
- Task creation, assignment, priority, due date, and status tracking
- Dashboard with useful team productivity metrics
- RESTful API design
- Railway deployment ready
- Clean responsive user interface

## Features

### User Authentication

- Users can sign up with name, email, and password.
- Users can log in securely.
- Passwords are hashed before being stored.
- Authentication is handled using signed bearer tokens.

### Project Management

- Users can create projects.
- The project creator automatically becomes the project Admin.
- Admin users can add members to a project using email.
- Admin users can remove members from a project.
- Members can view projects they belong to.

### Task Management

- Admin users can create tasks inside projects.
- Each task includes:
  - Title
  - Description
  - Due date
  - Priority
  - Status
  - Assignee
- Task statuses include:
  - To Do
  - In Progress
  - Done
- Assigned members can update the status of their own tasks.

### Dashboard

Each project includes dashboard metrics for:

- Total tasks
- Tasks by status
- Tasks per user
- Overdue tasks

### Role-Based Access Control

| Feature | Admin | Member |
|---|---:|---:|
| Create project | Yes | Yes |
| Add members | Yes | No |
| Remove members | Yes | No |
| Create tasks | Yes | No |
| Edit task details | Yes | No |
| Assign tasks | Yes | No |
| Delete tasks | Yes | No |
| View project tasks | Yes | Yes |
| Update assigned task status | Yes | Yes |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js |
| API Style | REST |
| Database | JSON document store |
| Authentication | Token-based authentication |
| Password Security | PBKDF2 hashing |
| Deployment | Railway |

## Folder Structure

```text
team-task-manager/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/
│   └── db.json
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## API Overview

All protected API routes require this header:

```http
Authorization: Bearer <token>
```

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login existing user |
| GET | `/api/me` | Get current authenticated user |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects` | Get projects for logged-in user |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/:projectId` | Get a project with members and tasks |
| GET | `/api/projects/:projectId/dashboard` | Get project dashboard metrics |

### Members

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/:projectId/members` | Add a member to a project |
| DELETE | `/api/projects/:projectId/members/:userId` | Remove a member from a project |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/:projectId/tasks` | Create a task |
| PATCH | `/api/tasks/:taskId` | Update task details or status |
| DELETE | `/api/tasks/:taskId` | Delete a task |

## Local Setup

### Prerequisites

- Node.js 18 or later
- Git

### Installation

```bash
git clone https://github.com/kothaAbhinayasri/team-task-manager.git
cd team-task-manager
npm install
npm start
```

Open the application in your browser:

```text
http://localhost:3000
```

## Environment Variables

Create a `.env` file locally if needed, or configure these variables on Railway:

```bash
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
DATA_FILE=./data/db.json
```

For Railway, `PORT` is automatically provided. The important production variable is:

```bash
JWT_SECRET=your-production-secret
```

## Railway Deployment

1. Push the project to GitHub.
2. Open Railway.
3. Create a new project.
4. Select **Deploy from GitHub repo**.
5. Choose `kothaAbhinayasri/team-task-manager`.
6. Add the environment variable:

```bash
JWT_SECRET=team-task-manager-secret-2026
```

7. Deploy the project.
8. Generate a public domain from Railway Networking settings.
9. Open the deployed URL and test signup/login.

## How to Test the Application

### Admin Flow

1. Sign up as a new user.
2. Create a project.
3. Add another registered user as a member.
4. Create tasks with due date and priority.
5. Assign tasks to members.
6. View dashboard metrics.

### Member Flow

1. Login as a member user.
2. Open the assigned project.
3. View assigned tasks.
4. Update task status from To Do to In Progress or Done.
5. Confirm that member access is restricted from admin-only actions.

## Demo Video Guide

A 2-5 minute demo can cover:

1. Project introduction and tech stack.
2. Signup and login.
3. Admin creating a project.
4. Admin adding a member.
5. Admin creating and assigning tasks.
6. Dashboard metrics updating.
7. Member login and assigned task status update.
8. Railway live deployment.

## Security and Validation

- Passwords are never stored as plain text.
- Password hashing uses PBKDF2.
- Protected APIs require a bearer token.
- Role checks are applied on project, member, and task actions.
- Input validation is included for important fields like email, password, title, due date, status, and priority.
- Invalid requests return clear JSON error responses.

## Future Improvements

- Replace JSON storage with PostgreSQL or MongoDB.
- Add drag-and-drop task movement.
- Add comments and activity history on tasks.
- Add email invitations for project members.
- Add file attachments.
- Add automated tests.
- Add pagination and search for larger teams.

## Submission Details

- Candidate: Kotha Abhinayasri
- Project: Team Task Manager
- Live Application: https://team-task-manager-production-c6eb.up.railway.app
- GitHub Repository: https://github.com/kothaAbhinayasri/team-task-manager
- Demo Video: Add your demo video link here

## Conclusion

Team Task Manager demonstrates a complete full-stack workflow with authentication, REST APIs, role-based authorization, project collaboration, task tracking, dashboard metrics, and cloud deployment. The application is publicly deployed and ready for evaluation.
