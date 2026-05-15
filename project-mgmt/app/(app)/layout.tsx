import { AppShell } from "@/components/app-shell";
import { TaskEditor } from "@/components/tasks/task-editor";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <TaskEditor />
    </AppShell>
  );
}
