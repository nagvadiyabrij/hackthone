CREATE TYPE task_status AS ENUM ('Backlog','To Do','In Progress','Review','Done');
CREATE TYPE task_priority AS ENUM ('Low','Medium','High','Urgent');
CREATE TABLE tasks (id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL CHECK(length(title)>0), description TEXT NOT NULL DEFAULT '', status task_status NOT NULL DEFAULT 'To Do', priority task_priority NOT NULL DEFAULT 'Medium', assignee_id UUID REFERENCES users(id), due_date DATE, revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX tasks_project_status_idx ON tasks(project_id,status); CREATE INDEX tasks_assignee_due_idx ON tasks(assignee_id,due_date);
-- Atomic mutation contract: UPDATE tasks SET ..., revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2;
